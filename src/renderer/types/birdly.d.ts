type ChatMessage = { role: string; content: string }

interface BirdlyAPI {
  setOverlayInteractive: (interactive: boolean) => void
  toggleWidgetInteraction: (payload?: { enabled?: boolean; durationMs?: number; focus?: boolean }) => void
  moveOverlay: (x: number, y: number) => void
  resizeOverlay: (w: number, h: number) => void
  openMainWindow: () => void
  ollamaChat: (payload: { model: string; messages: ChatMessage[]; system?: string }) => Promise<unknown>
  ollamaStream: (
    payload: { model: string; messages: ChatMessage[]; system?: string },
    onChunk: (chunk: string) => void
  ) => Promise<unknown>
  ollamaListModels: () => Promise<Array<{ name: string }>>
  startTranscription: () => void
  stopTranscription: () => void
  sendAudioChunk: (audioData: number[]) => void
  onTranscript: (cb: (text: string) => void) => () => void
  captureScreen: () => Promise<{ text?: string }>
  addDocument: (filePath: string) => Promise<unknown>
  removeDocument: (id: string) => Promise<unknown>
  listDocuments: (
    options?: { kinds?: Array<'knowledge' | 'resume'> }
  ) => Promise<Array<{ id: string; name: string; addedAt: number; chunkCount: number; kind: 'knowledge' | 'resume' }>>
  queryKB: (query: string, topK?: number, kinds?: Array<'knowledge' | 'resume'>) => Promise<unknown>
  startSession: () => Promise<unknown>
  stopSession: () => Promise<unknown>
  getSessionState: () => Promise<unknown>
  quickCoachAction: (
    action: 'assist' | 'what-to-say' | 'follow-up' | 'recap' | 'screenshot' | 'custom',
    customQuery?: string
  ) => Promise<{ content?: string; error?: string }>
  generateSummary: () => Promise<{ content?: string; error?: string }>
  generateEmail: () => Promise<{ content?: string; error?: string }>
  exportMarkdown: (content: string, filename: string) => Promise<unknown>
  getSettings: () => Promise<any>
  saveSettings: (settings: unknown) => Promise<unknown>
  uploadResume: (filePath: string) => Promise<{ success: boolean; error?: string; fileName?: string }>
  clearResume: () => Promise<{ success: boolean }>
  openFileDialog: (filters?: Electron.FileFilter[]) => Promise<string[]>
  onOverlayVisibilityChanged: (cb: (visible: boolean) => void) => () => void
  onWidgetInteractionChanged: (cb: (interactive: boolean) => void) => () => void
  onWidgetToast: (cb: (toast: { tone?: 'success' | 'info' | 'error'; message: string }) => void) => () => void
  onResumeStateChanged: (cb: (state: { fileName: string; loaded: boolean }) => void) => () => void
  onCoachingSuggestion: (cb: (suggestion: string) => void) => () => void
  onCoachingChunk: (cb: (chunk: string) => void) => () => void
  onOcrText: (cb: (text: string) => void) => () => void
  onPipelineError: (cb: (message: string) => void) => () => void
  onPipelineStatus: (cb: (status: { stt: string; ocr: string }) => void) => () => void
  onSessionMetric: (cb: (metric: { firstTranscriptLatencyMs?: number }) => void) => () => void
  onSessionState: (cb: (state: unknown) => void) => () => void
  platform: string
}

declare global {
  interface Window {
    birdly: BirdlyAPI
  }
}

export {}
