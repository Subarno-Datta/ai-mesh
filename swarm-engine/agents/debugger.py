"""
Debugger Agent — The Solver

Phase 2 & 3 of the Aura-Mesh workflow.
Receives a detected incident from Sentinel, uses FileSystem MCP to read
the crash context, then uses the configured LLM provider to diagnose
the bug and generate a patch.

Supports multiple LLM backends via the provider abstraction:
  - Ollama (local GPU inference)
  - Hugging Face Inference API (cloud)
  - OpenAI-compatible APIs (OpenAI, Groq, Together, etc.)
"""
import json
import sys
import traceback
from pathlib import Path
from typing import Optional
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CONTEXT_LINES
from models.incident import Incident, IncidentStatus
from mcp_servers.filesystem_server import FileSystemMCP
from providers.llm_provider import create_provider, parse_llm_response


SYSTEM_PROMPT = "You are an expert Node.js/Express.js debugger. You respond ONLY with valid JSON objects, no markdown fences, no explanation text."

DIAGNOSIS_PROMPT = """Analyze the following server crash and provide a fix.

## Error Details
- **Error Message:** {error_message}
- **File:** {faulty_file}
- **Line:** {faulty_line}
- **Stack Trace:**
```
{stack_trace}
```

## Triggering Request
- Method: {method}
- Path: {path}
- Body: {body}

## Source Code (surrounding the crash)
```javascript
{source_context}
```

## Instructions
1. Identify the root cause of the crash.
2. Provide the EXACT original code snippet that needs to be replaced (copy it precisely).
3. Provide the patched code that fixes the bug.
4. The fix should be minimal — only change what's necessary.
5. Add proper null checks, validation, or error handling as needed.

## Response Format (STRICT JSON)
Respond ONLY with a JSON object, no markdown fences, no explanation text:
{{
  "diagnosis": "Brief explanation of the root cause",
  "original_code": "The exact original code snippet to replace",
  "patched_code": "The fixed replacement code",
  "confidence": 0.95
}}
"""


class DebuggerAgent:
    """
    Diagnoses crashes and generates code patches using LLM inference.
    Uses the configured LLM provider (Ollama, Hugging Face, or OpenAI-compat).
    """

    def __init__(self, filesystem_mcp: FileSystemMCP):
        self.name = "debugger"
        self.status = "idle"
        self.fs_mcp = filesystem_mcp
        self.patches_generated = 0
        self.llm = create_provider()

    async def diagnose_and_patch(self, incident: Incident) -> Incident:
        """
        Full Phase 2+3: Read crash context → LLM diagnosis → Generate patch.
        """
        self.status = "investigating"
        incident.update_status(IncidentStatus.INVESTIGATING, self.name)

        try:
            # Phase 2: Context Gathering
            print(f"[Debugger] 🔍 Reading crash context from {incident.faulty_file}:{incident.faulty_line}")
            source_context = self._read_context(incident)
            incident.original_code = source_context.get("full_content", "")

            # Phase 3: LLM Diagnosis & Patch Generation
            print(f"[Debugger] 🧠 Querying {self.llm.name} for diagnosis...")
            self.status = "generating_patch"
            patch_result = await self._query_llm(incident, source_context)

            if patch_result:
                incident.patched_code = json.dumps(patch_result, indent=2)
                incident.update_status(IncidentStatus.PATCH_GENERATED, self.name)
                self.patches_generated += 1
                print(f"[Debugger] ✅ Patch generated (confidence: {patch_result.get('confidence', 'N/A')})")
                print(f"[Debugger] 📋 Diagnosis: {patch_result.get('diagnosis', 'N/A')}")
            else:
                incident.update_status(IncidentStatus.FAILED, self.name)
                print(f"[Debugger] ❌ Failed to generate patch")

        except Exception as e:
            print(f"[Debugger] ❌ Error during diagnosis: {e}")
            traceback.print_exc()
            incident.update_status(IncidentStatus.FAILED, self.name)

        self.status = "idle"
        return incident

    def _read_context(self, incident: Incident) -> dict:
        """Use FileSystem MCP to read code around the crash site."""
        if not incident.faulty_file:
            files = self.fs_mcp.list_files()
            return {"lines": [], "full_content": "", "files": files}

        try:
            return self.fs_mcp.read_file_context(
                incident.faulty_file,
                incident.faulty_line or 1,
                CONTEXT_LINES
            )
        except (FileNotFoundError, PermissionError) as e:
            print(f"[Debugger] ⚠️ Could not read {incident.faulty_file}: {e}")
            return {"lines": [], "full_content": ""}

    async def _query_llm(self, incident: Incident, context: dict) -> Optional[dict]:
        """Send the diagnosis prompt to the configured LLM provider."""
        # Build context string with line numbers and error marker
        context_str = ""
        for line_info in context.get("lines", []):
            marker = " >>>" if line_info.get("is_error_line") else "    "
            context_str += f"{marker} {line_info['line_number']:>4} | {line_info['content']}\n"

        if not context_str and context.get("full_content"):
            context_str = context["full_content"]

        # Build the prompt
        trigger = incident.triggering_request
        user_prompt = DIAGNOSIS_PROMPT.format(
            error_message=incident.error_message or "Unknown error",
            faulty_file=incident.faulty_file or "unknown",
            faulty_line=incident.faulty_line or "unknown",
            stack_trace=incident.stack_trace or "No stack trace available",
            method=trigger.method if trigger else "UNKNOWN",
            path=trigger.path if trigger else "/unknown",
            body=json.dumps(trigger.body) if trigger and trigger.body else "{}",
            source_context=context_str or "No source context available"
        )

        # Query the LLM provider
        raw_response = await self.llm.query(SYSTEM_PROMPT, user_prompt)
        if raw_response:
            return parse_llm_response(raw_response)
        return None

    def get_state(self) -> dict:
        return {
            "agent": self.name,
            "status": self.status,
            "patches_generated": self.patches_generated,
            "llm_provider": self.llm.name,
            "timestamp": datetime.now().isoformat()
        }
