import React, { useState, useEffect, useRef, useCallback } from 'react'

interface Model { name: string }

export default function Dashboard() {
  const [sessionActive, setSessionActive] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('llama3.2')
  const [transcript, setTranscript] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [screenText, setScreenText] = useState('')
  const [pipelineError, setPipelineError] = useState('')
  const [pipelineStatus, setPipelineStatus] = useState<{ stt: string; ocr: string }>({
    stt: 'idle',
    ocr: 'idle',
  })
  const [firstTranscriptLatencyMs, setFirstTranscriptLatencyMs] = useState<number | null>(null)
  const [isCaptureRunning, setIsCaptureRunning] = useState(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Load models
    window.birdly?.ollamaListModels().then((m: Model[]) => setModels(m || []))
    // Load settings
    window.birdly?.getSettings().then((s: { model: string }) => { if (s?.model) setSelectedModel(s.model) })

    // Subscribe to events
    const unsubTranscript = window.birdly?.onTranscript((text: string) => {
      setTranscript((prev) => [...prev.slice(-49), text])
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })

    const unsubSuggestion = window.birdly?.onCoachingSuggestion((s: string) => {
      setSuggestions((prev) => [s, ...prev.slice(0, 9)])
      setStreamingText('')
      setIsStreaming(false)
    })
    const unsubChunk = window.birdly?.onCoachingChunk((chunk: string) => {
      setStreamingText((prev) => prev + chunk)
      setIsStreaming(true)
    })
    const unsubOcr = window.birdly?.onOcrText((text: string) => {
      setScreenText(text.slice(0, 300))
      setIsCaptureRunning(true)
    })
    const unsubPipelineError = window.birdly?.onPipelineError((message: string) => {
      setPipelineError(message)
    })
    const unsubPipelineStatus = window.birdly?.onPipelineStatus((status) => {
      setPipelineStatus(status)
    })
    const unsubSessionMetric = window.birdly?.onSessionMetric((metric) => {
      if (typeof metric.firstTranscriptLatencyMs === 'number') {
        setFirstTranscriptLatencyMs(metric.firstTranscriptLatencyMs)
      }
    })

    return () => {
      unsubTranscript?.()
      unsubSuggestion?.()
      unsubChunk?.()
      unsubOcr?.()
      unsubPipelineError?.()
      unsubPipelineStatus?.()
      unsubSessionMetric?.()
    }
  }, [])

  const startSession = useCallback(async () => {
    await window.birdly?.startSession()
    setSessionActive(true)
    setFirstTranscriptLatencyMs(null)
    setPipelineError('')
    setTranscript([])
    setSuggestions([])

    // Start mic capture (MediaRecorder → send PCM to main)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = createRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.start(3000) // 3s chunks
      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const pcm = await convertBlobToMono16kPcm(e.data)
          if (pcm.length > 0) {
            window.birdly?.sendAudioChunk(pcm)
          }
        }
      }
    } catch (err) {
      console.error('[Dashboard] Mic error:', err)
      setPipelineError(`Microphone error: ${(err as Error).message}`)
    }

    // Manual UI status: OCR loop is handled in main process settings.
    setIsCaptureRunning(true)

  }, [])

  const stopSession = useCallback(async () => {
    await window.birdly?.stopSession()
    setSessionActive(false)
    setIsCaptureRunning(false)

    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop())
    mediaRecorderRef.current = null

    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current)
    captureIntervalRef.current = null
  }, [])

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    window.birdly?.saveSettings({ model })
  }

  return (
    <div className="flex flex-col h-full p-6 gap-5">
      {/* ── Header ── */}
      <div className="titlebar h-9 flex items-center">
        <div className="titlebar-no-drag flex items-center gap-4 ml-auto">
          {/* Model selector */}
          <select
            id="model-selector"
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="input py-1 text-xs w-44"
          >
            {models.length === 0 && <option value="llama3.2">llama3.2 (default)</option>}
            {models.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>

          {/* Session toggle */}
          {!sessionActive ? (
            <button id="start-session-btn" onClick={startSession} className="btn-primary flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-white/70" />
              Start Session
            </button>
          ) : (
            <button id="stop-session-btn" onClick={stopSession} className="btn-danger flex items-center gap-2 text-sm">
              <div className="live-dot" />
              End Session
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-5 min-h-0">
        {/* ── Left: Suggestions ── */}
        <div className="flex flex-col flex-1 min-w-0 gap-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Status', value: sessionActive ? 'LIVE' : 'Idle', color: sessionActive ? 'text-emerald-400' : 'text-birdly-muted' },
              { label: 'Suggestions', value: suggestions.length.toString(), color: 'text-birdly-accent-light' },
              { label: 'Screen', value: isCaptureRunning ? 'Active' : 'Off', color: isCaptureRunning ? 'text-amber-400' : 'text-birdly-muted' },
            ].map((stat) => (
              <div key={stat.label} className="card flex flex-col items-center py-3">
                <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
                <span className="text-xs text-birdly-muted mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="card flex flex-col items-center py-3">
              <span className="text-xs text-birdly-muted">STT</span>
              <span className="text-sm font-semibold text-birdly-text capitalize">{pipelineStatus.stt}</span>
            </div>
            <div className="card flex flex-col items-center py-3">
              <span className="text-xs text-birdly-muted">OCR</span>
              <span className="text-sm font-semibold text-birdly-text capitalize">{pipelineStatus.ocr}</span>
            </div>
            <div className="card flex flex-col items-center py-3">
              <span className="text-xs text-birdly-muted">First Transcript</span>
              <span className="text-sm font-semibold text-birdly-text">
                {firstTranscriptLatencyMs === null ? '--' : `${firstTranscriptLatencyMs} ms`}
              </span>
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="card flex-1 min-h-0 flex flex-col">
            <div className="section-title flex items-center gap-2">
              <span>💡 AI Coaching Suggestions</span>
              {isStreaming && <div className="live-dot" />}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
              {isStreaming && streamingText && (
                <div className="suggestion-card">
                  <p className="text-sm text-birdly-text leading-relaxed whitespace-pre-wrap">
                    {streamingText}<span className="animate-pulse text-birdly-accent">▌</span>
                  </p>
                </div>
              )}

              {suggestions.length === 0 && !isStreaming ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <div className="text-4xl mb-3 opacity-30">🎯</div>
                  <p className="text-sm text-birdly-muted">Start a session to receive live coaching</p>
                  <p className="text-xs text-birdly-muted/60 mt-1">Birdly listens and provides real-time suggestions</p>
                </div>
              ) : suggestions.map((s, i) => (
                <div
                  key={i}
                  className={`suggestion-card transition-opacity ${i === 0 ? 'opacity-100' : 'opacity-50'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge-accent">#{suggestions.length - i}</span>
                    {i === 0 && <span className="text-[10px] text-birdly-muted ml-auto">Latest</span>}
                  </div>
                  <p className="text-sm text-birdly-text leading-relaxed whitespace-pre-wrap">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Transcript + Screen ── */}
        <div className="flex flex-col w-72 gap-4">
          {/* Live transcript */}
          <div className="card flex-1 min-h-0 flex flex-col">
            <div className="section-title flex items-center gap-2">
              🎤 Live Transcript
              {sessionActive && <div className="live-dot ml-auto" />}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 text-xs text-birdly-text-dim leading-relaxed">
              {transcript.length === 0 ? (
                <p className="text-birdly-muted italic text-center mt-4">Transcript appears here...</p>
              ) : (
                transcript.map((line, i) => (
                  <p key={i} className={i === transcript.length - 1 ? 'text-birdly-text' : ''}>{line}</p>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Screen context */}
          <div className="card" style={{ maxHeight: '180px' }}>
            <div className="section-title">🖥️ Screen Context</div>
            <p className="text-xs text-birdly-text-dim leading-relaxed overflow-y-auto max-h-28 pr-1">
              {screenText || <span className="text-birdly-muted italic">No screen capture yet</span>}
            </p>
          </div>

          {pipelineError && (
            <div className="card border border-red-500/40">
              <div className="text-xs text-red-300">{pipelineError}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

async function convertBlobToMono16kPcm(blob: Blob): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const channelData = audioBuffer.numberOfChannels > 1
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0)
    const resampled = resampleLinear(channelData, audioBuffer.sampleRate, 16000)
    return Array.from(resampled)
  } catch {
    return []
  } finally {
    await ctx.close()
  }
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length
  const mixed = new Float32Array(length)
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      mixed[i] += data[i] / audioBuffer.numberOfChannels
    }
  }
  return mixed
}

function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return input
  const ratio = sourceRate / targetRate
  const newLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const left = Math.floor(srcIndex)
    const right = Math.min(left + 1, input.length - 1)
    const t = srcIndex - left
    output[i] = input[left] * (1 - t) + input[right] * t
  }
  return output
}

function createRecorder(stream: MediaStream): MediaRecorder {
  const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type))
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
}
