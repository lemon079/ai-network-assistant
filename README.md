# AI Network Assistant

An AI-powered chatbot that helps you manage and monitor your home router through natural language conversations. Built with Next.js, LangGraph, and supports multiple AI providers (Gemini, Ollama).

## Features

### 🔍 Network Monitoring

- View connected devices (hostname, IP, MAC address)
- Check DSL line quality (SNR, attenuation, speeds)
- Monitor WiFi and LAN statistics
- View DHCP leases and ARP tables

### ⚙️ Router Settings

- **WiFi Management**
  - Change WiFi name (SSID)
  - Change WiFi password
  - Enable/disable WiFi
  - Change WiFi channel
- **View Advanced Settings**
  - Parental controls
  - QoS settings
  - Firewall status
  - Dynamic DNS configuration

### 🤖 AI Capabilities

- Natural language interface
- Technical and non-technical response modes
- Safety guardrails (blocks dangerous requests)
- Confirmation required for destructive actions

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (NeonDB recommended)
- Ollama running locally (or Gemini API key)

### Installation

```bash
# Clone and install
git clone <repository-url>
cd ai-network-assistant
npm install

# Setup database
npx prisma generate
npx prisma db push

# Configure environment
cp .env.example .env.local
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# AI Provider (choose one)
LLM_PROVIDER=ollama
LLM_MODEL=gpt-oss:20b-cloud
OLLAMA_BASE_URL=http://localhost:11434

# Or use Gemini
# LLM_PROVIDER=gemini
# GOOGLE_GENERATIVE_AI_API_KEY=your-key
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Usage

1. **Login to Router**: Navigate to `/setup` and enter your router credentials
2. **Start Chatting**: Go to `/chat` and ask questions like:
   - "How many devices are connected?"
   - "What's my internet speed?"
   - "Change my WiFi password to NewPassword123"
   - "Is the firewall enabled?"

## Supported Routers

Currently supports:

- **PTCL DSL-226** (and similar models)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend  │────▶│   API Route  │────▶│  LangGraph Agent│
│  (Next.js)  │     │  /api/chat   │     │  (Tools + LLM)  │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────┐     ┌─────────▼────────┐
                    │   Database   │◀────│  Router Adapter  │
                    │   (Prisma)   │     │  (axios+cheerio) │
                    └──────────────┘     └──────────────────┘
```

## AI Providers

Switch providers easily in `lib/chat/llm-provider.ts`:

| Provider | Models | Notes |
|----------|--------|-------|
| **Ollama** | gpt-oss:20b-cloud | Local, free |
| **Gemini** | gemini-2.5-flash | Cloud, API key required |

## Safety Features

- **Input Guardrails**: Blocks hacking/exploit requests
- **Confirmation Required**: For WiFi changes, restart
- **Password Validation**: 8-63 character requirement
- **Output Sanitization**: Redacts sensitive data

## License

MIT
