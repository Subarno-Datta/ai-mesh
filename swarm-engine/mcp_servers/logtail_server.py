"""
LogTail MCP Server

Provides real-time log streaming from any Node.js target process.
Supports:
  - Local directories (any path on disk)
  - GitHub repos (cloned automatically)

The Sentinel agent uses this to detect crashes (500 errors, stack traces).
"""
import asyncio
import subprocess
import json
import os
import sys
import shutil
from pathlib import Path
from typing import AsyncGenerator, Optional, Callable, List
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import TARGET_API_PORT, CLONE_DIR


class LogTailMCP:
    """
    MCP Server that tails a target Node.js process stdout/stderr.
    Supports dynamic target path configuration — local directories or cloned repos.
    """

    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.log_buffer: List[dict] = []
        self.subscribers: List[Callable] = []
        self._running = False
        self._reader_task: Optional[asyncio.Task] = None
        
        # Dynamic target configuration
        self._target_dir: Optional[Path] = None
        self._entry_point: str = "server.js"
        self._port: int = TARGET_API_PORT
        self._source_type: str = "local"  # "local" or "github"

    def configure(self, target_dir: str, entry_point: str = "server.js", port: int = None):
        """Configure the target directory and entry point at runtime."""
        self._target_dir = Path(target_dir).resolve()
        self._entry_point = entry_point
        if port:
            self._port = port
        self._source_type = "local"
        print(f"[LogTail MCP] Configured: {self._target_dir} → node {self._entry_point}")

    async def configure_from_github(self, repo_url: str, entry_point: str = None, port: int = None, approval_callback=None) -> dict:
        """
        Clone a GitHub repo and configure it as the target.
        Returns status dict with success/error info.
        """
        # Sanitize repo name for directory
        repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
        clone_path = Path(CLONE_DIR) / repo_name
        
        # Create clone directory
        clone_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Remove if already cloned
        if clone_path.exists():
            shutil.rmtree(clone_path, ignore_errors=True)
        
        print(f"[LogTail MCP] Cloning {repo_url}...")
        try:
            proc = await asyncio.create_subprocess_exec(
                "git", "clone", "--depth", "1", repo_url, str(clone_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
            
            if proc.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='replace')
                print(f"[LogTail MCP] Clone failed: {error_msg}")
                return {"success": False, "error": f"Clone failed: {error_msg}"}
        except asyncio.TimeoutError:
            return {"success": False, "error": "Clone timed out (60s)"}
        except FileNotFoundError:
            return {"success": False, "error": "git not found. Install git first."}

        # Auto-detect entry point from package.json
        detected_entry = entry_point
        if not detected_entry:
            detected_entry = self._detect_entry_point(clone_path)
        
        # Install dependencies
        pkg_json = clone_path / "package.json"
        req_txt = clone_path / "requirements.txt"

        if pkg_json.exists():
            if approval_callback:
                approved = await approval_callback(
                    action_id=f"npm_install_{repo_name}",
                    title="Install Node Dependencies",
                    description=f"Run `npm install` in cloned repository {repo_name}?"
                )
                if not approved:
                    return {"success": False, "error": "User rejected npm install."}
            print(f"[LogTail MCP] Installing Node dependencies...")
            npm_result = await self._run_npm_install(clone_path)
            if not npm_result["success"]:
                return npm_result

        if req_txt.exists():
            if approval_callback:
                approved = await approval_callback(
                    action_id=f"pip_install_{repo_name}",
                    title="Install Python Dependencies",
                    description=f"Run `pip install -r requirements.txt` in cloned repository {repo_name}?"
                )
                if not approved:
                    return {"success": False, "error": "User rejected pip install."}
            print(f"[LogTail MCP] Installing Python dependencies...")
            pip_result = await self._run_pip_install(clone_path)
            if not pip_result["success"]:
                return pip_result

        self._target_dir = clone_path
        self._entry_point = detected_entry
        self._source_type = "github"
        if port:
            self._port = port

        print(f"[LogTail MCP] Ready: {clone_path} → node {detected_entry}")
        return {
            "success": True,
            "path": str(clone_path),
            "entry_point": detected_entry,
            "source": "github",
            "repo": repo_url
        }

    def _detect_entry_point(self, project_dir: Path) -> str:
        """Auto-detect the entry point from package.json."""
        pkg_json = project_dir / "package.json"
        if pkg_json.exists():
            try:
                pkg = json.loads(pkg_json.read_text(encoding="utf-8"))
                # Check scripts.start
                start_script = pkg.get("scripts", {}).get("start", "")
                if "node " in start_script:
                    # Extract: "node server.js" → "server.js"
                    parts = start_script.split("node ")
                    if len(parts) > 1:
                        return parts[1].strip().split(" ")[0]
                
                # Check main field
                main = pkg.get("main", "")
                if main:
                    return main
            except Exception:
                pass

        # Fallback: common entry point names
        for candidate in ["server.js", "app.js", "index.js", "src/index.js", "src/server.js"]:
            if (project_dir / candidate).exists():
                return candidate

        return "server.js"

    async def _run_npm_install(self, project_dir: Path) -> dict:
        """Run npm install in the project directory."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "npm", "install",
                cwd=str(project_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            
            if proc.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='replace')
                return {"success": False, "error": f"npm install failed: {error_msg[:500]}"}
            
            return {"success": True}
        except asyncio.TimeoutError:
            return {"success": False, "error": "npm install timed out (120s)"}
        except FileNotFoundError:
            return {"success": False, "error": "npm not found. Install Node.js first."}

    async def _run_pip_install(self, project_dir: Path) -> dict:
        """Run pip install -r requirements.txt in the project directory."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "pip", "install", "-r", "requirements.txt",
                cwd=str(project_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            
            if proc.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='replace')
                return {"success": False, "error": f"pip install failed: {error_msg[:500]}"}
            
            return {"success": True}
        except asyncio.TimeoutError:
            return {"success": False, "error": "pip install timed out (120s)"}
        except FileNotFoundError:
            return {"success": False, "error": "pip not found. Install Python first."}

    async def start_target(self) -> bool:
        """Start the target Node.js process."""
        if not self._target_dir:
            print("[LogTail MCP] No target directory configured!")
            return False
            
        if not self._target_dir.exists():
            print(f"[LogTail MCP] Target directory not found: {self._target_dir}")
            return False

        entry_file = self._target_dir / self._entry_point
        if not entry_file.exists():
            print(f"[LogTail MCP] Entry point not found: {entry_file}")
            return False

        try:
            self.process = await asyncio.create_subprocess_exec(
                "node", self._entry_point,
                cwd=str(self._target_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**dict(os.environ), "PORT": str(self._port)}
            )
            self._running = True
            self._reader_task = asyncio.create_task(self._read_output())
            print(f"[LogTail MCP] Target API started (PID: {self.process.pid})")
            return True
        except Exception as e:
            print(f"[LogTail MCP] Failed to start Target API: {e}")
            return False

    async def restart_target(self) -> bool:
        """Restart the Target API process (hot-reload)."""
        print("[LogTail MCP] Restarting Target API...")
        await self.stop_target()
        await asyncio.sleep(1)  # Brief cooldown
        return await self.start_target()

    async def stop_target(self):
        """Stop the Target API process."""
        if self.process:
            self._running = False
            try:
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.process.kill()
            self.process = None
            print("[LogTail MCP] Target API stopped")

    async def _read_output(self):
        """Continuously read stdout/stderr from the target process."""
        if not self.process:
            return

        async def read_stream(stream, stream_type):
            while self._running and stream:
                try:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded = line.decode('utf-8', errors='replace').strip()
                    if not decoded:
                        continue

                    log_entry = self._parse_log_line(decoded, stream_type)
                    self.log_buffer.append(log_entry)

                    # Keep buffer manageable
                    if len(self.log_buffer) > 1000:
                        self.log_buffer = self.log_buffer[-500:]

                    # Notify all subscribers
                    for callback in self.subscribers:
                        try:
                            await callback(log_entry)
                        except Exception as e:
                            print(f"[LogTail MCP] Subscriber error: {e}")
                except Exception as e:
                    if self._running:
                        print(f"[LogTail MCP] Read error: {e}")
                    break

        await asyncio.gather(
            read_stream(self.process.stdout, "stdout"),
            read_stream(self.process.stderr, "stderr")
        )

    def _parse_log_line(self, line: str, stream_type: str) -> dict:
        """Parse a log line, attempting JSON parse first."""
        try:
            parsed = json.loads(line)
            parsed["_stream"] = stream_type
            parsed["_raw"] = line
            return parsed
        except json.JSONDecodeError:
            return {
                "type": "raw",
                "level": "error" if stream_type == "stderr" else "info",
                "message": line,
                "_stream": stream_type,
                "_raw": line,
                "timestamp": datetime.now().isoformat()
            }

    def subscribe(self, callback: Callable):
        """Register a callback for new log entries."""
        self.subscribers.append(callback)

    def unsubscribe(self, callback: Callable):
        """Remove a callback."""
        self.subscribers = [s for s in self.subscribers if s != callback]

    def get_recent_logs(self, count: int = 50) -> List[dict]:
        """Get the most recent log entries."""
        return self.log_buffer[-count:]

    def get_target_info(self) -> dict:
        """Return current target configuration for the dashboard."""
        return {
            "target_dir": str(self._target_dir) if self._target_dir else None,
            "entry_point": self._entry_point,
            "port": self._port,
            "source_type": self._source_type,
            "is_running": self.is_running,
            "pid": self.process.pid if self.process else None,
        }

    @property
    def is_running(self) -> bool:
        return self._running and self.process is not None and self.process.returncode is None
