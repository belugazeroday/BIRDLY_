import { contextBridge, ipcRenderer } from 'electron'

// ─────────────────────────────────────────────
// Type-safe bridge exposed to all renderer pages
// ─────────────────────────────────────────────
const api = {
  // ── Overlay control ──────────────────────────
  setOverlayInteractive: (interactive: boolean) =>
    ipcRenderer.send('overlay-set-interactive', interactive),
  toggleWidgetInteraction: (payload?: { enabled?: boolean; durationMs?: number; focus?: boolean }) =>
    ipcRenderer.send('toggle-widget-interaction', payload),
  moveOverlay: (x: number, y: number) =>
    ipcRenderer.send('overlay-move', x, y),
  resizeOverlay: (w: number, h: number) =>
    ipcRenderer.send('overlay-resize', w, h),
  openMainWindow: () => ipcRenderer.send('open-main-window'),

  // ── LLM / Ollama ─────────────────────────────
  ollamaChat: (payload: { model: string; messages: Array<{ role: string; content: string }>; system?: string }) =>
    ipcRenderer.invoke('ollama-chat', payload),
  ollamaStream: (payload: { model: string; messages: Array<{ role: string; content: string }>; system?: string }, onChunk: (chunk: string) => void) => {
    const channel = `ollama-stream-${Date.now()}`
    ipcRenderer.on(channel, (_e, chunk: string) => onChunk(chunk))
    return ipcRenderer.invoke('ollama-stream', { ...payload, channel }).finally(() => {
      ipcRenderer.removeAllListeners(channel)
    })
  },
  ollamaListModels: () => ipcRenderer.invoke('ollama-list-models'),

  // ── Speech-to-text ────────────────────────────
  startTranscription: () => ipcRenderer.send('stt-start'),
  stopTranscription: () => ipcRenderer.send('stt-stop'),
  sendAudioChunk: (audioData: number[]) => ipcRenderer.send('stt-audio-chunk', audioData),
  onTranscript: (cb: (text: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, text: string) => cb(text)
    ipcRenderer.on('stt-transcript', handler)
    return () => ipcRenderer.removeListener('stt-transcript', handler)
  },

  // ── Screen OCR ────────────────────────────────
  captureScreen: () => ipcRenderer.invoke('ocr-capture'),

  // ── Knowledge Base ────────────────────────────
  addDocument: (filePath: string) => ipcRenderer.invoke('kb-add-document', filePath),
  removeDocument: (id: string) => ipcRenderer.invoke('kb-remove-document', id),
  listDocuments: (options?: { kinds?: Array<'knowledge' | 'resume'> }) =>
    ipcRenderer.invoke('kb-list-documents', options),
  queryKB: (query: string, topK?: number, kinds?: Array<'knowledge' | 'resume'>) =>
    ipcRenderer.invoke('kb-query', { query, topK, kinds }),

  // ── Session control ───────────────────────────
  startSession: () => ipcRenderer.invoke('session-start'),
  stopSession: () => ipcRenderer.invoke('session-stop'),
  getSessionState: () => ipcRenderer.invoke('session-get-state'),
  quickCoachAction: (
    action: 'assist' | 'what-to-say' | 'follow-up' | 'recap' | 'screenshot' | 'custom',
    customQuery?: string
  ) =>
    ipcRenderer.invoke('coach-quick-action', action, customQuery),

  // ── Post-meeting ──────────────────────────────
  generateSummary: () => ipcRenderer.invoke('post-generate-summary'),
  generateEmail: () => ipcRenderer.invoke('post-generate-email'),
  exportMarkdown: (content: string, filename: string) =>
    ipcRenderer.invoke('post-export-md', { content, filename }),

  // ── Settings ─────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings-get'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings-save', settings),
  uploadResume: (filePath: string) => ipcRenderer.invoke('profile-upload-resume', filePath),
  clearResume: () => ipcRenderer.invoke('profile-clear-resume'),

  // ── File dialog ───────────────────────────────
  openFileDialog: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke('dialog-open-file', filters),

  // ── Events ────────────────────────────────────
  onOverlayVisibilityChanged: (cb: (visible: boolean) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, v: boolean) => cb(v)
    ipcRenderer.on('overlay-visibility-changed', handler)
    return () => ipcRenderer.removeListener('overlay-visibility-changed', handler)
  },
  onWidgetInteractionChanged: (cb: (interactive: boolean) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, interactive: boolean) => cb(interactive)
    ipcRenderer.on('widget-interaction-changed', handler)
    return () => ipcRenderer.removeListener('widget-interaction-changed', handler)
  },
  onWidgetToast: (cb: (toast: { tone?: 'success' | 'info' | 'error'; message: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, toast: { tone?: 'success' | 'info' | 'error'; message: string }) => cb(toast)
    ipcRenderer.on('widget-toast', handler)
    return () => ipcRenderer.removeListener('widget-toast', handler)
  },
  onResumeStateChanged: (cb: (state: { fileName: string; loaded: boolean }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: { fileName: string; loaded: boolean }) => cb(state)
    ipcRenderer.on('resume-state-changed', handler)
    return () => ipcRenderer.removeListener('resume-state-changed', handler)
  },
  onCoachingSuggestion: (cb: (suggestion: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on('coaching-suggestion', handler)
    return () => ipcRenderer.removeListener('coaching-suggestion', handler)
  },
  onCoachingChunk: (cb: (chunk: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, c: string) => cb(c)
    ipcRenderer.on('coaching-chunk', handler)
    return () => ipcRenderer.removeListener('coaching-chunk', handler)
  },
  onOcrText: (cb: (text: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, t: string) => cb(t)
    ipcRenderer.on('ocr-text', handler)
    return () => ipcRenderer.removeListener('ocr-text', handler)
  },
  onPipelineError: (cb: (message: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, m: string) => cb(m)
    ipcRenderer.on('pipeline-error', handler)
    return () => ipcRenderer.removeListener('pipeline-error', handler)
  },
  onPipelineStatus: (cb: (status: { stt: string; ocr: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: { stt: string; ocr: string }) => cb(s)
    ipcRenderer.on('pipeline-status', handler)
    return () => ipcRenderer.removeListener('pipeline-status', handler)
  },
  onSessionMetric: (cb: (metric: { firstTranscriptLatencyMs?: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, m: { firstTranscriptLatencyMs?: number }) => cb(m)
    ipcRenderer.on('session-metric', handler)
    return () => ipcRenderer.removeListener('session-metric', handler)
  },
  onSessionState: (cb: (state: unknown) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: unknown) => cb(s)
    ipcRenderer.on('session-state', handler)
    return () => ipcRenderer.removeListener('session-state', handler)
  },

  // ── Platform info ─────────────────────────────
  platform: process.platform,
}

contextBridge.exposeInMainWorld('birdly', api)

export type BirdlyAPI = typeof api
