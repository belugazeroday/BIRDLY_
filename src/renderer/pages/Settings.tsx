import React, { useEffect, useMemo, useState } from 'react'

interface Settings {
  model: string
  temperature: number
  maxTokens: number
  overlayOpacity: number
  systemPrompt: string
  role: string
  outputMode: 'general' | 'interview' | 'sales' | 'negotiation' | 'coding'
  jobDescription: string
  strictScope: boolean
  resumeText: string
  resumeFileName: string
  autoCaptureSreen: boolean
  screenCaptureInterval: number
  enableToneAnalysis: boolean
  showTranscript: boolean
  theme: string
  fontSize: string
  customRoles: Array<{ name: string; prompt: string }>
}

const ROLE_TEMPLATES = [
  { name: 'General Coach', prompt: '' },
  {
    name: 'Sales Coach',
    prompt:
      'You are an expert sales coach. Focus on objection handling, closing techniques, and rapport building.',
  },
  {
    name: 'Interview Coach',
    prompt:
      'You are an expert interview coach. Help structure STAR answers, suggest follow-up questions.',
  },
  {
    name: 'Negotiation Coach',
    prompt:
      'You are a master negotiator. Identify leverage points and recommend strategies.',
  },
  {
    name: 'Technical Interview',
    prompt:
      'You are a technical interview coach. Suggest code approaches, data structures, algorithm hints.',
  },
  {
    name: 'Public Speaking',
    prompt:
      'You are a public speaking coach. Help with delivery, structure, pacing, and audience engagement.',
  },
]

