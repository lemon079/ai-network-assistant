# AI Network Assistant

An AI-powered chatbot that helps you manage and monitor your home router through natural language conversations. Just tell the AI what you need, and it handles the rest.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![LangGraph](https://img.shields.io/badge/LangGraph-Agent-orange)

## ✨ Features

### 🔍 Network Monitoring

- View connected devices (hostname, IP, MAC address)
- Check DSL line quality (SNR, attenuation, speeds)
- Monitor WiFi and LAN statistics
- View DHCP leases and ARP tables

### ⚙️ Router Control

- **WiFi Management**: Change SSID, password, enable/disable, change channel
- **Device Blocking**: Block/unblock devices by MAC address
- **Port Forwarding**: Add port forwarding rules
- **QoS**: Enable/disable Quality of Service
- **DHCP**: Enable/disable DHCP server
- **Router Reboot**: Restart the router remotely

### 🛡️ Safety & Security

- Confirmation required for destructive actions
- Input guardrails block dangerous requests
- Session-based authentication via httpOnly cookies
- Password validation (8-63 characters)
- Output sanitization redacts sensitive data

### 🤖 AI Features

- Natural language interface - just talk normally
- Real-time response streaming (word-by-word)
- Reasoning trace shows what the AI is doing
- Politely redirects off-topic questions
- Multiple AI providers (Gemini, Ollama)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Ollama running locally OR Gemini API key

### Installation

```bash
# Clone and install
git clone https://github.com/lemon079/ai-network-agent.git
cd ai-network-agent
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
# AI Provider (choose one)

# Option 1: Ollama (local, free)
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434

# Option 2: Gemini (cloud, requires API key)
# LLM_PROVIDER=gemini
# LLM_MODEL=gemini-2.0-flash
# GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

### Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📖 Usage

1. **Connect Router**: Go to `/setup` and enter your router IP and credentials
2. **Start Chatting**: You'll be redirected to `/chat` automatically
3. **Ask Questions**: Try these:
   - "How many devices are connected?"
   - "Show me my WiFi settings"
   - "What's the signal quality?"
   - "Block the device with MAC AA:BB:CC:DD:EE:FF"
   - "Change my WiFi password to SecurePass123"

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Next.js   │────▶│  /api/chat   │────▶│  LangGraph      │
│   Frontend  │ SSE │   (SSE)      │     │  Agent + Tools  │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────┐     ┌─────────▼────────┐
                    │   Session    │◀────│  Router Adapter  │
                    │   (Cookie)   │     │  (axios+cheerio) │
                    └──────────────┘     └──────────────────┘
```

**Key Components:**

- `lib/adapters/zte.ts` - Router communication layer
- `lib/chat/stream-agent.ts` - LangGraph agent with streaming
- `lib/chat/tools.ts` - LangChain tools for router actions
- `lib/chat/guardrails.ts` - Safety checks and redactions

## 🔌 Supported Routers

| Router | Status |
|--------|--------|
| ZTE DSL-226 | ✅ Full Support |
| Similar ZTE models | ✅ Should work |

*More router adapters can be added in `lib/adapters/`*

## 🤖 AI Providers

| Provider | Models | Notes |
|----------|--------|-------|
| **Ollama** | llama3.2, mistral, codellama | Free, runs locally |
| **Gemini** | gemini-2.0-flash, gemini-1.5-pro | Fast, requires API key |

Switch providers in `.env.local` or `lib/chat/llm-provider.ts`

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/          # Auth check & logout
│   │   ├── chat/          # SSE chat endpoint
│   │   └── setup/         # Router detection & login
│   ├── chat/              # Chat page (protected)
│   └── setup/             # Router login page
├── components/
│   └── chat/              # Chat UI components
├── lib/
│   ├── adapters/          # Router adapters
│   │   ├── zte.ts         # ZTE router implementation
│   │   └── types.ts       # TypeScript interfaces
│   ├── chat/              # AI agent logic
│   │   ├── stream-agent.ts
│   │   ├── tools.ts
│   │   ├── guardrails.ts
│   │   └── prompts.ts
│   └── router/            # Session management
└── docs/
    └── TEST_PROMPTS.md    # Example prompts for testing
```

## 🧪 Testing

See [docs/TEST_PROMPTS.md](docs/TEST_PROMPTS.md) for a list of prompts to test all features.

## 📝 License

MIT
