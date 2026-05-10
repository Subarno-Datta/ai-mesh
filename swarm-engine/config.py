"""
Aura-Mesh Swarm Engine Configuration

Supports dynamic target paths (local directory or GitHub URL)
and multiple LLM providers with runtime switching.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths
BASE_DIR = Path(__file__).parent
DEFAULT_TARGET_DIR = BASE_DIR.parent / "target-api"

# Dynamic target path — can be changed at runtime via dashboard
TARGET_API_DIR = Path(os.getenv("TARGET_PATH", str(DEFAULT_TARGET_DIR)))
ROUTES_DIR = TARGET_API_DIR / "routes"
CONTROLLERS_DIR = TARGET_API_DIR / "controllers"

# Where GitHub repos get cloned to
CLONE_DIR = BASE_DIR / ".cloned_repos"

# Target API
TARGET_API_URL = os.getenv("TARGET_API_URL", "http://localhost:4000")
TARGET_API_PORT = int(os.getenv("TARGET_API_PORT", "4000"))
TARGET_ENTRY_POINT = os.getenv("TARGET_ENTRY_POINT", "server.js")

# Ollama (local)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4e2b-forced:latest")

# LLM Provider: "ollama" | "huggingface" | "openai"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")

# Hugging Face Inference API
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")
HF_MODEL_ID = os.getenv("HF_MODEL_ID", "Qwen/Qwen2.5-Coder-32B-Instruct")

# OpenAI-compatible API (OpenAI, Groq, Together, OpenRouter, etc.)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# WebSocket server for Observer Dashboard
WS_HOST = os.getenv("WS_HOST", "0.0.0.0")
WS_PORT = int(os.getenv("WS_PORT", "8765"))

# Swarm settings
LOG_POLL_INTERVAL = float(os.getenv("LOG_POLL_INTERVAL", "0.5"))  # seconds
CONTEXT_LINES = int(os.getenv("CONTEXT_LINES", "50"))  # lines around crash
MAX_PATCH_RETRIES = int(os.getenv("MAX_PATCH_RETRIES", "3"))

# Allowed file scope for MCP FileSystem
ALLOWED_DIRS = [str(ROUTES_DIR), str(CONTROLLERS_DIR)]