function getDefaultSettings(): Settings {
  return {
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 512,
    overlayOpacity: 0.85,
    systemPrompt: '',
    role: 'General Coach',
    outputMode: 'general',
    jobDescription: '',
    strictScope: true,
    resumeText: '',
    resumeFileName: '',
    autoCaptureSreen: true,
    screenCaptureInterval: 10,
    enableToneAnalysis: false,
    showTranscript: true,
    theme: 'dark',
    fontSize: 'md',
    customRoles: [],
  }
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loadError, setLoadError] = useState('')
  const [saved, setSaved] = useState(false)
  const [models, setModels] = useState<Array<{ name: string }>>([])
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>(
    'checking'
  )
  const [isResumeDragOver, setIsResumeDragOver] = useState(false)
  const [resumeStatus, setResumeStatus] = useState('')

  const interactionHotkey = useMemo(
    () => (window.birdly?.platform === 'darwin' ? 'Cmd + \\' : 'Ctrl + \\'),
    []
  )

  useEffect(() => {
    const refreshSettings = async () => {
      try {
        const nextSettings = await window.birdly.getSettings()
        setSettings(nextSettings as Settings)
      } catch (err) {
        setLoadError((err as Error).message || 'Could not load settings')
        setSettings(getDefaultSettings())
      }
    }

    void refreshSettings()
    window.birdly
      .ollamaListModels()
      .then((nextModels: Array<{ name: string }>) => {
        setModels(nextModels || [])
        setOllamaStatus(nextModels && nextModels.length > 0 ? 'connected' : 'disconnected')
      })
      .catch(() => setOllamaStatus('disconnected'))

    const unsubscribeResume = window.birdly.onResumeStateChanged(() => {
      void refreshSettings()
    })

    return () => {
      unsubscribeResume()
    }
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = async () => {
    if (!settings) return
    await window.birdly.saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRoleChange = (roleName: string) => {
    update('role', roleName)
    const template = ROLE_TEMPLATES.find((role) => role.name === roleName)
    if (template) update('systemPrompt', template.prompt)
  }

  const handleResumeUpload = async (filePath: string) => {
    setResumeStatus(`Loading ${filePath.split(/[/\\]/).pop() ?? 'resume'}...`)
    setLoadError('')
    const result = await window.birdly.uploadResume(filePath)
    if (result?.success) {
      const next = await window.birdly.getSettings()
      setSettings(next as Settings)
      setResumeStatus('Resume loaded — I now know who you are')
    } else {
      setResumeStatus('')
      setLoadError(result?.error || 'Resume upload failed')
    }
  }

  const openResumePicker = async () => {
    const files = await window.birdly.openFileDialog([
      { name: 'Resume', extensions: ['pdf', 'docx', 'txt', 'md'] },
    ])
    if (!files?.length) return
    await handleResumeUpload(files[0])
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-birdly-muted animate-pulse">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="titlebar h-9 flex items-center">
        <h1 className="text-lg font-semibold text-birdly-text titlebar-no-drag">Settings</h1>
        <div className="ml-auto titlebar-no-drag flex items-center gap-2">
          <div
            className={`badge ${
              ollamaStatus === 'connected'
                ? 'badge-success'
                : 'bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/30'
            }`}
          >
            {ollamaStatus === 'connected'
              ? '● Ollama Connected'
              : ollamaStatus === 'checking'
                ? '○ Checking...'
                : '○ Ollama Offline'}
          </div>
          <button
            id="save-settings-btn"
            onClick={handleSave}
            className={`btn-primary text-sm ${saved ? 'bg-emerald-600' : ''}`}
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      <section className="card space-y-4">
        <p className="section-title">Resume Profile</p>

        <div
          onDrop={async (event) => {
            event.preventDefault()
            setIsResumeDragOver(false)
            const file = Array.from(event.dataTransfer.files).find((item) =>
              item.name.toLowerCase().endsWith('.pdf')
            )
            const filePath = (file as { path?: string } | undefined)?.path
            if (filePath) await handleResumeUpload(filePath)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setIsResumeDragOver(true)
          }}
          onDragLeave={() => setIsResumeDragOver(false)}
          className={`titlebar-no-drag rounded-2xl border-2 border-dashed p-5 transition-all duration-200 ${
            isResumeDragOver
              ? 'border-birdly-accent bg-birdly-accent/10'
              : 'border-birdly-border bg-birdly-surface/40'
          }`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="text-sm font-semibold text-birdly-text">Add PDF Resume</div>
              <p className="mt-1 text-xs leading-5 text-birdly-text-dim">
                Drag a PDF here or click the button to open the native file picker. Birdly stores the
                parsed resume locally and injects it into future prompts automatically.
              </p>
              <div className="mt-3 text-xs text-birdly-muted">
                Current file: {settings.resumeFileName || 'No resume uploaded'}
              </div>
              {resumeStatus && <div className="mt-2 text-xs text-emerald-300">{resumeStatus}</div>}
            </div>

            <div className="flex gap-2">
              <button type="button" className="btn-primary text-sm" onClick={openResumePicker}>
                Add PDF Resume
              </button>
              <button
                type="button"
                className="btn-ghost text-sm text-red-300"
                onClick={async () => {
                  await window.birdly.clearResume()
                  const next = await window.birdly.getSettings()
                  setSettings(next as Settings)
                  setResumeStatus('')
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <p className="section-title">Model & AI</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-birdly-muted mb-1.5 block">Ollama Model</label>
            <select
              id="settings-model"
              value={settings.model}
              onChange={(event) => update('model', event.target.value)}
              className="input"
            >
              {models.length === 0 && <option value={settings.model}>{settings.model}</option>}
              {models.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-birdly-muted mb-1.5 block">Coaching Role</label>
            <select
              id="settings-role"
              value={settings.role}
              onChange={(event) => handleRoleChange(event.target.value)}
              className="input"
            >
              {ROLE_TEMPLATES.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-birdly-muted mb-1.5 block">
              Temperature: {settings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.temperature}
              onChange={(event) => update('temperature', parseFloat(event.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
          <div>
            <label className="text-xs text-birdly-muted mb-1.5 block">
              Max Tokens: {settings.maxTokens}
            </label>
            <input
              type="range"
              min="128"
              max="2048"
              step="64"
              value={settings.maxTokens}
              onChange={(event) => update('maxTokens', parseInt(event.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-birdly-muted mb-1.5 block">
            System Prompt (overrides role template)
          </label>
          <textarea
            id="system-prompt-input"
            value={settings.systemPrompt}
            onChange={(event) => update('systemPrompt', event.target.value)}
            placeholder="Leave empty to use role template..."
            rows={3}
            className="input resize-none font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-birdly-muted mb-1.5 block">Output Mode</label>
            <select
              id="settings-output-mode"
              value={settings.outputMode}
              onChange={(event) =>
                update('outputMode', event.target.value as Settings['outputMode'])
              }
              className="input"
            >
              <option value="general">General</option>
              <option value="interview">Interview</option>
              <option value="sales">Sales</option>
              <option value="negotiation">Negotiation</option>
              <option value="coding">Coding</option>
            </select>
          </div>
          <div className="flex items-end justify-between rounded-xl border border-birdly-border bg-birdly-surface/50 px-4 py-3">
            <span className="text-sm text-birdly-text">Strict scope from JD/context</span>
            <Toggle
              value={settings.strictScope}
              onChange={(value) => update('strictScope', value)}
              id="toggle-scope"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-birdly-muted mb-1.5 block">Job Description / Scope Anchor</label>
          <textarea
            id="job-description-input"
            value={settings.jobDescription}
            onChange={(event) => update('jobDescription', event.target.value)}
            placeholder="Paste role/job description or desired scope. Birdly will keep outputs on-topic."
            rows={4}
            className="input resize-none text-xs"
          />
        </div>
      </section>

      <section className="card space-y-4">
        <p className="section-title">Overlay</p>

        <div>
          <label className="text-xs text-birdly-muted mb-1.5 block">
            Widget Opacity: {Math.round(settings.overlayOpacity * 100)}%
          </label>
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.05"
            value={settings.overlayOpacity}
            onChange={(event) => update('overlayOpacity', parseFloat(event.target.value))}
            className="w-full accent-purple-500"
          />
        </div>

        <div className="rounded-xl border border-birdly-border bg-birdly-surface/50 px-4 py-3 text-sm text-birdly-text-dim">
          Interaction hotkey: <span className="font-semibold text-birdly-text">{interactionHotkey}</span>
          <div className="mt-1 text-xs text-birdly-muted">
            Use it to temporarily unlock the floating widget for typing, clicking, or dragging.
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-birdly-border bg-birdly-surface/50 px-4 py-3">
          <span className="text-sm text-birdly-text">Show live transcript in overlay</span>
          <Toggle
            value={settings.showTranscript}
            onChange={(value) => update('showTranscript', value)}
            id="toggle-transcript"
          />
        </div>
      </section>

      <section className="card space-y-4">
        <p className="section-title">Screen Capture</p>
        <div className="flex items-center justify-between rounded-xl border border-birdly-border bg-birdly-surface/50 px-4 py-3">
          <span className="text-sm text-birdly-text">Auto-capture screen during session</span>
          <Toggle
            value={settings.autoCaptureSreen}
            onChange={(value) => update('autoCaptureSreen', value)}
            id="toggle-screen"
          />
        </div>

        {settings.autoCaptureSreen && (
          <div>
            <label className="text-xs text-birdly-muted mb-1.5 block">
              Capture interval: {settings.screenCaptureInterval}s
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={settings.screenCaptureInterval}
              onChange={(event) =>
                update('screenCaptureInterval', parseInt(event.target.value))
              }
              className="w-full accent-purple-500"
            />
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-birdly-border bg-birdly-surface/50 px-4 py-3">
          <span className="text-sm text-birdly-text">Tone & emotion analysis</span>
          <Toggle
            value={settings.enableToneAnalysis}
            onChange={(value) => update('enableToneAnalysis', value)}
            id="toggle-tone"
          />
        </div>
      </section>

      <div className="text-center text-xs text-birdly-muted/60 pb-2">
        All data stays on your device. No telemetry. No internet required beyond your local Ollama server.
      </div>
      {loadError && <div className="text-xs text-red-400 text-center">{loadError}</div>}
    </div>
  )
}

function Toggle({
  value,
  onChange,
  id,
}: {
  value: boolean
  onChange: (value: boolean) => void
  id: string
}) {
  return (
    <button
      id={id}
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-birdly-accent ${
        value ? 'bg-birdly-accent' : 'bg-birdly-border'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
