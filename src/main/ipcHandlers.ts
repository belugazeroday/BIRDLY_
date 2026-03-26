import {
  ipcMain,
  BrowserWindow,
  desktopCapturer,
  dialog,
  shell,
} from 'electron'
import path from 'path'
import fs from 'fs'
import { Ollama } from 'ollama'
import { LLMService } from './llm'
import { STTService } from './stt'
import { OCRService } from './ocr'
import { RAGService, type DocumentKind } from './rag'
import { SettingsStore } from './settings'

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' })
const QUICK_ACTIONS = [
  'assist',
  'what-to-say',
  'follow-up',
  'recap',
  'screenshot',
  'custom',
] as const

type QuickCoachAction = (typeof QUICK_ACTIONS)[number]
type TranscriptEntry = { text: string; timestamp: number }
type ScreenContextEntry = { text: string; timestamp: number }

let sttService: STTService | null = null
let ocrService: OCRService | null = null
let ragService: RAGService | null = null
let llmService: LLMService | null = null
let settingsStore: SettingsStore | null = null

let sessionActive = false
let sessionTranscript: TranscriptEntry[] = []
let sessionScreenTexts: ScreenContextEntry[] = []
let ocrInterval: ReturnType<typeof setInterval> | null = null
let sessionStartedAt = 0
let firstTranscriptLatencyMs: number | null = null

