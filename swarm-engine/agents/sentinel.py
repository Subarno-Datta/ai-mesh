"""
Sentinel Agent — The Monitor

Phase 1 of the Aura-Mesh workflow.
Constantly monitors the LogTail MCP stream. Triggers a high-priority event
the moment a stack trace containing "Error:" or status code 500 is detected.
Extracts the exact file name, line number, and request payload.
"""
import re
import sys
from pathlib import Path
from typing import Optional, Callable, Awaitable
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))
from models.incident import Incident, IncidentStatus, TriggeringRequest


class SentinelAgent:
    """
    Monitors the log stream for errors and creates Incident objects.
    """

    def __init__(self):
        self.name = "sentinel"
        self.status = "idle"
        self.incidents_detected = 0
        self.on_incident: Optional[Callable[[Incident], Awaitable[None]]] = None
        self._processing = False

    async def process_log_entry(self, log_entry: dict):
        """
        Analyze a single log entry for error patterns.
        Called as a subscriber callback on the LogTail MCP.
        """
        if self._processing:
            return  # Prevent re-entrant processing

        is_error = False

        # Check for structured JSON error logs
        if log_entry.get("type") == "error" or log_entry.get("level") == "error":
            is_error = True
        
        # Check for 500 status codes
        if log_entry.get("statusCode", 0) >= 500:
            is_error = True

        # Check raw output for error patterns
        raw = log_entry.get("_raw", "") or log_entry.get("message", "")
        if "Error:" in raw or "TypeError:" in raw or "ReferenceError:" in raw:
            is_error = True

        if is_error and self.on_incident:
            self._processing = True
            self.status = "detecting"
            try:
                incident = self._create_incident(log_entry)
                if incident:
                    self.incidents_detected += 1
                    print(f"[Sentinel] 🚨 Incident #{self.incidents_detected} detected: {incident.error_message}")
                    await self.on_incident(incident)
            finally:
                self._processing = False
                self.status = "idle"

    def _create_incident(self, log_entry: dict) -> Optional[Incident]:
        """Extract incident details from a log entry."""
        stack_trace = log_entry.get("stack", "")
        error_message = log_entry.get("message", "")
        
        # Extract file and line from stack trace
        faulty_file = log_entry.get("file") or self._extract_file(stack_trace)
        faulty_line = log_entry.get("line") or self._extract_line(stack_trace)

        # Build triggering request
        triggering_request = None
        if log_entry.get("method") or log_entry.get("request_body"):
            triggering_request = TriggeringRequest(
                method=log_entry.get("method", "UNKNOWN"),
                path=log_entry.get("path", "/unknown"),
                body=log_entry.get("request_body")
            )

        incident = Incident(
            status=IncidentStatus.DETECTED,
            stack_trace=stack_trace,
            error_message=error_message,
            faulty_file=faulty_file,
            faulty_line=faulty_line,
            triggering_request=triggering_request
        )
        incident.update_status(IncidentStatus.DETECTED, self.name)
        return incident

    def _extract_file(self, stack_trace: str) -> Optional[str]:
        """Extract the first relevant filename from a stack trace."""
        if not stack_trace:
            return None
        # Match file paths in the target-api directory
        patterns = [
            r'at\s+\S+\s+\((.+?controllers/.+?\.js):\d+:\d+\)',
            r'at\s+\S+\s+\((.+?routes/.+?\.js):\d+:\d+\)',
            r'at\s+(.+?controllers/.+?\.js):\d+:\d+',
            r'at\s+(.+?routes/.+?\.js):\d+:\d+',
        ]
        for pattern in patterns:
            match = re.search(pattern, stack_trace)
            if match:
                return match.group(1)
        return None

    def _extract_line(self, stack_trace: str) -> Optional[int]:
        """Extract the line number from the first relevant frame."""
        if not stack_trace:
            return None
        patterns = [
            r'(?:controllers|routes)/.+?\.js:(\d+):\d+',
        ]
        for pattern in patterns:
            match = re.search(pattern, stack_trace)
            if match:
                return int(match.group(1))
        return None

    def get_state(self) -> dict:
        """Return current agent state for the Observer Dashboard."""
        return {
            "agent": self.name,
            "status": self.status,
            "incidents_detected": self.incidents_detected,
            "timestamp": datetime.now().isoformat()
        }
