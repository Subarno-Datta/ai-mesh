#  Aura-Mesh: The Sentinel Protocol

> **Autonomous, Zero-Downtime Incident Resolution via Local Agentic Swarms**

A background AI daemon that monitors a live Express.js backend, intercepts fatal server crashes (500 errors) in real-time, autonomously patches the source code using local LLM inference, and hot-reloads the server—all before the human engineer even gets the PagerDuty alert.

## Architecture

```
┌──────────────────┐     ┌─────────────────────────────┐     ┌───────────────────────┐
│   Target API     │────▶│   Swarm Engine (Python)    │────▶│   Observer Dashboard  │
│  (Express.js)    │     │                            │      │  (React + Tailwind)   │
│                  │     │  ┌─────────┐ ┌─────────┐   │      │                       │
│  Buggy routes &  │     │  │Sentinel │→│Debugger │   │      │  Real-time agent      │
│  controllers     │     │  └─────────┘ └───-┬────┘   │      │  status, incident     │
│                  │◀────│ ┌─────────┐ ┌────▼────┐   │────▶ │ timeline, code diffs, │
│  Crash → Fix →   │     │  │Verifier │←│Deployer │   │      │  WS and live logs     │
│  Restart cycle   │     │  └─────────┘ └─────────┘   │      │                       │
└──────────────────┘     │                            │      └───────────────────────┘
                         │LogTail MCP │ FileSystem MCP│
                         └────────────────────────────┘
```

## Quick Start

### Prerequisites
- **Node.js** 18+
- **Python** 3.11+
- **Ollama** with a code model (e.g., `qwen2.5-coder:7b`)

### 1. Start Ollama
```bash
ollama serve
ollama pull qwen2.5-coder:7b
```

### 2. Install & Run Target API
```bash
cd target-api
npm install
```

### 3. Install & Run Swarm Engine
```bash
cd swarm-engine
pip install -r requirements.txt
python main.py             # Starts Target API + Swarm monitoring
python main.py --trigger-crash  # Auto-trigger a test crash
```

### 4. Start Observer Dashboard
```bash
cd observer-dashboard
npm install
npm run dev
```

Open **http://localhost:5173** to see the dashboard.

## How It Works

### The 5-Phase Autonomous Healing Loop

|       Phase         |   Agent   |                       Action                           |
|---------------------|-----------|--------------------------------------------------------|
| **1. Interception** |  Sentinel | Monitors stdout/stderr for 500 errors and stack traces |
| **2. Diagnosis**    |  Debugger | Reads crash context via FileSystem MCP, queries Ollama |
| **3. Refactoring**  |  Debugger | Generates patched code using local LLM inference       |
| **4. Deployment**   |  Deployer | Applies patch to file, restarts server                 |
| **5. Verification** |  Verifier | Replays crashing request, confirms 200 OK              |

### MCP Servers

- **LogTail MCP**: Manages the Node.js process lifecycle and streams structured JSON logs
- **FileSystem MCP**: Provides scoped read/write access to `routes/` and `controllers/` only

### Deliberate Bugs in Target API

| Bug | File | Trigger |
|-----|------|---------|
| Null `.name` access | `userController.js` | `POST /api/users` with `null` name |
| Missing user `.name` | `userController.js` | `GET /api/users/999` |
| Null `.bio.length` | `userController.js` | `PUT /api/users/1` with `null` bio |
| Undefined product | `productController.js` | `GET /api/products/999` |
| Unsafe RegExp | `productController.js` | `GET /api/products/search?q=[` |
| Division by zero | `productController.js` | `POST /api/products/1/discount` with 100% |
| `.map()` on undefined | `orderController.js` | `POST /api/orders` without items |
| `.reduce()` no init | `orderController.js` | `GET /api/orders/ORD-XXX/total` |

##  Core Features

- ** Sentinel Monitor** — Real-time log interception using LogTail MCP.
- ** Multi-Provider Intelligence** — Switch between local **Ollama** models or **Cloud AI** (Hugging Face, OpenAI, Groq) at runtime.
- ** Dynamic Target Project** — Resolve incidents in any local directory or **clone a GitHub repository** directly from the dashboard.
- ** Autonomous Self-Healing** — 5-phase resolution pipeline: Detection → Diagnosis → Patching → Hot-Reload → Verification.
- ** Man-in-the-Middle Protocol** — Optional Human-in-the-Loop (HITL) security layer to mandate user approval before patching code or installing repository dependencies.
- ** Observer Dashboard** — High-fidelity real-time visualization of the agentic swarm in action.

##  Observer Dashboard

- ** Live Control** — WebSocket connection for sub-minute incident response.
- ** Agent Monitoring** — Real-time status and telemetry for all 4 agents.
- ** Incident Lifecycle** — Feed of active and resolved incidents with detailed diagnostics.
- ** Code Diff Viewer** — Visual verification of LLM-generated patches vs. original buggy code.
- ** Precision Triggering** — Test the swarm with a library of pre-configured "logical landmine" crashes.
- ** Advanced Settings** — Change LLM models, input cloud API keys, or switch target repositories on the fly.

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Logic Engine** | Python 3.11 (Asyncio) |
| **Intelligence** | Ollama (Local), Hugging Face, OpenAI-Compatible APIs |
| **Interface** | React 19, Vite, Tailwind CSS |
| **Communication** | WebSockets (Real-time), MCP (Model Context Protocol) |
| **Runtime** | Node.js / Express (Target Environment) |

---
*No license required.*
