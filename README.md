# 🐦 Birdly — Stealth AI Performance Coach

> **100% local. 100% free. 100% open-source.**
> Real-time AI coaching during calls, interviews, negotiations — invisible to screen-sharing tools.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-31-blue)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://reactjs.org)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎤 **Live STT** | Whisper (Xenova/tiny) transcribes your mic in real-time |
| 🖥️ **Screen OCR** | Captures screen text as context via tesseract.js |
| 💡 **AI Coaching** | Local LLM (Ollama) generates instant suggestions |
| 📚 **Knowledge Base** | Upload PDFs, DOCX, TXT, MD — embedded & searched locally |
| 👻 **Stealth Overlay** | Invisible to Zoom/Teams/Meet screen-sharing |
| 🔒 **100% Private** | No telemetry, no cloud, no accounts |
| ✉️ **Post-Meeting** | Auto-generate summaries, action items, follow-up emails |
| 🎭 **Role Templates** | Sales, Interview, Negotiation, Technical, Public Speaking |

---

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** — [nodejs.org](https://nodejs.org)
2. **Ollama** (local LLM server) — [ollama.com](https://ollama.com)

### Step 1: Install Ollama

#### macOS / Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

#### Windows
Download the installer from [ollama.com/download](https://ollama.com/download/windows)

### Step 2: Download a Model

```bash
# Recommended: Fast, great quality (4.7GB)
ollama pull llama3.2

# Lighter option for slower machines (2.3GB)
ollama pull phi3:mini

# Best reasoning (5.5GB)
ollama pull gemma2

# Fastest responses (1.5GB)
ollama pull qwen2.5:1.5b

# Verify Ollama is running
ollama list
```

> 💡 **Model Recommendations:**
> - **Interviews / Sales**: `llama3.2` or `gemma2`
> - **Low-RAM machines** (<8GB): `phi3:mini` or `qwen2.5:1.5b`
> - **Best overall**: `llama3.2:3b`

### Step 3: Clone & Install Birdly

```bash
git clone https://github.com/your-org/birdly.git
cd birdly
npm install
```

### Step 4: Run in Development Mode

```bash
# Start Ollama first (keep running in background)
ollama serve

# In another terminal, start Birdly
npm run dev
```

On first run, Birdly auto-downloads:
- **Whisper tiny** model (~75MB) for speech-to-text
- **all-MiniLM-L6-v2** (~90MB) for knowledge base embeddings

Models are cached in your app data directory and never re-downloaded.

---

## 📦 Build Distributables

```bash
# Build for current platform
npm run dist

# Platform-specific builds
npm run dist:win    # Windows NSIS installer + portable
npm run dist:mac    # macOS DMG + ZIP
npm run dist:linux  # AppImage + DEB
```

Output is in the `release/` directory.

---

## 🎮 Usage Guide

### Starting a Live Session

1. Launch Birdly
2. Make sure Ollama is running (`ollama serve`)
3. Select your model and coaching role at the top
4. Click **Start Session** ⚡
5. The stealth overlay appears on-screen (invisible to meeting participants)
6. Speak naturally — Birdly transcribes and generates coaching suggestions in real-time

### 🛡 Floating Widget Controls & Resume Upload (v2.0.9)

Birdly now ships with a Cluely-style floating widget that stays always-on-top, remains hidden from common screen-share tools, and only becomes mouse-interactive when you intentionally unlock it.

| Action | How / Shortcut |
|--------|----------------|
| **Show/Hide overlay** | `Ctrl+Shift+B` (Win/Linux) or `Cmd+Shift+B` (Mac) |
| **Temporarily unlock widget** | `Ctrl+\` (Win/Linux) or `Cmd+\` (Mac) |
| **Move widget** | Hover the thin top drag handle, then drag |
| **Minimize/Expand** | Click `▲` / `▼` |
| **Assist** | Click button or press **`1`** while the widget is interactive |
| **What should I say?** | Click button or press **`2`** |
| **Follow-up questions** | Click button or press **`3`** |
| **Recap** | Click button or press **`4`** |
| **Custom query** | Type in the widget input and press `Enter` |
| **Add PDF Resume** | Click `Add PDF` inside the widget or use Settings / Knowledge |

Birdly answers every action directly inside the floating widget. Responses use:
- the last ~30 seconds of transcript
- the latest OCR screen context
- your uploaded resume
- your local knowledge-base documents

The widget defaults to mouse passthrough so it does not block your underlying apps. Hovering the top drag strip or pressing the interaction hotkey unlocks it for a few seconds so you can click, type, or reposition it.

### 📚 Knowledge Base & Resume Upload

Birdly works best when it knows who you are and what you are talking about.

1. Go to **Settings** or **Knowledge**
2. Drag a PDF resume onto the dedicated resume drop zone, or click **Add PDF Resume**
3. Birdly parses the file locally, stores the extracted text in settings, and indexes it in the local RAG store as `resume` context
4. Paste a job description or scope anchor to keep outputs tightly on-topic
5. Drag and drop supporting documents into the Knowledge Base for additional local retrieval

### Post-Meeting

After ending a session:
1. Go to **Post-Meeting** tab (📝)
2. **Generate Summary** → executive summary + action items
3. **Draft Email** → professional follow-up email (editable)
4. Export as Markdown

---

## 🏗️ Project Structure

```
birdly/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # Window creation, hotkeys, tray
│   │   ├── ipcHandlers.ts    # All IPC + coaching engine
│   │   ├── llm.ts            # Ollama wrapper (chat + streaming)
│   │   ├── stt.ts            # Whisper STT service
│   │   ├── ocr.ts            # Tesseract.js OCR service
│   │   ├── rag.ts            # RAG: embeddings + vector search
│   │   └── settings.ts       # Persistent settings store
│   ├── preload/
│   │   └── preload.ts        # contextBridge API (type-safe)
│   └── renderer/             # React frontend
│       ├── App.tsx           # Root component + sidebar nav
│       ├── components/
│       │   └── FloatingWidget.tsx  # Stealth overlay UI
│       └── pages/
│           ├── Dashboard.tsx       # Live session view
│           ├── Settings.tsx        # Settings panel
│           ├── KnowledgeBase.tsx   # Document manager
│           └── PostMeeting.tsx     # Summary & email generator
├── assets/                   # App icons
├── package.json
├── vite.config.ts
└── tailwind.config.cjs
```

---

## ⚙️ Configuration

All settings are stored in your OS app data directory (no cloud sync):
- **Windows**: `%APPDATA%\Birdly\birdly-settings.json`
- **macOS**: `~/Library/Application Support/Birdly/birdly-settings.json`
- **Linux**: `~/.config/Birdly/birdly-settings.json`

Key settings:
- `model` — Ollama model name
- `temperature` — LLM creativity (0.3 focused, 0.9 creative)
- `systemPrompt` — Override the coaching system prompt
- `overlayOpacity` — Overlay transparency
- `screenCaptureInterval` — How often to OCR the screen (seconds)

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

---

## 🔒 Privacy

- ✅ All AI processing runs locally on your machine
- ✅ No accounts, no sign-up, no API keys required
- ✅ Zero telemetry or analytics
- ✅ Meeting recordings never leave your device
- ✅ Knowledge base stored locally in app data

---

## 📜 License

MIT © 2024 Birdly Contributors — [LICENSE](LICENSE)

---

> Made with ❤️ as a free, open-source alternative to Cluely.
> If this helps you land that job, close that deal, or nail that negotiation — give it a ⭐!
