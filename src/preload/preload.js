"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// ─────────────────────────────────────────────
// Type-safe bridge exposed to all renderer pages
// ─────────────────────────────────────────────
const api = {
    // ── Overlay control ──────────────────────────
    setOverlayInteractive: (interactive) => electron_1.ipcRenderer.send('overlay-set-interactive', interactive),
    moveOverlay: (x, y) => electron_1.ipcRenderer.send('overlay-move', x, y),
    resizeOverlay: (w, h) => electron_1.ipcRenderer.send('overlay-resize', w, h),
    openMainWindow: () => electron_1.ipcRenderer.send('open-main-window'),
    // ── LLM / Ollama ─────────────────────────────
    ollamaChat: (payload) => electron_1.ipcRenderer.invoke('ollama-chat', payload),
    ollamaStream: (payload, onChunk) => {
        const channel = `ollama-stream-${Date.now()}`;
        electron_1.ipcRenderer.on(channel, (_e, chunk) => onChunk(chunk));
        return electron_1.ipcRenderer.invoke('ollama-stream', { ...payload, channel }).finally(() => {
            electron_1.ipcRenderer.removeAllListeners(channel);
        });
    },
    ollamaListModels: () => electron_1.ipcRenderer.invoke('ollama-list-models'),
    // ── Speech-to-text ────────────────────────────
    startTranscription: () => electron_1.ipcRenderer.send('stt-start'),
    stopTranscription: () => electron_1.ipcRenderer.send('stt-stop'),
    onTranscript: (cb) => {
        const handler = (_e, text) => cb(text);
        electron_1.ipcRenderer.on('stt-transcript', handler);
        return () => electron_1.ipcRenderer.removeListener('stt-transcript', handler);
    },
    // ── Screen OCR ────────────────────────────────
    captureScreen: () => electron_1.ipcRenderer.invoke('ocr-capture'),
    // ── Knowledge Base ────────────────────────────
    addDocument: (filePath) => electron_1.ipcRenderer.invoke('kb-add-document', filePath),
    removeDocument: (id) => electron_1.ipcRenderer.invoke('kb-remove-document', id),
    listDocuments: () => electron_1.ipcRenderer.invoke('kb-list-documents'),
    queryKB: (query, topK) => electron_1.ipcRenderer.invoke('kb-query', { query, topK }),
    // ── Session control ───────────────────────────
    startSession: () => electron_1.ipcRenderer.invoke('session-start'),
    stopSession: () => electron_1.ipcRenderer.invoke('session-stop'),
    getSessionState: () => electron_1.ipcRenderer.invoke('session-get-state'),
    // ── Post-meeting ──────────────────────────────
    generateSummary: () => electron_1.ipcRenderer.invoke('post-generate-summary'),
    generateEmail: () => electron_1.ipcRenderer.invoke('post-generate-email'),
    exportMarkdown: (content, filename) => electron_1.ipcRenderer.invoke('post-export-md', { content, filename }),
    // ── Settings ─────────────────────────────────
    getSettings: () => electron_1.ipcRenderer.invoke('settings-get'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('settings-save', settings),
    // ── File dialog ───────────────────────────────
    openFileDialog: (filters) => electron_1.ipcRenderer.invoke('dialog-open-file', filters),
    // ── Events ────────────────────────────────────
    onOverlayVisibilityChanged: (cb) => {
        const handler = (_e, v) => cb(v);
        electron_1.ipcRenderer.on('overlay-visibility-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('overlay-visibility-changed', handler);
    },
    onCoachingSuggestion: (cb) => {
        const handler = (_e, s) => cb(s);
        electron_1.ipcRenderer.on('coaching-suggestion', handler);
        return () => electron_1.ipcRenderer.removeListener('coaching-suggestion', handler);
    },
    onSessionState: (cb) => {
        const handler = (_e, s) => cb(s);
        electron_1.ipcRenderer.on('session-state', handler);
        return () => electron_1.ipcRenderer.removeListener('session-state', handler);
    },
    // ── Platform info ─────────────────────────────
    platform: process.platform,
};
electron_1.contextBridge.exposeInMainWorld('birdly', api);
