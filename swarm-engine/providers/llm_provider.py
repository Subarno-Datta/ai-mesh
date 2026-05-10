"""
LLM Provider Abstraction Layer

Supports multiple backends for code diagnosis:
  - ollama:      Local inference via Ollama (default)
  - huggingface: Hugging Face Inference API (free tier / Pro)
  - openai:      Any OpenAI-compatible API (OpenAI, Groq, Together, etc.)

Switch providers via the LLM_PROVIDER env var or at runtime from the dashboard.
"""
import json
import re
import sys
from pathlib import Path
from typing import Optional, List
from datetime import datetime

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    OLLAMA_BASE_URL, OLLAMA_MODEL,
    LLM_PROVIDER, HF_API_TOKEN, HF_MODEL_ID,
    OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL,
)


class LLMProvider:
    """Base interface for LLM providers."""

    async def query(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        raise NotImplementedError


class OllamaProvider(LLMProvider):
    """Local Ollama inference (chat API)."""

    def __init__(self, model: str = None, base_url: str = None):
        self.base_url = base_url or OLLAMA_BASE_URL
        self.model = model or OLLAMA_MODEL
        self.name = f"ollama/{self.model}"

    async def query(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "stream": False,
                        "options": {
                            "temperature": 0.1,
                            "num_predict": 2048
                        }
                    }
                )
                response.raise_for_status()
                result = response.json()
                return result.get("message", {}).get("content", "")
        except httpx.ConnectError:
            print(f"[LLM] Cannot connect to Ollama at {self.base_url}")
            print(f"[LLM] Make sure Ollama is running: `ollama serve`")
            return None
        except Exception as e:
            print(f"[LLM] Ollama query failed: {e}")
            return None


class HuggingFaceProvider(LLMProvider):
    """
    Hugging Face Inference API.
    
    Great models for code:
      - Qwen/Qwen2.5-Coder-32B-Instruct
      - bigcode/starcoder2-15b-instruct-v0.1
      - google/gemma-2-9b-it
      - mistralai/Mistral-7B-Instruct-v0.3
    """

    def __init__(self, api_token: str = None, model_id: str = None):
        self.api_token = api_token or HF_API_TOKEN
        self.model_id = model_id or HF_MODEL_ID
        self.name = f"huggingface/{self.model_id}"
        
        if not self.api_token:
            print("[LLM] WARNING: HF_API_TOKEN not set. Get one free at https://huggingface.co/settings/tokens")

    async def query(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        headers = {"Content-Type": "application/json"}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        api_url = "https://router.huggingface.co/novita/v3/openai/chat/completions"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        payload = {
            "model": self.model_id,
            "messages": messages,
            "max_tokens": 2048,
            "temperature": 0.1,
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(api_url, headers=headers, json=payload)

                if response.status_code in (422, 400):
                    print(f"[LLM] Chat API failed ({response.status_code}), trying text generation...")
                    return await self._query_text_generation(system_prompt, user_prompt, headers)

                response.raise_for_status()
                result = response.json()

                if "choices" in result:
                    return result["choices"][0].get("message", {}).get("content", "")
                if isinstance(result, list) and len(result) > 0:
                    return result[0].get("generated_text", "")
                return str(result)
        except httpx.ConnectError:
            print(f"[LLM] Cannot connect to Hugging Face API")
            return None
        except Exception as e:
            print(f"[LLM] Hugging Face query failed: {e}")
            return None

    async def _query_text_generation(self, system_prompt: str, user_prompt: str, headers: dict) -> Optional[str]:
        """Fallback to the text generation Inference API."""
        api_url = f"https://api-inference.huggingface.co/models/{self.model_id}"
        combined_prompt = f"### System:\n{system_prompt}\n\n### User:\n{user_prompt}\n\n### Assistant:\n"
        payload = {
            "inputs": combined_prompt,
            "parameters": {"max_new_tokens": 2048, "temperature": 0.1, "return_full_text": False}
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(api_url, headers=headers, json=payload)
                response.raise_for_status()
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    return result[0].get("generated_text", "")
                return str(result)
        except Exception as e:
            print(f"[LLM] HF text generation fallback failed: {e}")
            return None


class OpenAIProvider(LLMProvider):
    """
    Any OpenAI-compatible API.
    Works with: OpenAI, Groq, Together AI, Fireworks, OpenRouter, etc.
    """

    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        self.api_key = api_key or OPENAI_API_KEY
        self.base_url = (base_url or OPENAI_BASE_URL).rstrip("/")
        self.model = model or OPENAI_MODEL
        self.name = f"openai-compat/{self.model}"
        
        if not self.api_key:
            print(f"[LLM] WARNING: OPENAI_API_KEY not set for {self.base_url}")

    async def query(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 2048,
            "temperature": 0.1,
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers, json=payload
                )
                response.raise_for_status()
                result = response.json()
                return result["choices"][0]["message"]["content"]
        except httpx.ConnectError:
            print(f"[LLM] Cannot connect to {self.base_url}")
            return None
        except Exception as e:
            print(f"[LLM] OpenAI-compat query failed: {e}")
            return None


# --- Ollama Discovery ---

async def list_ollama_models(base_url: str = None) -> List[dict]:
    """Query Ollama for all available local models."""
    url = (base_url or OLLAMA_BASE_URL).rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{url}/api/tags")
            resp.raise_for_status()
            models = resp.json().get("models", [])
            return [
                {
                    "name": m["name"],
                    "size_gb": round(m.get("size", 0) / 1e9, 1),
                    "family": m.get("details", {}).get("family", "unknown"),
                    "params": m.get("details", {}).get("parameter_size", "unknown"),
                    "quantization": m.get("details", {}).get("quantization_level", "unknown"),
                }
                for m in models
            ]
    except Exception as e:
        print(f"[LLM] Could not list Ollama models: {e}")
        return []


# --- Response Parsing ---

def parse_llm_response(raw: str) -> Optional[dict]:
    """Parse the LLM response into a structured patch dict."""
    if not raw:
        return None

    # Try direct JSON parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code fence
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding a JSON object
    brace_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    print(f"[LLM] Could not parse response as JSON:\n{raw[:500]}")
    return None


# --- Factory ---

def create_provider(provider_name: str = None, **kwargs) -> LLMProvider:
    """
    Create an LLM provider.
    
    Can be called with defaults (from .env) or with runtime overrides:
        create_provider()                                     # from config
        create_provider("ollama", model="gemma4:e4b")         # specific local model
        create_provider("huggingface", api_token="hf_xxx")    # cloud
        create_provider("openai", api_key="sk-xxx", model="gpt-4o")
    """
    name = (provider_name or LLM_PROVIDER).lower()
    
    if name in ("huggingface", "hf"):
        provider = HuggingFaceProvider(
            api_token=kwargs.get("api_token"),
            model_id=kwargs.get("model_id")
        )
    elif name == "openai":
        provider = OpenAIProvider(
            api_key=kwargs.get("api_key"),
            base_url=kwargs.get("base_url"),
            model=kwargs.get("model")
        )
    else:
        provider = OllamaProvider(
            model=kwargs.get("model"),
            base_url=kwargs.get("base_url")
        )
    
    print(f"[LLM] Using provider: {provider.name}")
    return provider
