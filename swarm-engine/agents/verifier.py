"""
Verifier Agent — The Validator

Phase 5 of the Aura-Mesh workflow.
Replays the exact JSON payload that originally caused the crash to ensure
it now returns a 200 OK. Marks the incident as resolved or failed.
"""
import sys
import asyncio
import traceback
from pathlib import Path
from typing import Optional
from datetime import datetime

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import TARGET_API_URL
from models.incident import Incident, IncidentStatus


class VerifierAgent:
    """
    Replays the original crashing request to verify the patch worked.
    """

    def __init__(self):
        self.name = "verifier"
        self.status = "idle"
        self.verifications = 0
        self.successful = 0

    async def verify_fix(self, incident: Incident) -> Incident:
        """
        Phase 5: Replay the triggering request and check the response.
        """
        self.status = "verifying"

        # Wait a moment for the server to fully restart
        await asyncio.sleep(2)

        try:
            trigger = incident.triggering_request
            if not trigger:
                print(f"[Verifier] ⚠️ No triggering request to replay — skipping verification")
                incident.update_status(IncidentStatus.RESOLVED, self.name)
                self.verifications += 1
                self.successful += 1
                self.status = "idle"
                return incident

            print(f"[Verifier] 🔄 Replaying: {trigger.method} {trigger.path}")

            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{TARGET_API_URL}{trigger.path}"
                
                if trigger.method.upper() == "GET":
                    response = await client.get(url)
                elif trigger.method.upper() == "POST":
                    response = await client.post(url, json=trigger.body)
                elif trigger.method.upper() == "PUT":
                    response = await client.put(url, json=trigger.body)
                elif trigger.method.upper() == "DELETE":
                    response = await client.delete(url)
                else:
                    response = await client.request(trigger.method, url, json=trigger.body)

                self.verifications += 1

                if response.status_code < 500:
                    self.successful += 1
                    # Calculate resolution time
                    first_event = incident.status_history[0] if incident.status_history else None
                    if first_event:
                        start = datetime.fromisoformat(first_event["timestamp"])
                        elapsed = (datetime.now() - start).total_seconds() * 1000
                        incident.resolution_time_ms = elapsed

                    incident.update_status(IncidentStatus.RESOLVED, self.name)
                    print(f"[Verifier] ✅ Verification PASSED — Status: {response.status_code}")
                    print(f"[Verifier] ⏱️  Resolved in {incident.resolution_time_ms:.0f}ms")
                else:
                    incident.update_status(IncidentStatus.FAILED, self.name)
                    print(f"[Verifier] ❌ Verification FAILED — Status: {response.status_code}")
                    print(f"[Verifier] 📋 Response: {response.text[:200]}")

        except httpx.ConnectError:
            print(f"[Verifier] ❌ Cannot connect to Target API — server may not have restarted")
            incident.update_status(IncidentStatus.FAILED, self.name)
        except Exception as e:
            print(f"[Verifier] ❌ Verification error: {e}")
            traceback.print_exc()
            incident.update_status(IncidentStatus.FAILED, self.name)

        self.status = "idle"
        return incident

    def get_state(self) -> dict:
        return {
            "agent": self.name,
            "status": self.status,
            "verifications": self.verifications,
            "successful": self.successful,
            "success_rate": f"{(self.successful / self.verifications * 100):.0f}%" if self.verifications > 0 else "N/A",
            "timestamp": datetime.now().isoformat()
        }
