"""
Incident Data Model
Represents a single crash → fix lifecycle in the Aura-Mesh system.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class IncidentStatus(str, Enum):
    DETECTED = "detected"
    INVESTIGATING = "investigating"
    PATCH_GENERATED = "patch_generated"
    DEPLOYING = "deploying"
    VERIFYING = "verifying"
    RESOLVED = "resolved"
    FAILED = "failed"


class TriggeringRequest(BaseModel):
    method: str
    path: str
    body: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, str]] = None


class Incident(BaseModel):
    incident_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    status: IncidentStatus = IncidentStatus.DETECTED
    stack_trace: str = ""
    error_message: str = ""
    faulty_file: Optional[str] = None
    faulty_line: Optional[int] = None
    triggering_request: Optional[TriggeringRequest] = None
    original_code: Optional[str] = None
    patched_code: Optional[str] = None
    resolution_time_ms: Optional[float] = None
    agents_involved: List[str] = Field(default_factory=list)
    status_history: List[Dict[str, str]] = Field(default_factory=list)
    
    def update_status(self, new_status: IncidentStatus, agent: str = ""):
        """Update incident status and record in history."""
        self.status = new_status
        self.status_history.append({
            "status": new_status.value,
            "timestamp": datetime.now().isoformat(),
            "agent": agent
        })
        if agent and agent not in self.agents_involved:
            self.agents_involved.append(agent)

    def to_ws_event(self, event_type: str = "incident_update") -> Dict[str, Any]:
        """Serialize for WebSocket broadcast to Observer Dashboard."""
        return {
            "type": event_type,
            "data": self.model_dump()
        }