export function setupIpcHandlers(
  mainWindow: BrowserWindow | null,
  overlayWindow: BrowserWindow | null
) {
  settingsStore = new SettingsStore()
  llmService = new LLMService(ollama, settingsStore)
  ragService = new RAGService()
  sttService = new STTService((transcript) => {
    pushTranscriptEntry(transcript)

    if (sessionActive && firstTranscriptLatencyMs === null && sessionStartedAt > 0) {
      firstTranscriptLatencyMs = Date.now() - sessionStartedAt
      broadcast(mainWindow, overlayWindow, 'session-metric', {
        firstTranscriptLatencyMs,
      })
    }

    mainWindow?.webContents.send('stt-transcript', transcript)
    overlayWindow?.webContents.send('stt-transcript', transcript)

    if (sessionActive) {
      triggerCoaching(mainWindow, overlayWindow)
    }
  })
  ocrService = new OCRService()

  ipcMain.handle('ollama-chat', async (_e, payload) => {
    try {
      return await llmService!.chat(payload)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('ollama-stream', async (e, payload) => {
    const { channel, ...rest } = payload
    try {
      await llmService!.stream(rest, (chunk: string) => {
        e.sender.send(channel, chunk)
      })
    } catch (err) {
      e.sender.send(channel, `[ERROR] ${(err as Error).message}`)
    }
  })

  ipcMain.handle('ollama-list-models', async () => {
    try {
      const list = await ollama.list()
      return list.models
    } catch {
      return []
    }
  })

  ipcMain.on('stt-start', () => sttService?.start())
  ipcMain.on('stt-stop', () => sttService?.stop())
  ipcMain.on('stt-audio-chunk', async (_e, audioData: number[]) => {
    try {
      await sttService?.processAudioChunk(audioData)
    } catch (err) {
      const message = `[STT] ${(err as Error).message}`
      broadcast(mainWindow, overlayWindow, 'pipeline-error', message)
    }
  })

  ipcMain.handle('ocr-capture', async () => {
    try {
      const text = await captureLatestScreenText(mainWindow, overlayWindow, true)
      return { text }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('kb-add-document', async (_e, filePath: string) => {
    return ragService!.addDocument(filePath, { kind: 'knowledge' })
  })

  ipcMain.handle('kb-remove-document', async (_e, id: string) => {
    return ragService!.removeDocument(id)
  })

  ipcMain.handle('kb-list-documents', async (_e, options?: { kinds?: DocumentKind[] }) => {
    return ragService!.listDocuments(options)
  })

  ipcMain.handle('kb-query', async (_e, { query, topK, kinds }) => {
    return ragService!.query(query, topK ?? 3, { kinds })
  })

  ipcMain.handle('session-start', async () => {
    sessionActive = true
    sessionStartedAt = Date.now()
    firstTranscriptLatencyMs = null
    sessionTranscript = []
    sessionScreenTexts = []
    broadcast(mainWindow, overlayWindow, 'pipeline-status', {
      stt: 'warming',
      ocr: 'warming',
    })
    broadcast(mainWindow, overlayWindow, 'session-state', {
      active: sessionActive,
      transcriptLength: 0,
    })
    void warmupPipelines(mainWindow, overlayWindow)
    sttService?.start()
    startOcrLoop(mainWindow, overlayWindow)
    return { started: true }
  })

  ipcMain.handle('session-stop', async () => {
    sessionActive = false
    sttService?.stop()
    stopOcrLoop()
    broadcast(mainWindow, overlayWindow, 'pipeline-status', {
      stt: 'idle',
      ocr: 'idle',
    })
    broadcast(mainWindow, overlayWindow, 'session-state', {
      active: sessionActive,
      transcriptLength: sessionTranscript.length,
    })
    return { stopped: true }
  })

  ipcMain.handle('session-get-state', () => ({
    active: sessionActive,
    transcriptLength: sessionTranscript.length,
  }))

  ipcMain.handle(
    'coach-quick-action',
    async (_e, action: QuickCoachAction, customText?: string) => {
      try {
        if (!llmService || !settingsStore || !ragService) {
          return { error: 'Coach engine unavailable' }
        }

        if (!QUICK_ACTIONS.includes(action)) {
          return { error: `Unsupported action: ${action}` }
        }

        const context = await buildCoachingContext(mainWindow, overlayWindow, {
          seedQuery: customText || getRecentTranscriptText(),
          captureFreshScreen: action === 'assist' || action === 'screenshot',
        })

        const response = await llmService.chat({
          model: context.settings.model,
          system: context.systemPrompt,
          messages: [
            {
              role: 'user',
              content: `ACTION:\n${getQuickActionInstruction(action, customText)}

MODE:\n${context.settings.outputMode}\n${getModeInstruction(context.settings.outputMode)}

SCOPE RULE:\n${context.scopeInstruction}

JOB DESCRIPTION:\n${context.jobDescription || 'N/A'}

RECENT TRANSCRIPT (last 30s):\n${context.transcriptWindow || 'N/A'}

LATEST SCREEN CONTEXT:\n${context.screenContext || 'N/A'}

RELEVANT KNOWLEDGE BASE:\n${context.kbContext || 'N/A'}

Return concise markdown bullets suitable for a small floating widget.`
            },
          ],
        })

        return response
      } catch (err) {
        return { error: (err as Error).message }
      }
    }
  )

  ipcMain.handle('post-generate-summary', async () => {
    const settings = settingsStore!.get()
    const transcript = sessionTranscript.map((entry) => entry.text).join('\n')
    const kbContext = await ragService!.query(transcript.slice(0, 500), 3, {
      kinds: ['knowledge', 'resume'],
    })
    const kbText = kbContext.map((result) => result.content).join('\n\n')
    const prompt = `You are a meeting assistant. Generate a concise summary and action items from this meeting transcript.

Knowledge Context:
${kbText}

Transcript:
${transcript}

Provide:
1. Executive Summary (3-5 sentences)
2. Key Discussion Points
3. Action Items (with owners if mentioned)
4. Next Steps`

    return llmService!.chat({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
    })
  })

  ipcMain.handle('post-generate-email', async () => {
    const settings = settingsStore!.get()
    const transcript = sessionTranscript.map((entry) => entry.text).join('\n')
    const kbContext = await ragService!.query(transcript.slice(0, 500), 3, {
      kinds: ['knowledge', 'resume'],
    })
    const kbText = kbContext.map((result) => result.content).join('\n\n')
    const prompt = `Draft a professional follow-up email based on this meeting transcript.

Context:
${kbText}

Transcript:
${transcript}

Write a concise, professional follow-up email covering key points and next steps.`

    return llmService!.chat({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
    })
  })

  ipcMain.handle('post-export-md', async (_e, { content, filename }) => {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Markdown',
      defaultPath: filename,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (filePath) {
      fs.writeFileSync(filePath, content, 'utf-8')
      shell.showItemInFolder(filePath)
    }
    return { saved: !!filePath }
  })

  ipcMain.handle('settings-get', () => settingsStore!.get())
  ipcMain.handle('settings-save', (_e, settings) => {
    settingsStore!.save(settings)
    return { saved: true }
  })

  ipcMain.handle('profile-upload-resume', async (_e, filePath: string) => {
    try {
      const text = await parseDocumentText(filePath)
      if (!text.trim()) {
        return { success: false, error: 'No extractable text found in file.' }
      }

      ragService!.removeDocumentsByKind('resume')
      await ragService!.addTextDocument(path.basename(filePath), text, {
        kind: 'resume',
        path: filePath,
      })

      settingsStore!.save({
        resumeText: text.trim(),
        resumeFileName: path.basename(filePath),
      })

      broadcast(mainWindow, overlayWindow, 'resume-state-changed', {
        fileName: path.basename(filePath),
        loaded: true,
      })
      broadcast(mainWindow, overlayWindow, 'widget-toast', {
        tone: 'success',
        message: 'Resume loaded — I now know who you are',
      })

      return { success: true, fileName: path.basename(filePath) }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('profile-clear-resume', async () => {
    ragService!.removeDocumentsByKind('resume')
    settingsStore!.save({ resumeText: '', resumeFileName: '' })
    broadcast(mainWindow, overlayWindow, 'resume-state-changed', {
      fileName: '',
      loaded: false,
    })
    broadcast(mainWindow, overlayWindow, 'widget-toast', {
      tone: 'info',
      message: 'Resume removed from Birdly context',
    })
    return { success: true }
  })

  ipcMain.handle('dialog-open-file', async (_e, filters) => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: filters ?? [
        {
          name: 'Knowledge Files',
          extensions: ['pdf', 'txt', 'md', 'docx', 'png', 'jpg', 'jpeg', 'webp'],
        },
      ],
    })
    return filePaths
  })
}

let coachingDebounce: ReturnType<typeof setTimeout> | null = null

async function triggerCoaching(
  mainWindow: BrowserWindow | null,
  overlayWindow: BrowserWindow | null
) {
  if (coachingDebounce) {
    clearTimeout(coachingDebounce)
  }

  coachingDebounce = setTimeout(async () => {
    try {
      if (!llmService || !ragService || !settingsStore) return

      const context = await buildCoachingContext(mainWindow, overlayWindow, {
        seedQuery: getRecentTranscriptText(),
      })
      if (!context.transcriptWindow.trim()) return

      let suggestion = ''
      await llmService.stream(
        {
          model: context.settings.model,
          system: context.systemPrompt,
          messages: [
            {
              role: 'user',
              content: `OUTPUT MODE:\n${context.settings.outputMode}\n${getModeInstruction(
                context.settings.outputMode
              )}

SCOPE RULE:\n${context.scopeInstruction}

JOB DESCRIPTION:\n${context.jobDescription || 'N/A'}

LIVE TRANSCRIPT (last 30s):\n${context.transcriptWindow}

SCREEN CONTENT:\n${context.screenContext || 'N/A'}

KNOWLEDGE BASE:\n${context.kbContext || 'N/A'}

Provide 1-3 concise, actionable coaching suggestions RIGHT NOW.
- Use bullets
- Max 2 sentences each
- Prioritize the single next best move`
            },
          ],
        },
        (chunk) => {
          suggestion += chunk
          overlayWindow?.webContents.send('coaching-chunk', chunk)
          mainWindow?.webContents.send('coaching-chunk', chunk)
        }
      )

      overlayWindow?.webContents.send('coaching-suggestion', suggestion)
      mainWindow?.webContents.send('coaching-suggestion', suggestion)
    } catch (err) {
      console.error('[Coaching] Error:', err)
    }
  }, 1100)
}

const DEFAULT_COACHING_PROMPT = `You are Birdly, a real-time AI performance coach. Your role is to provide instant, actionable coaching suggestions during conversations, meetings, interviews, and negotiations.

Focus on:
- Addressing objections or concerns raised
- Suggesting talking points based on context
- Highlighting opportunities being missed
- Recommending next actions

Style: Ultra-concise, practical, and high-signal.`

function getModeInstruction(mode: string): string {
  switch (mode) {
    case 'interview':
      return 'Focus on interview answers, STAR structure, and concise impact statements.'
    case 'sales':
      return 'Focus on objection handling, value framing, and next-step closes.'
    case 'negotiation':
      return 'Focus on leverage, concessions, BATNA framing, and win-win proposals.'
    case 'coding':
      return 'Focus on technical reasoning, edge cases, and implementation-ready hints.'
    default:
      return 'Provide broadly useful live coaching suggestions.'
  }
}

function getQuickActionInstruction(action: QuickCoachAction, customText?: string): string {
  switch (action) {
    case 'assist':
      return 'Act like a premium real-time copilot. Give the single best immediate thing to say or do next, then one backup option.'
    case 'what-to-say':
      return 'Give me a strong immediate response I can say now. Include a short version first, then a slightly expanded version.'
    case 'follow-up':
      return 'Give 3 sharp follow-up questions I can ask next based on the current conversation.'
    case 'recap':
      return 'Give a concise recap of key points, risks, and the recommended next step.'
    case 'screenshot':
      return 'Analyze the latest screen context and give a 1-2 sentence actionable insight.'
    case 'custom':
      return `Answer this custom request strictly from the available transcript, screen context, resume, and documents: "${customText || ''}"`
    default:
      return 'Provide a useful coaching response.'
  }
}

function pushTranscriptEntry(text: string) {
  sessionTranscript.push({ text, timestamp: Date.now() })
  if (sessionTranscript.length > 80) {
    sessionTranscript = sessionTranscript.slice(-80)
  }
}

function pushScreenContext(text: string) {
  sessionScreenTexts.push({ text, timestamp: Date.now() })
  if (sessionScreenTexts.length > 24) {
    sessionScreenTexts = sessionScreenTexts.slice(-24)
  }
}

function getRecentTranscriptText(windowMs = 30000, fallbackCount = 12) {
  const now = Date.now()
  const recent = sessionTranscript.filter((entry) => now - entry.timestamp <= windowMs)
  const selected = recent.length > 0 ? recent : sessionTranscript.slice(-fallbackCount)
  return selected.map((entry) => entry.text).join('\n')
}

function getRecentScreenText(windowMs = 45000, fallbackCount = 3) {
  const now = Date.now()
  const recent = sessionScreenTexts.filter((entry) => now - entry.timestamp <= windowMs)
  const selected = recent.length > 0 ? recent : sessionScreenTexts.slice(-fallbackCount)
  return selected.map((entry) => entry.text).join('\n')
}

function limitText(text: string, maxChars: number) {
  const normalized = text.trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars)}…`
}

async function buildCoachingContext(
  mainWindow: BrowserWindow | null,
  overlayWindow: BrowserWindow | null,
  options: { seedQuery?: string; captureFreshScreen?: boolean } = {}
) {
  const settings = settingsStore!.get()
  const transcriptWindow = getRecentTranscriptText()
  let screenContext = getRecentScreenText()

  if (options.captureFreshScreen) {
    const freshScreenContext = await captureLatestScreenText(mainWindow, overlayWindow, true)
    screenContext = freshScreenContext || screenContext
  }

  const jobDescription = settings.jobDescription?.trim() || ''
  const resumeText = settings.resumeText?.trim() || ''
  const scopeInstruction =
    settings.strictScope && jobDescription
      ? 'Stay strictly within the job description, resume, transcript, and screen context. If unsupported, say so clearly.'
      : 'Stay grounded in the available context and prefer direct, practical help.'
  const kbSeed = [
    options.seedQuery || '',
    transcriptWindow,
    screenContext,
    jobDescription,
    resumeText,
  ]
    .filter(Boolean)
    .join('\n')

  const kbResults = await ragService!.query(kbSeed || 'general context', 4, {
    kinds: ['knowledge', 'resume'],
  })
  const kbContext = kbResults
    .map((result) => `[${result.kind.toUpperCase()} · ${result.docName}]\n${result.content}`)
    .join('\n\n')

  const systemPrompt = buildSystemPrompt(
    settings.systemPrompt || DEFAULT_COACHING_PROMPT,
    resumeText
  )

  return {
    settings,
    transcriptWindow,
    screenContext,
    jobDescription,
    kbContext,
    scopeInstruction,
    systemPrompt,
  }
}

function buildSystemPrompt(basePrompt: string, resumeText: string) {
  const trimmedResume = limitText(resumeText, 12000)
  if (!trimmedResume) return basePrompt
  return `${basePrompt}

Here is the candidate's full resume:
${trimmedResume}`
}

function stopOcrLoop() {
  if (ocrInterval) {
    clearInterval(ocrInterval)
    ocrInterval = null
  }
}

function startOcrLoop(mainWindow: BrowserWindow | null, overlayWindow: BrowserWindow | null) {
  stopOcrLoop()
  const settings = settingsStore?.get()
  if (!settings?.autoCaptureSreen) return

  const runCapture = async () => {
    if (!sessionActive || !ocrService) return
    try {
      await captureLatestScreenText(mainWindow, overlayWindow, true)
    } catch (err) {
      const message = `[OCR] ${(err as Error).message}`
      broadcast(mainWindow, overlayWindow, 'pipeline-error', message)
    }
  }

  void runCapture()
  const intervalMs = Math.max(5, settings.screenCaptureInterval) * 1000
  ocrInterval = setInterval(runCapture, intervalMs)
}

async function warmupPipelines(
  mainWindow: BrowserWindow | null,
  overlayWindow: BrowserWindow | null
) {
  const stt = sttService?.warmup()
  const ocr = ocrService?.init()
  const [sttResult, ocrResult] = await Promise.allSettled([stt, ocr])

  broadcast(mainWindow, overlayWindow, 'pipeline-status', {
    stt: sttResult?.status === 'fulfilled' ? 'ready' : 'error',
    ocr: ocrResult?.status === 'fulfilled' ? 'ready' : 'error',
  })

  if (sttResult?.status === 'rejected') {
    broadcast(mainWindow, overlayWindow, 'pipeline-error', `[STT warmup] ${String(sttResult.reason)}`)
  }
  if (ocrResult?.status === 'rejected') {
    broadcast(mainWindow, overlayWindow, 'pipeline-error', `[OCR warmup] ${String(ocrResult.reason)}`)
  }
}

async function captureLatestScreenText(
  mainWindow: BrowserWindow | null,
  overlayWindow: BrowserWindow | null,
  shouldBroadcast = false
) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  })

  if (!sources.length || !ocrService) return ''

  const imgBuffer = sources[0].thumbnail.toPNG()
  const text = (await ocrService.extractText(imgBuffer)).trim()
  if (!text) return ''

  pushScreenContext(text)
  if (shouldBroadcast) {
    broadcast(mainWindow, overlayWindow, 'ocr-text', text)
  }
  return text
}

function broadcast(
  mainWindow: BrowserWindow | null,
  overlayWindow: BrowserWindow | null,
  channel: string,
  payload: unknown
) {
  mainWindow?.webContents.send(channel, payload)
  overlayWindow?.webContents.send(channel, payload)
}

async function parseDocumentText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf-8')
  }
  if (ext === '.pdf') {
    const pdfModule = await import('pdf-parse')
    const pdfParse = (pdfModule as any).default ?? pdfModule
    const buffer = fs.readFileSync(filePath)
    const data = await pdfParse(buffer)
    return data.text ?? ''
  }
  if (ext === '.docx') {
    const mammothModule = await import('mammoth')
    const mammoth = (mammothModule as any).default ?? mammothModule
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value ?? ''
  }
  throw new Error(`Unsupported resume format: ${ext}`)
}
