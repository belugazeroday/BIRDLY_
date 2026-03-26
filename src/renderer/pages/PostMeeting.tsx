import React, { useState } from 'react'

export default function PostMeeting() {
  const [summary, setSummary] = useState('')
  const [email, setEmail] = useState('')
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'email'>('summary')

  const generateSummary = async () => {
    setIsGeneratingSummary(true)
    setSummary('')
    try {
      const result = await window.birdly?.generateSummary() as { content?: string; error?: string }
      setSummary(result?.content ?? result?.error ?? 'No content generated.')
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const generateEmail = async () => {
    setIsGeneratingEmail(true)
    setEmail('')
    try {
      const result = await window.birdly?.generateEmail() as { content?: string; error?: string }
      setEmail(result?.content ?? result?.error ?? 'No content generated.')
    } finally {
      setIsGeneratingEmail(false)
    }
  }

  const exportMd = (content: string, filename: string) => {
    window.birdly?.exportMarkdown(content, filename)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-5">
      <div className="titlebar h-9 flex items-center">
        <h1 className="text-lg font-semibold titlebar-no-drag">Post-Meeting</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-birdly-surface rounded-xl border border-birdly-border w-fit titlebar-no-drag">
        {(['summary', 'email'] as const).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === tab
                ? 'bg-birdly-accent text-white shadow'
                : 'text-birdly-muted hover:text-birdly-text'
              }`}
          >
            {tab === 'summary' ? '📋 Summary & Actions' : '✉️ Follow-up Email'}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="flex flex-col gap-4">
          <div className="card">
            <p className="text-sm text-birdly-text-dim mb-3">
              Generate a comprehensive meeting summary with action items from the current session's transcript and knowledge base.
            </p>
            <div className="flex gap-2">
              <button id="generate-summary-btn" onClick={generateSummary} disabled={isGeneratingSummary} className="btn-primary text-sm">
                {isGeneratingSummary ? (
                  <span className="flex items-center gap-2"><div className="live-dot" /> Generating...</span>
                ) : '⚡ Generate Summary'}
              </button>
              {summary && (
                <button id="export-summary-btn" onClick={() => exportMd(summary, 'meeting-summary.md')} className="btn-ghost text-sm">
                  ↓ Export MD
                </button>
              )}
            </div>
          </div>

          {summary && (
            <div className="card animate-fade-in">
              <div className="section-title flex items-center gap-2">📋 Meeting Summary</div>
              <div className="prose-sm text-sm text-birdly-text leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-96">
                {summary}
              </div>
            </div>
          )}

          {!summary && !isGeneratingSummary && (
            <div className="card text-center py-10">
              <div className="text-5xl mb-3 opacity-20">📋</div>
              <p className="text-birdly-muted text-sm">No summary yet</p>
              <p className="text-xs text-birdly-muted/60 mt-1">Complete a session and click Generate Summary</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'email' && (
        <div className="flex flex-col gap-4">
          <div className="card">
            <p className="text-sm text-birdly-text-dim mb-3">
              Draft a professional follow-up email based on the meeting transcript and your knowledge base.
            </p>
            <div className="flex gap-2">
              <button id="generate-email-btn" onClick={generateEmail} disabled={isGeneratingEmail} className="btn-primary text-sm">
                {isGeneratingEmail ? (
                  <span className="flex items-center gap-2"><div className="live-dot" /> Drafting...</span>
                ) : '✉️ Draft Email'}
              </button>
              {email && (
                <button id="export-email-btn" onClick={() => exportMd(email, 'follow-up-email.md')} className="btn-ghost text-sm">
                  ↓ Export MD
                </button>
              )}
            </div>
          </div>

          {email && (
            <div className="card animate-fade-in">
              <div className="section-title">✉️ Follow-up Email Draft</div>
              <div
                id="email-content"
                contentEditable
                suppressContentEditableWarning
                className="text-sm text-birdly-text leading-relaxed whitespace-pre-wrap outline-none min-h-32 focus:ring-1 focus:ring-birdly-accent rounded-lg p-2 -m-2 overflow-y-auto max-h-96"
              >
                {email}
              </div>
              <p className="text-xs text-birdly-muted mt-3">💡 Click to edit the draft before sending</p>
            </div>
          )}

          {!email && !isGeneratingEmail && (
            <div className="card text-center py-10">
              <div className="text-5xl mb-3 opacity-20">✉️</div>
              <p className="text-birdly-muted text-sm">No email draft yet</p>
              <p className="text-xs text-birdly-muted/60 mt-1">Complete a session and click Draft Email</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
