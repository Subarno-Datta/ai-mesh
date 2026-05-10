"""
Deployer Agent — The Executor

Phase 4 of the Aura-Mesh workflow.
Takes the patched code from the Debugger agent, uses FileSystem MCP to
overwrite the target file, and triggers a hot-reload of the server.
"""
import json
import sys
import traceback
from pathlib import Path
from typing import Optional
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))
from models.incident import Incident, IncidentStatus
from mcp_servers.filesystem_server import FileSystemMCP
from mcp_servers.logtail_server import LogTailMCP


class DeployerAgent:
    """
    Applies code patches and restarts the Target API.
    """

    def __init__(self, filesystem_mcp: FileSystemMCP, logtail_mcp: LogTailMCP):
        self.name = "deployer"
        self.status = "idle"
        self.fs_mcp = filesystem_mcp
        self.logtail = logtail_mcp
        self.deployments = 0

    async def deploy_patch(self, incident: Incident) -> Incident:
        """
        Phase 4: Apply the patch and restart the server.
        """
        self.status = "deploying"
        incident.update_status(IncidentStatus.DEPLOYING, self.name)

        try:
            # Parse the patch data
            patch_data = json.loads(incident.patched_code)
            original_code = patch_data.get("original_code", "")
            patched_code = patch_data.get("patched_code", "")

            if not original_code or not patched_code:
                raise ValueError("Patch data missing original_code or patched_code")

            # Apply the patch via FileSystem MCP
            print(f"[Deployer] 📝 Applying patch to {incident.faulty_file}...")
            result = self.fs_mcp.patch_file(
                incident.faulty_file,
                original_code,
                patched_code
            )

            if result.get("success"):
                print(f"[Deployer] ✅ File patched successfully")
                print(f"[Deployer] 📊 {result['original_lines']} → {result['new_lines']} lines")

                # Restart the server
                print(f"[Deployer] 🔄 Restarting Target API...")
                restart_ok = await self.logtail.restart_target()

                if restart_ok:
                    self.deployments += 1
                    print(f"[Deployer] ✅ Server restarted (deployment #{self.deployments})")
                    incident.update_status(IncidentStatus.VERIFYING, self.name)
                else:
                    print(f"[Deployer] ❌ Server restart failed")
                    incident.update_status(IncidentStatus.FAILED, self.name)
            else:
                print(f"[Deployer] ❌ File patch failed")
                incident.update_status(IncidentStatus.FAILED, self.name)

        except json.JSONDecodeError as e:
            print(f"[Deployer] ❌ Invalid patch data: {e}")
            incident.update_status(IncidentStatus.FAILED, self.name)
        except ValueError as e:
            print(f"[Deployer] ❌ Patch error: {e}")
            incident.update_status(IncidentStatus.FAILED, self.name)
        except Exception as e:
            print(f"[Deployer] ❌ Deployment error: {e}")
            traceback.print_exc()
            incident.update_status(IncidentStatus.FAILED, self.name)

        self.status = "idle"
        return incident

    def get_state(self) -> dict:
        return {
            "agent": self.name,
            "status": self.status,
            "deployments": self.deployments,
            "timestamp": datetime.now().isoformat()
        }
