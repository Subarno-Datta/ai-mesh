"""
WebSocket Server for the Observer Dashboard

Broadcasts real-time swarm state, incident updates, and log entries
to the React frontend via WebSocket connections.

Also handles settings commands from the dashboard:
  - list_models: List available Ollama models
  - update_llm: Switch LLM provider/model at runtime
  - update_target: Change target path (local or GitHub)
  - get_settings: Get current configuration
"""
import json
import asyncio
import sys
from pathlib import Path
from typing import Set, Dict, Any
from datetime import datetime

import websockets

sys.path.insert(0, str(Path(__file__).parent))
from config import WS_HOST, WS_PORT


class DashboardWSServer:
    """
    WebSocket server that bridges the Swarm Engine to the Observer Dashboard.
    """

    def __init__(self):
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.server = None
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._incident_history: list = []
        self._agent_states: Dict[str, dict] = {}
        self._log_buffer: list = []
        self._settings: Dict[str, Any] = {
            "human_in_the_loop": False
        }

    async def start(self):
        """Start the WebSocket server."""
        self.server = await websockets.serve(
            self._handler,
            WS_HOST,
            WS_PORT
        )
        print(f"[WS Server] 🌐 Dashboard WebSocket running on ws://{WS_HOST}:{WS_PORT}")

    async def _handler(self, websocket: websockets.WebSocketServerProtocol, path: str = ""):
        """Handle new WebSocket connections."""
        self.clients.add(websocket)
        client_id = id(websocket)
        print(f"[WS Server] 📱 Dashboard client connected (ID: {client_id}, total: {len(self.clients)})")

        try:
            # Send current state snapshot to new client
            await self._send_initial_state(websocket)

            # Keep connection alive, handle incoming messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self._handle_client_message(websocket, data)
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            print(f"[WS Server] 📱 Client disconnected (ID: {client_id}, remaining: {len(self.clients)})")

    async def _send_initial_state(self, websocket):
        """Send the current system state to a newly connected client."""
        snapshot = {
            "type": "state_snapshot",
            "data": {
                "agents": self._agent_states,
                "incidents": [inc for inc in self._incident_history[-20:]],
                "logs": self._log_buffer[-50:],
                "settings": self._settings,
                "timestamp": datetime.now().isoformat()
            }
        }
        await websocket.send(json.dumps(snapshot))

    async def _handle_client_message(self, websocket, data: dict):
        """Handle messages from dashboard clients."""
        msg_type = data.get("type")
        
        if msg_type == "trigger_crash":
            await self._message_queue.put(data)
        elif msg_type == "request_state":
            await self._send_initial_state(websocket)
        elif msg_type in ("list_models", "update_llm", "update_target", "get_settings", "update_hitl", "action_approval"):
            # Forward settings commands to orchestrator
            await self._message_queue.put(data)
        else:
            # Forward any other message to orchestrator
            await self._message_queue.put(data)

    def update_settings(self, settings: Dict[str, Any]):
        """Update cached settings for new client snapshots."""
        self._settings.update(settings)

    async def broadcast(self, event: Dict[str, Any]):
        """Broadcast an event to all connected dashboard clients."""
        if not self.clients:
            return

        message = json.dumps(event, default=str)
        disconnected = set()
        
        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)

        self.clients -= disconnected

    async def broadcast_incident(self, incident_data: dict):
        """Broadcast an incident update."""
        event = {
            "type": "incident_update",
            "data": incident_data,
            "timestamp": datetime.now().isoformat()
        }
        self._incident_history.append(incident_data)
        if len(self._incident_history) > 100:
            self._incident_history = self._incident_history[-50:]
        await self.broadcast(event)

    async def broadcast_agent_state(self, agent_state: dict):
        """Broadcast an agent state change."""
        agent_name = agent_state.get("agent", "unknown")
        self._agent_states[agent_name] = agent_state
        event = {
            "type": "agent_state",
            "data": agent_state,
            "timestamp": datetime.now().isoformat()
        }
        await self.broadcast(event)

    async def broadcast_log(self, log_entry: dict):
        """Broadcast a log entry."""
        event = {
            "type": "log_entry",
            "data": log_entry,
            "timestamp": datetime.now().isoformat()
        }
        self._log_buffer.append(log_entry)
        if len(self._log_buffer) > 200:
            self._log_buffer = self._log_buffer[-100:]
        await self.broadcast(event)

    async def broadcast_system_event(self, event_name: str, details: dict = None):
        """Broadcast a general system event."""
        event = {
            "type": "system_event",
            "data": {
                "event": event_name,
                "details": details or {},
                "timestamp": datetime.now().isoformat()
            }
        }
        await self.broadcast(event)

    async def broadcast_settings_response(self, response_type: str, data: dict):
        """Broadcast a settings response to all clients."""
        event = {
            "type": "settings_response",
            "response_type": response_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        await self.broadcast(event)
