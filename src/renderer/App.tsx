import React, { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import KnowledgeBase from './pages/KnowledgeBase'
import PostMeeting from './pages/PostMeeting'

export type Page = 'dashboard' | 'settings' | 'knowledge' | 'postmeeting'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const hasBirdlyBridge = typeof window !== 'undefined' && typeof window.birdly !== 'undefined'

  if (!hasBirdlyBridge) {
    return <WebPreview />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-birdly-bg">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-auto">
        {page === 'dashboard' && <Dashboard />}
        {page === 'settings' && <Settings />}
        {page === 'knowledge' && <KnowledgeBase />}
        {page === 'postmeeting' && <PostMeeting />}
      </main>
    </div>
  )
}

function Sidebar({
  currentPage,
  onNavigate,
}: {
  currentPage: Page
  onNavigate: (page: Page) => void
}) {
  const nav: Array<{ id: Page; icon: string; label: string }> = [
    { id: 'dashboard', icon: '⚡', label: 'Live Coach' },
    { id: 'knowledge', icon: '📚', label: 'Knowledge' },
    { id: 'postmeeting', icon: '📝', label: 'Post-Meeting' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  return (
    <aside className="flex flex-col w-[64px] bg-birdly-surface border-r border-birdly-border py-4 items-center gap-1 shrink-0">
      <div className="mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-violet-800 flex items-center justify-center text-lg shadow-lg glow-accent">
          🐦
        </div>
      </div>

      {nav.map((item) => (
        <button
          key={item.id}
          id={`nav-${item.id}`}
          onClick={() => onNavigate(item.id)}
          title={item.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-200 titlebar-no-drag ${
            currentPage === item.id
              ? 'bg-birdly-accent/20 text-birdly-accent-light border border-birdly-accent/30'
              : 'text-birdly-muted hover:text-birdly-text hover:bg-birdly-border'
          }`}
        >
          {item.icon}
        </button>
      ))}
    </aside>
  )
}

function WebPreview() {
  const featureCards = [
    {
      title: 'Stealth Overlay',
      copy: 'Always-on-top floating guidance with transcript-aware answers that stay off common screen-share captures in the desktop build.',
    },
    {
      title: 'Resume + Context',
      copy: 'Birdly can load your resume, job description, OCR context, and local docs so answers stay tight and personal.',
    },
    {
      title: 'Local-First Coaching',
      copy: 'The full product runs with Electron plus Ollama locally. This Vercel deployment is a browser preview, not the desktop runtime.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#050816] text-white overflow-auto">
      <div className="relative isolate min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(45,212,191,0.18),transparent_26%),linear-gradient(180deg,#050816_0%,#09111d_100%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px]" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
          <div className="mb-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 via-cyan-400 to-teal-400 text-lg font-black text-slate-950 shadow-[0_14px_40px_rgba(34,211,238,0.28)]">
                B
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                  Birdly
                </div>
                <div className="text-sm text-white/55">Desktop AI performance coach</div>
              </div>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/65">
              Vercel web preview
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-cyan-100">
                Fast local Cluely alternative
              </div>
              <h1 className="max-w-4xl text-5xl font-semibold leading-tight text-white md:text-6xl">
                Real-time interview and meeting coaching, built for the desktop.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
                This Vercel deployment hosts the browser-safe preview. The live transcript, stealth
                overlay, drag-anywhere widget, OCR, and resume-aware coaching all run in the Electron
                desktop app.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                  Desktop build required for full experience
                </div>
                <a
                  href="/overlay.html"
                  className="rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-medium text-white/82 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                >
                  Open overlay preview
                </a>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl">
              <div className="rounded-[28px] border border-white/8 bg-[#0a1322] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
                    Browser-safe preview
                  </div>
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-400/12 px-3 py-1 text-[10px] font-medium text-emerald-100">
                    Ready
                  </div>
                </div>
                <div className="space-y-3">
                  {featureCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4"
                    >
                      <div className="text-sm font-semibold text-white">{card.title}</div>
                      <div className="mt-2 text-sm leading-7 text-white/62">{card.copy}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {[
              'Electron desktop runtime',
              'Ollama-powered local responses',
              'Resume-aware live widget',
            ].map((pill) => (
              <div
                key={pill}
                className="rounded-[22px] border border-white/8 bg-white/[0.04] px-5 py-4 text-sm text-white/72"
              >
                {pill}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
