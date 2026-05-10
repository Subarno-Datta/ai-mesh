"""
Aura-Mesh Swarm Engine — Main Orchestrator

Entry point for the entire Swarm system. Initializes MCP servers,
agents, and the WebSocket server, then runs the autonomous monitoring loop.

Supports runtime reconfiguration from the Observer Dashboard:
  - Switch LLM models (local Ollama or cloud APIs)
  - Change target project (local path or GitHub URL)

Usage:
    python main.py                   # Start the full swarm
    python main.py --trigger-crash   # Start and immediately trigger a test crash
"""
import os
import asyncio
import json
import sys
import signal
import io
from pathlib import Path
from datetime import datetime
from typing import Optional

# Fix Windows console encoding (cp1252 can't handle emojis)
os.environ['PYTHONIOENCODING'] = 'utf-8'
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

import httpx

sys.path.insert(0, str(Path(__file__).parent))

from config import TARGET_API_URL, TARGET_API_PORT, TARGET_API_DIR, TARGET_ENTRY_POINT
from models.incident import Incident, IncidentStatus
from mcp_servers.logtail_server import LogTailMCP
from mcp_servers.filesystem_server import FileSystemMCP
from agents.sentinel import SentinelAgent
from agents.debugger import DebuggerAgent
from agents.deployer import DeployerAgent
from agents.verifier import VerifierAgent
from ws_server import DashboardWSServer
from providers.llm_provider import list_ollama_models, create_provider


