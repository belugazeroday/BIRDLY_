import React, { useEffect, useMemo, useRef, useState } from 'react'

type WidgetTab = 'chat' | 'transcript'
type WidgetToast = { tone?: 'success' | 'info' | 'error'; message: string }
type QuickCoachAction =
  | 'assist'
  | 'what-to-say'
  | 'follow-up'
  | 'recap'
  | 'screenshot'
  | 'custom'

interface WidgetEntry {
  id: string
  label: string
  text: string
  timestamp: number
  tone?: 'default' | 'live' | 'error'
}

const ACTIONS: Array<{ action: QuickCoachAction; label: string; shortcut?: string }> = [
  { action: 'assist', label: 'Assist', shortcut: '1' },
  { action: 'what-to-say', label: 'What should I say?', shortcut: '2' },
  { action: 'follow-up', label: 'Follow-up questions', shortcut: '3' },
  { action: 'recap', label: 'Recap', shortcut: '4' },
]

export default function FloatingWidget() {
  const [entries, setEntries] = useState<WidgetEntry[]>([])
  const [currentChunk, setCurrentChunk] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [transcriptLines, setTranscriptLines] = useState<string[]>([])
  const [isVisible, setIsVisible] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [customQuery, setCustomQuery] = useState('')
  const [opacity, setOpacity] = useState(0.85)
  const [activeTab, setActiveTab] = useState<WidgetTab>('chat')
  const [interactionEnabled, setInteractionEnabled] = useState(false)
  const [showTranscript, setShowTranscript] = useState(true)
  const [resumeFileName, setResumeFileName] = useState('')
  const [toast, setToast] = useState<WidgetToast | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hotkeyLabel = useMemo(
    () => (window.birdly?.platform === 'darwin' ? 'Cmd + \\' : 'Ctrl + \\'),
    []
  )

  useEffect(() => {
    const dismissToast = () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
      setToast(null)
    }

    const showToast = (nextToast: WidgetToast) => {
      dismissToast()
      setToast(nextToast)
      toastTimerRef.current = setTimeout(() => {
        setToast(null)
      }, 2600)
    }

    const refreshState = async () => {
      const [sessionState, settings] = await Promise.all([
        window.birdly.getSessionState() as Promise<{ active?: boolean }>,
        window.birdly.getSettings() as Promise<{
          overlayOpacity?: number
          showTranscript?: boolean
          resumeFileName?: string
        }>,
      ])

      setSessionActive(Boolean(sessionState?.active))
      setOpacity(
        typeof settings?.overlayOpacity === 'number' ? settings.overlayOpacity : 0.85
      )
      setShowTranscript(Boolean(settings?.showTranscript ?? true))
      setResumeFileName(settings?.resumeFileName ?? '')
    }

    void refreshState()

    const unsubSuggestion = window.birdly.onCoachingSuggestion((suggestionText: string) => {
      if (!suggestionText.trim()) return
      setEntries((prev) => [
        {
          id: `live_${Date.now()}`,
          label: 'Live Assist',
          text: suggestionText.trim(),
          timestamp: Date.now(),
          tone: 'live',
        },
        ...prev.slice(0, 11),
      ])
      setCurrentChunk('')
      setIsStreaming(false)
      setActiveTab('chat')
      setIsMinimized(false)
    })

    const unsubCoachingChunk = window.birdly.onCoachingChunk((chunk: string) => {
      setCurrentChunk((prev) => prev + chunk)
      setIsStreaming(true)
      setActiveTab('chat')
      setIsMinimized(false)
    })

    const unsubTranscript = window.birdly.onTranscript((text: string) => {
      setTranscriptLines((prev) => [...prev.slice(-39), text])
    })

    const unsubVisibility = window.birdly.onOverlayVisibilityChanged((visible: boolean) => {
      setIsVisible(visible)
    })

    const unsubInteraction = window.birdly.onWidgetInteractionChanged((interactive: boolean) => {
      setInteractionEnabled(interactive)
    })

    const unsubToast = window.birdly.onWidgetToast(showToast)

    const unsubResumeState = window.birdly.onResumeStateChanged((state) => {
      setResumeFileName(state.loaded ? state.fileName : '')
    })

    const unsubSessionState = window.birdly.onSessionState((state) => {
      const nextState = state as { active?: boolean }
      setSessionActive(Boolean(nextState?.active))
    })

    const poll = setInterval(() => {
      void refreshState()
    }, 1600)

    return () => {
      unsubSuggestion()
      unsubCoachingChunk()
      unsubTranscript()
      unsubVisibility()
      unsubInteraction()
      unsubToast()
      unsubResumeState()
      unsubSessionState()
      clearInterval(poll)
      dismissToast()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!interactionEnabled) return
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      if (event.key === '1') void runQuickAction('assist')
      if (event.key === '2') void runQuickAction('what-to-say')
      if (event.key === '3') void runQuickAction('follow-up')
      if (event.key === '4') void runQuickAction('recap')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [interactionEnabled])

  const runQuickAction = async (action: QuickCoachAction, customText?: string) => {
    setIsActionLoading(true)
    setCurrentChunk('')
    setIsStreaming(false)
    setIsMinimized(false)
    setActiveTab('chat')
    window.birdly.toggleWidgetInteraction({
      enabled: true,
      durationMs: 6000,
      focus: action === 'custom',
    })

    try {
      const result = await window.birdly.quickCoachAction(action, customText)
      const text = result?.content || result?.error || 'No response generated.'
      const tone = result?.error ? 'error' : 'default'
      const label = ACTIONS.find((item) => item.action === action)?.label ?? 'Birdly'

      setEntries((prev) => [
        {
          id: `manual_${Date.now()}`,
          label,
          text,
          timestamp: Date.now(),
          tone,
        },
        ...prev.slice(0, 11),
      ])
    } finally {
      setIsActionLoading(false)
    }
  }

  const submitCustomQuery = async () => {
    const trimmed = customQuery.trim()
    if (!trimmed) return
    await runQuickAction('custom', trimmed)
    setCustomQuery('')
  }

  const toggleSession = async () => {
    window.birdly.toggleWidgetInteraction({ enabled: true, durationMs: 6000, focus: true })
    if (sessionActive) await window.birdly.stopSession()
    else await window.birdly.startSession()
    const state = await (window.birdly.getSessionState() as Promise<{ active?: boolean }>)
    setSessionActive(Boolean(state?.active))
  }

  const uploadResumeFromDialog = async () => {
    window.birdly.toggleWidgetInteraction({ enabled: true, durationMs: 8000, focus: true })
    const files = await window.birdly.openFileDialog([
      { name: 'PDF Resume', extensions: ['pdf'] },
    ])
    if (!files?.length) return
    const response = await window.birdly.uploadResume(files[0])
    if (response?.success) {
      setResumeFileName(response.fileName ?? '')
    }
  }

  if (!isVisible) return null

  return (
    <div className="h-screen w-screen p-2 pointer-events-none">
      <div
        className="pointer-events-auto relative flex h-full flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(6,10,16,0.78)] shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-all duration-200"
        style={{ opacity }}
      >
        <div
          className="widget-drag-handle flex h-[14px] items-center justify-center border-b border-white/6 bg-white/[0.05]"
          onMouseEnter={() =>
            window.birdly.toggleWidgetInteraction({ enabled: true, durationMs: 3200 })
          }
          onMouseDown={() =>
            window.birdly.toggleWidgetInteraction({ enabled: true, durationMs: 6000 })
          }
        >
          <div className="flex items-center gap-1 text-[9px] tracking-[0.35em] text-white/45">
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </div>
        </div>

        <div className="widget-no-drag flex items-center gap-3 border-b border-white/8 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-cyan-500 to-teal-500 text-[13px] font-semibold text-slate-950 shadow-[0_12px_32px_rgba(34,211,238,0.28)]">
              B
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/85">
                Birdly
              </div>
              <div className="text-[10px] text-white/45">
                {interactionEnabled
                  ? 'Interactive'
                  : `Hover the top bar or press ${hotkeyLabel}`}
              </div>
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.05] p-1">
            <div className="flex items-center gap-1">
              {(['chat', 'transcript'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`widget-no-drag rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                    activeTab === tab
                      ? 'bg-white text-slate-950 shadow-[0_8px_18px_rgba(255,255,255,0.18)]'
                      : 'text-white/62 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {tab === 'chat' ? 'Chat' : 'Transcript'}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {resumeFileName ? (
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/12 px-3 py-1 text-[10px] font-medium text-emerald-200">
                Resume: {resumeFileName}
              </div>
            ) : (
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] text-white/45">
                No resume loaded
              </div>
            )}
            <button
              type="button"
              onClick={toggleSession}
              className={`widget-no-drag rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 active:scale-[0.97] ${
                sessionActive
                  ? 'bg-rose-500/18 text-rose-100 hover:bg-rose-500/26'
                  : 'bg-cyan-400/85 text-slate-950 hover:bg-cyan-300'
              }`}
            >
              {sessionActive ? 'Stop' : 'Start'}
            </button>
            <button
              type="button"
              onClick={uploadResumeFromDialog}
              className="widget-no-drag rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-white/82 transition-all duration-150 hover:border-cyan-300/35 hover:bg-cyan-300/12 active:scale-[0.97]"
            >
              Add PDF
            </button>
            <button
              type="button"
              onClick={() => window.birdly.openMainWindow()}
              className="widget-no-drag flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/80 transition-all duration-150 hover:border-white/20 hover:bg-white/10 active:scale-[0.97]"
              title="Open dashboard"
            >
              ⚙
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized((prev) => !prev)}
              className="widget-no-drag flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/80 transition-all duration-150 hover:border-white/20 hover:bg-white/10 active:scale-[0.97]"
              title={isMinimized ? 'Expand widget' : 'Collapse widget'}
            >
              {isMinimized ? '▼' : '▲'}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="widget-no-drag flex flex-wrap gap-2 border-b border-white/8 px-3 py-3">
              {ACTIONS.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => void runQuickAction(item.action)}
                  disabled={isActionLoading}
                  className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-[11px] font-medium text-white/86 transition-all duration-150 hover:-translate-y-[1px] hover:border-cyan-300/35 hover:bg-cyan-300/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"
                >
                  {item.label}
                  {item.shortcut && (
                    <span className="ml-2 rounded-full bg-black/25 px-1.5 py-0.5 text-[9px] text-white/55">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'chat' ? (
              <div className="widget-no-drag flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3">
                <div className="mb-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
                      Ask anything
                    </div>
                    <div className="text-[10px] text-white/35">
                      Uses transcript, OCR, resume, and local docs
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={customQuery}
                      onFocus={() =>
                        window.birdly.toggleWidgetInteraction({
                          enabled: true,
                          durationMs: 9000,
                          focus: true,
                        })
                      }
                      onChange={(event) => setCustomQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void submitCustomQuery()
                        }
                      }}
                      placeholder="Ask about your screen or conversation..."
                      rows={2}
                      className="widget-no-drag min-h-[56px] flex-1 resize-none rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-white outline-none transition-all duration-150 placeholder:text-white/28 focus:border-cyan-300/40 focus:bg-[rgba(255,255,255,0.07)]"
                    />
                    <button
                      type="button"
                      onClick={() => void submitCustomQuery()}
                      disabled={!customQuery.trim() || isActionLoading}
                      className="widget-no-drag rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-all duration-150 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
                    >
                      Send
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    {isStreaming && currentChunk && (
                      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 animate-slide-up">
                        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                          <span className="live-dot h-1.5 w-1.5" />
                          Thinking
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-6 text-white">
                          {currentChunk}
                          <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-cyan-200 align-middle" />
                        </div>
                      </div>
                    )}

                    {isActionLoading && !isStreaming && (
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <div className="h-4 w-4 rounded-full border-2 border-cyan-200/25 border-t-cyan-200 animate-spin" />
                        <div className="text-sm text-white/72">Thinking inside the widget…</div>
                      </div>
                    )}

                    {entries.length === 0 && !isStreaming && !isActionLoading && (
                      <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                          Ready
                        </div>
                        <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-white/62">
                          Press one of the action buttons or ask a custom question. Birdly answers right here without switching back to the dashboard.
                        </p>
                      </div>
                    )}

                    {entries.map((entry, index) => (
                      <div
                        key={entry.id}
                        className={`rounded-[22px] border p-3 transition-all duration-150 ${
                          entry.tone === 'live'
                            ? 'border-cyan-300/22 bg-cyan-300/10'
                            : entry.tone === 'error'
                              ? 'border-rose-300/20 bg-rose-400/8'
                              : 'border-white/8 bg-white/[0.04]'
                        } ${index === 0 ? 'shadow-[0_12px_32px_rgba(0,0,0,0.16)]' : 'opacity-90'}`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                            {entry.label}
                          </div>
                          <div className="text-[10px] text-white/32">
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-6 text-white/92">
                          {entry.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="widget-no-drag flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3">
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                    Live transcript
                  </div>
                  <div className="text-[10px] text-white/35">
                    {showTranscript ? `${transcriptLines.length} lines` : 'Hidden in settings'}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                  {!showTranscript ? (
                    <div className="flex h-full items-center justify-center text-center text-sm leading-6 text-white/52">
                      Transcript display is disabled in settings.
                    </div>
                  ) : transcriptLines.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-sm leading-6 text-white/52">
                      Start a session and Birdly will stream the conversation here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transcriptLines.map((line, index) => (
                        <div
                          key={`${index}_${line.slice(0, 12)}`}
                          className={`rounded-2xl px-3 py-2 text-sm leading-6 ${
                            index === transcriptLines.length - 1
                              ? 'bg-white/[0.07] text-white'
                              : 'bg-transparent text-white/70'
                          }`}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {toast && (
          <div
            className={`widget-no-drag absolute right-4 top-14 rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_42px_rgba(0,0,0,0.35)] ${
              toast.tone === 'success'
                ? 'border-emerald-300/20 bg-emerald-400/12 text-emerald-100'
                : toast.tone === 'error'
                  ? 'border-rose-300/20 bg-rose-400/14 text-rose-100'
                  : 'border-white/10 bg-slate-900/92 text-white'
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  )
}
