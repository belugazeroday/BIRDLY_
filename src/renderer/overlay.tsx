import React from 'react'
import ReactDOM from 'react-dom/client'
import FloatingWidget from './components/FloatingWidget'
import './styles/globals.css'

function OverlayPreview() {
  return (
    <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center px-6">
      <div className="max-w-xl rounded-[28px] border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/75">
          Birdly Overlay
        </div>
        <h1 className="mt-4 text-3xl font-semibold">Desktop-only widget preview</h1>
        <p className="mt-4 text-sm leading-7 text-white/65">
          The interactive overlay runs inside the Electron desktop app where Birdly has access to its
          local bridge, transcript stream, OCR pipeline, and always-on-top window controls.
        </p>
      </div>
    </div>
  )
}

const hasBirdlyBridge = typeof window !== 'undefined' && typeof window.birdly !== 'undefined'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {hasBirdlyBridge ? <FloatingWidget /> : <OverlayPreview />}
  </React.StrictMode>
)