class SwarmOrchestrator:
    """
    The central coordinator that wires together MCP servers, agents,
    and the WebSocket server into the full autonomous healing pipeline.
    """

    def __init__(self):
        # MCP Servers
        self.logtail_mcp = LogTailMCP()
        self.filesystem_mcp = FileSystemMCP()

        # Configure with default target
        self.logtail_mcp.configure(
            target_dir=str(TARGET_API_DIR),
            entry_point=TARGET_ENTRY_POINT,
            port=TARGET_API_PORT
        )

        # Agents
        self.sentinel = SentinelAgent()
        self.debugger = DebuggerAgent(self.filesystem_mcp)
        self.deployer = DeployerAgent(self.filesystem_mcp, self.logtail_mcp)
        self.verifier = VerifierAgent()

        # WebSocket
        self.ws_server = DashboardWSServer()

        # State
        self.active_incidents: list = []
        self.resolved_incidents: list = []
        self._running = False
        self._incident_lock = asyncio.Lock()
        self._target_url = TARGET_API_URL
        self._pending_approvals: dict[str, asyncio.Future] = {}

        # Wire up the Sentinel's incident callback
        self.sentinel.on_incident = self._handle_new_incident

    async def start(self):
        """Start the entire swarm system."""
        print("=" * 60)
        print("  🛡️  AURA-MESH: The Sentinel Protocol")
        print("  Autonomous Incident Resolution Engine")
        print("=" * 60)
        print()

        self._running = True

        # Start WebSocket server for Observer Dashboard
        await self.ws_server.start()
        await self.ws_server.broadcast_system_event("swarm_starting")

        # Broadcast initial settings
        await self._broadcast_current_settings()

        # Start the Target API via LogTail MCP
        print("[Orchestrator] 🎯 Starting Target API...")
        started = await self.logtail_mcp.start_target()
        if not started:
            print("[Orchestrator] ❌ Failed to start Target API")
            return

        # Subscribe the Sentinel to the log stream
        self.logtail_mcp.subscribe(self.sentinel.process_log_entry)

        # Also forward logs to dashboard
        self.logtail_mcp.subscribe(self._forward_log_to_dashboard)

        await asyncio.sleep(2)  # Let server boot

        # Broadcast initial agent states
        for agent in [self.sentinel, self.debugger, self.deployer, self.verifier]:
            await self.ws_server.broadcast_agent_state(agent.get_state())

        await self.ws_server.broadcast_system_event("swarm_ready", {
            "target_url": self._target_url,
            "agents": ["sentinel", "debugger", "deployer", "verifier"]
        })

        print()
        print("[Orchestrator] ✅ Swarm is ACTIVE and monitoring")
        print(f"[Orchestrator] 🎯 Target API: {self._target_url}")
        print(f"[Orchestrator] 🌐 Dashboard WS: ws://localhost:8765")
        print(f"[Orchestrator] 💡 Send requests to the Target API to trigger crashes")
        print()

        # Check for --trigger-crash flag
        if "--trigger-crash" in sys.argv:
            asyncio.create_task(self._trigger_test_crash())

        # Handle dashboard commands
        asyncio.create_task(self._process_dashboard_commands())

        # Keep running
        try:
            while self._running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass

    async def _broadcast_current_settings(self):
        """Broadcast current configuration to the dashboard."""
        settings = {
            "llm": {
                "provider": self.debugger.llm.name if hasattr(self.debugger, 'llm') else "unknown",
                "provider_type": self.debugger.llm.__class__.__name__ if hasattr(self.debugger, 'llm') else "unknown",
            },
            "target": self.logtail_mcp.get_target_info(),
            "filesystem": self.filesystem_mcp.get_scope_info(),
            "hitl": {
                "enabled": self.ws_server._settings.get("human_in_the_loop", False)
            }
        }
        self.ws_server.update_settings(settings)
        await self.ws_server.broadcast_settings_response("current_settings", settings)

    async def ask_for_approval(self, action_id: str, title: str, description: str, details: dict = None) -> bool:
        """Ask the dashboard for human approval if HITL is enabled."""
        if not self.ws_server._settings.get("human_in_the_loop", False):
            return True # Auto-approve if HITL is off
            
        future = asyncio.Future()
        self._pending_approvals[action_id] = future
        
        await self.ws_server.broadcast_system_event("approval_required", {
            "action_id": action_id,
            "title": title,
            "description": description,
            "details": details or {}
        })
        
        print(f"[Orchestrator] 🛡️ HITL Pause: Waiting for approval on '{title}'...")
        try:
            # Wait up to 5 minutes for user response
            return await asyncio.wait_for(future, timeout=300)
        except asyncio.TimeoutError:
            print(f"[Orchestrator] ⏱️ Approval timed out for {action_id}")
            return False
        finally:
            self._pending_approvals.pop(action_id, None)

    async def _forward_log_to_dashboard(self, log_entry: dict):
        """Forward log entries to the WebSocket dashboard."""
        await self.ws_server.broadcast_log(log_entry)

    async def _handle_new_incident(self, incident: Incident):
        """
        Full incident resolution pipeline.
        Sentinel → Debugger → Deployer → Verifier
        """
        async with self._incident_lock:
            self.active_incidents.append(incident)

        start_time = datetime.now()
        await self.ws_server.broadcast_incident(incident.model_dump())
        await self.ws_server.broadcast_agent_state(self.sentinel.get_state())

        print(f"\n{'='*60}")
        print(f"  🚨 INCIDENT PIPELINE ACTIVATED: {incident.incident_id[:8]}...")
        print(f"{'='*60}\n")

        # Phase 2+3: Debugger diagnoses and generates patch
        incident = await self.debugger.diagnose_and_patch(incident)
        await self.ws_server.broadcast_incident(incident.model_dump())
        await self.ws_server.broadcast_agent_state(self.debugger.get_state())

        if incident.status == IncidentStatus.FAILED:
            print(f"[Orchestrator] ❌ Pipeline failed at Debugger phase")
            await self._finalize_incident(incident)
            return

        # >>> HITL PAUSE: Patch Approval <<<
        approved = await self.ask_for_approval(
            action_id=f"patch_{incident.incident_id}",
            title="Approve Patch Deployment",
            description=f"Review the proposed fix for {incident.error_message}",
            details={"incident_id": incident.incident_id}
        )
        
        if not approved:
            print(f"[Orchestrator] 🛑 Patch rejected by user for {incident.incident_id}")
            incident.status = IncidentStatus.FAILED
            incident.resolution_log.append({
                "timestamp": datetime.now().isoformat(),
                "agent": "orchestrator",
                "action": "human_approval",
                "status": "rejected",
                "details": "User rejected the proposed patch."
            })
            await self._finalize_incident(incident)
            return

        # Phase 4: Deployer applies patch and restarts
        incident = await self.deployer.deploy_patch(incident)
        await self.ws_server.broadcast_incident(incident.model_dump())
        await self.ws_server.broadcast_agent_state(self.deployer.get_state())

        if incident.status == IncidentStatus.FAILED:
            print(f"[Orchestrator] ❌ Pipeline failed at Deployer phase")
            await self._finalize_incident(incident)
            return

        # Phase 5: Verifier replays the request
        incident = await self.verifier.verify_fix(incident)
        await self.ws_server.broadcast_incident(incident.model_dump())
        await self.ws_server.broadcast_agent_state(self.verifier.get_state())

        elapsed = (datetime.now() - start_time).total_seconds() * 1000
        incident.resolution_time_ms = elapsed

        await self._finalize_incident(incident)

    async def _finalize_incident(self, incident: Incident):
        """Finalize an incident — move from active to resolved."""
        async with self._incident_lock:
            self.active_incidents = [i for i in self.active_incidents if i.incident_id != incident.incident_id]
            self.resolved_incidents.append(incident)

        status_icon = "✅" if incident.status == IncidentStatus.RESOLVED else "❌"
        print(f"\n{'='*60}")
        print(f"  {status_icon} INCIDENT {incident.incident_id[:8]}... → {incident.status.value.upper()}")
        if incident.resolution_time_ms:
            print(f"  ⏱️  Total resolution time: {incident.resolution_time_ms:.0f}ms")
        print(f"  🤖 Agents involved: {', '.join(incident.agents_involved)}")
        print(f"{'='*60}\n")

        await self.ws_server.broadcast_incident(incident.model_dump())
        await self.ws_server.broadcast_system_event("incident_resolved" if incident.status == IncidentStatus.RESOLVED else "incident_failed", {
            "incident_id": incident.incident_id,
            "resolution_time_ms": incident.resolution_time_ms
        })

    async def _trigger_test_crash(self):
        """Send a request that will trigger a crash in the Target API."""
        await asyncio.sleep(4)  # Wait for server to fully start
        print("[Orchestrator] 🧪 Triggering test crash...")

        test_crashes = [
            {
                "name": "Null user name",
                "method": "POST",
                "url": f"{self._target_url}/api/users",
                "json": {"name": None, "email": "test@test.com"}
            },
            {
                "name": "Non-existent user",
                "method": "GET",
                "url": f"{self._target_url}/api/users/999",
                "json": None
            },
            {
                "name": "Non-existent product",
                "method": "GET",
                "url": f"{self._target_url}/api/products/999",
                "json": None
            }
        ]

        async with httpx.AsyncClient(timeout=5.0) as client:
            crash = test_crashes[0]
            print(f"[Orchestrator] 💥 Sending: {crash['name']}")
            try:
                if crash["json"]:
                    resp = await client.post(crash["url"], json=crash["json"])
                else:
                    resp = await client.get(crash["url"])
                print(f"[Orchestrator] 📊 Response: {resp.status_code}")
            except Exception as e:
                print(f"[Orchestrator] ⚠️ Request error (expected): {e}")

    async def _process_dashboard_commands(self):
        """Process commands from the Observer Dashboard."""
        while self._running:
            try:
                msg = await asyncio.wait_for(
                    self.ws_server._message_queue.get(),
                    timeout=1.0
                )
                msg_type = msg.get("type")

                if msg_type == "trigger_crash":
                    crash_type = msg.get("data", {}).get("crash_type", "null_user")
                    await self._trigger_specific_crash(crash_type)

                elif msg_type == "list_models":
                    await self._handle_list_models()

                elif msg_type == "update_llm":
                    await self._handle_update_llm(msg.get("data", {}))

                elif msg_type == "update_target":
                    await self._handle_update_target(msg.get("data", {}))

                elif msg_type == "get_settings":
                    await self._broadcast_current_settings()

                elif msg_type == "update_hitl":
                    hitl_enabled = msg.get("data", {}).get("enabled", False)
                    self.ws_server._settings["human_in_the_loop"] = hitl_enabled
                    print(f"[Orchestrator] 🛡️ Human-in-the-Loop set to {hitl_enabled}")
                    await self._broadcast_current_settings()

                elif msg_type == "action_approval":
                    data = msg.get("data", {})
                    action_id = data.get("action_id")
                    approved = data.get("approved", False)
                    if action_id in self._pending_approvals:
                        if not self._pending_approvals[action_id].done():
                            self._pending_approvals[action_id].set_result(approved)

            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"[Orchestrator] ⚠️ Command error: {e}")
                continue

    # --- Settings Handlers ---

    async def _handle_list_models(self):
        """List available Ollama models and broadcast to dashboard."""
        print("[Orchestrator] 📋 Listing available Ollama models...")
        models = await list_ollama_models()
        await self.ws_server.broadcast_settings_response("models_list", {
            "models": models,
            "current_model": self.debugger.llm.name if hasattr(self.debugger, 'llm') else "unknown"
        })

    async def _handle_update_llm(self, data: dict):
        """Switch LLM provider/model at runtime."""
        provider_type = data.get("provider", "ollama")
        print(f"[Orchestrator] 🔄 Switching LLM to {provider_type}...")

        try:
            if provider_type == "ollama":
                new_provider = create_provider("ollama", model=data.get("model"))
            elif provider_type in ("huggingface", "hf"):
                new_provider = create_provider("huggingface",
                    api_token=data.get("api_token"),
                    model_id=data.get("model_id")
                )
            elif provider_type == "openai":
                new_provider = create_provider("openai",
                    api_key=data.get("api_key"),
                    base_url=data.get("base_url"),
                    model=data.get("model")
                )
            else:
                await self.ws_server.broadcast_settings_response("error", {
                    "message": f"Unknown provider: {provider_type}"
                })
                return

            # Hot-swap the provider on the debugger
            self.debugger.llm = new_provider
            print(f"[Orchestrator] ✅ LLM switched to {new_provider.name}")
            
            await self.ws_server.broadcast_settings_response("llm_updated", {
                "provider": new_provider.name,
                "provider_type": provider_type,
            })
            await self._broadcast_current_settings()

        except Exception as e:
            print(f"[Orchestrator] ❌ Failed to switch LLM: {e}")
            await self.ws_server.broadcast_settings_response("error", {
                "message": f"Failed to switch LLM: {str(e)}"
            })

    async def _handle_update_target(self, data: dict):
        """Change the target project at runtime."""
        source = data.get("source", "local")  # "local" or "github"
        
        print(f"[Orchestrator] 🔄 Updating target ({source})...")
        await self.ws_server.broadcast_system_event("target_updating", {"source": source})

        # Stop current target
        if self.logtail_mcp.is_running:
            await self.logtail_mcp.stop_target()

        try:
            if source == "github":
                repo_url = data.get("repo_url", "")
                if not repo_url:
                    await self.ws_server.broadcast_settings_response("error", {
                        "message": "No GitHub URL provided"
                    })
                    return

                result = await self.logtail_mcp.configure_from_github(
                    repo_url=repo_url,
                    entry_point=data.get("entry_point"),
                    port=data.get("port", TARGET_API_PORT),
                    approval_callback=self.ask_for_approval
                )
                
                if not result["success"]:
                    await self.ws_server.broadcast_settings_response("error", {
                        "message": result["error"]
                    })
                    return

                # Reconfigure filesystem MCP for the cloned repo
                self.filesystem_mcp.configure(
                    target_dir=result["path"],
                    allowed_subdirs=data.get("allowed_dirs")
                )

            elif source == "local":
                local_path = data.get("path", "")
                if not local_path or not Path(local_path).exists():
                    await self.ws_server.broadcast_settings_response("error", {
                        "message": f"Path does not exist: {local_path}"
                    })
                    return

                entry_point = data.get("entry_point")
                if not entry_point:
                    # Auto-detect from package.json
                    entry_point = self.logtail_mcp._detect_entry_point(Path(local_path))

                port = data.get("port", TARGET_API_PORT)
                self.logtail_mcp.configure(
                    target_dir=local_path,
                    entry_point=entry_point,
                    port=port
                )
                self._target_url = f"http://localhost:{port}"

                self.filesystem_mcp.configure(
                    target_dir=local_path,
                    allowed_subdirs=data.get("allowed_dirs")
                )

            # Update the target URL
            port = data.get("port", TARGET_API_PORT)
            self._target_url = f"http://localhost:{port}"

            # Restart with new target
            print("[Orchestrator] 🎯 Starting new target...")
            started = await self.logtail_mcp.start_target()
            
            if started:
                await asyncio.sleep(2)  # Let it boot
                print(f"[Orchestrator] ✅ Target switched successfully")
                await self.ws_server.broadcast_settings_response("target_updated", {
                    "target": self.logtail_mcp.get_target_info(),
                    "filesystem": self.filesystem_mcp.get_scope_info(),
                })
                await self._broadcast_current_settings()
                await self.ws_server.broadcast_system_event("swarm_ready", {
                    "target_url": self._target_url,
                })
            else:
                await self.ws_server.broadcast_settings_response("error", {
                    "message": "Failed to start new target"
                })

        except Exception as e:
            print(f"[Orchestrator] ❌ Target switch failed: {e}")
            await self.ws_server.broadcast_settings_response("error", {
                "message": f"Target switch failed: {str(e)}"
            })

    async def _trigger_specific_crash(self, crash_type: str):
        """Trigger a specific type of crash for demo purposes."""
        crash_map = {
            "null_user": ("POST", f"{self._target_url}/api/users", {"name": None, "email": "test@test.com"}),
            "missing_user": ("GET", f"{self._target_url}/api/users/999", None),
            "missing_product": ("GET", f"{self._target_url}/api/products/999", None),
            "bad_regex": ("GET", f"{self._target_url}/api/products/search?q=[invalid", None),
            "null_order": ("POST", f"{self._target_url}/api/orders", {"userId": "1"}),
            "null_profile": ("PUT", f"{self._target_url}/api/users/1", {"profile": {"bio": None}}),
            "division_zero": ("POST", f"{self._target_url}/api/products/1/discount", {"discount_percent": 100}),
        }

        crash = crash_map.get(crash_type, crash_map["null_user"])
        method, url, body = crash

        print(f"[Orchestrator] 🧪 Dashboard triggered crash: {crash_type}")
        await self.ws_server.broadcast_system_event("crash_triggered", {"crash_type": crash_type})

        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                if method == "GET":
                    await client.get(url)
                elif method == "POST":
                    await client.post(url, json=body)
                elif method == "PUT":
                    await client.put(url, json=body)
            except Exception as e:
                print(f"[Orchestrator] ⚠️ Crash request error: {e}")

    async def shutdown(self):
        """Gracefully shut down the swarm."""
        print("\n[Orchestrator] 🛑 Shutting down Aura-Mesh...")
        self._running = False
        await self.ws_server.broadcast_system_event("swarm_shutdown")
        await self.logtail_mcp.stop_target()
        if self.ws_server.server:
            self.ws_server.server.close()
        print("[Orchestrator] 👋 Goodbye!")


async def main():
    orchestrator = SwarmOrchestrator()
    
    # Handle Ctrl+C
    loop = asyncio.get_event_loop()
    
    def signal_handler():
        asyncio.create_task(orchestrator.shutdown())
    
    try:
        loop.add_signal_handler(signal.SIGINT, signal_handler)
        loop.add_signal_handler(signal.SIGTERM, signal_handler)
    except NotImplementedError:
        # Windows doesn't support add_signal_handler
        pass

    try:
        await orchestrator.start()
    except KeyboardInterrupt:
        await orchestrator.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
