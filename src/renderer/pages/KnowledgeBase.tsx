import React, { useCallback, useEffect, useState } from 'react'

interface KBDoc {
  id: string
  name: string
  addedAt: number
  chunkCount: number
  kind: 'knowledge' | 'resume'
}

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<KBDoc[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isResumeDragOver, setIsResumeDragOver] = useState(false)
  const [mode, setMode] = useState<'general' | 'interview' | 'sales' | 'negotiation' | 'coding'>(
    'general'
  )
  const [jobDescription, setJobDescription] = useState('')
  const [strictScope, setStrictScope] = useState(true)
  const [resumeFileName, setResumeFileName] = useState('')

  const refreshContext = useCallback(() => {
    void window.birdly
      .listDocuments({ kinds: ['knowledge'] })
      .then((items) => setDocs(items as KBDoc[]))

    void window.birdly
      .getSettings()
      .then((settings: any) => {
        setMode(settings?.outputMode ?? 'general')
        setJobDescription(settings?.jobDescription ?? '')
        setStrictScope(Boolean(settings?.strictScope ?? true))
        setResumeFileName(settings?.resumeFileName ?? '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshContext()
    const unsubscribeResume = window.birdly.onResumeStateChanged(() => {
      refreshContext()
    })

    return () => {
      unsubscribeResume()
    }
  }, [refreshContext])

  const uploadKnowledgeFile = async (filePath: string) => {
    setIsUploading(true)
    const name = filePath.split(/[/\\]/).pop() ?? filePath
    setUploadStatus(`Processing ${name}...`)
    try {
      await window.birdly.addDocument(filePath)
      setUploadStatus(`Added ${name}`)
      refreshContext()
    } catch (err) {
      setUploadStatus(`Error: ${(err as Error).message}`)
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadStatus(''), 3000)
    }
  }

  const uploadResume = async (filePath: string) => {
    const result = await window.birdly.uploadResume(filePath)
    setUploadStatus(
      result?.success
        ? `Resume loaded: ${result.fileName}`
        : result?.error || 'Resume upload failed'
    )
    refreshContext()
    setTimeout(() => setUploadStatus(''), 3000)
  }

  const handleUploadClick = async () => {
    const files = await window.birdly.openFileDialog([
      { name: 'Knowledge Files', extensions: ['pdf', 'txt', 'md', 'docx', 'png', 'jpg', 'jpeg', 'webp'] },
    ])
    if (!files?.length) return
    for (const file of files) {
      await uploadKnowledgeFile(file)
    }
  }

  const handleRemove = async (id: string) => {
    await window.birdly.removeDocument(id)
    refreshContext()
  }

  const handleKnowledgeDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    const items = Array.from(event.dataTransfer.files)
    for (const file of items) {
      const filePath = (file as { path?: string }).path
      if (filePath) await uploadKnowledgeFile(filePath)
    }
  }, [])

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-5">
      <div className="titlebar h-9 flex items-center">
        <h1 className="text-lg font-semibold titlebar-no-drag">Knowledge Base</h1>
        <div className="titlebar-no-drag ml-auto flex items-center gap-2">
          <span className="badge-accent">{docs.length} docs</span>
          <button
            id="upload-resume-from-kb-btn"
            onClick={async () => {
              const files = await window.birdly.openFileDialog([
                { name: 'Resume', extensions: ['pdf', 'docx', 'txt', 'md'] },
              ])
              if (!files?.length) return
              await uploadResume(files[0])
            }}
            className="btn-ghost text-sm"
          >
            Add PDF Resume
          </button>
          <button
            id="upload-doc-btn"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="btn-primary text-sm"
          >
            {isUploading ? 'Processing...' : '+ Add Documents'}
          </button>
        </div>
      </div>

      <div
        onDrop={async (event) => {
          event.preventDefault()
          setIsResumeDragOver(false)
          const file = Array.from(event.dataTransfer.files).find((item) =>
            item.name.toLowerCase().endsWith('.pdf')
          )
          const filePath = (file as { path?: string } | undefined)?.path
          if (filePath) await uploadResume(filePath)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setIsResumeDragOver(true)
        }}
        onDragLeave={() => setIsResumeDragOver(false)}
        className={`rounded-2xl border p-4 transition-all duration-200 ${
          isResumeDragOver
            ? 'border-birdly-accent bg-birdly-accent/10'
            : 'border-birdly-border bg-birdly-surface/50'
        }`}
      >
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-birdly-text">Resume Context</div>
            <p className="text-xs text-birdly-text-dim mt-1">
              Drop a PDF resume here or use the button above. Birdly indexes it locally and injects it into every future coaching prompt.
            </p>
          </div>
          <div className="text-xs text-birdly-muted">
            {resumeFileName ? `Loaded: ${resumeFileName}` : 'No resume loaded'}
          </div>
        </div>
      </div>

      <div
        id="drop-zone"
        onDrop={handleKnowledgeDrop}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={handleUploadClick}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-birdly-accent bg-birdly-accent/10 scale-[1.01]'
            : 'border-birdly-border hover:border-birdly-accent/50 hover:bg-birdly-surface'
        }`}
      >
        <div className="text-4xl mb-2 opacity-60">📄</div>
        <p className="text-sm font-medium text-birdly-text">Drop files here or click to browse</p>
        <p className="text-xs text-birdly-muted mt-1">
          Supports PDF, TXT, Markdown, DOCX, PNG, JPG, WEBP
        </p>
        {uploadStatus && (
          <p className="mt-2 text-xs font-medium text-birdly-accent-light">{uploadStatus}</p>
        )}
      </div>

      {docs.length > 0 ? (
        <div className="space-y-2">
          <p className="section-title">Uploaded Documents</p>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="card flex items-center gap-3 hover:border-birdly-accent/30 transition-colors"
            >
              <div className="text-2xl opacity-70">
                {doc.name.endsWith('.pdf')
                  ? '📑'
                  : doc.name.endsWith('.docx')
                    ? '📝'
                    : doc.name.endsWith('.md')
                      ? '✍️'
                      : '📄'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-birdly-text truncate">{doc.name}</p>
                <p className="text-xs text-birdly-muted">
                  {doc.chunkCount} chunks · Added {new Date(doc.addedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                id={`remove-doc-${doc.id}`}
                onClick={() => void handleRemove(doc.id)}
                className="btn-ghost text-xs text-red-400 hover:text-red-300"
                title="Remove document"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-10">
          <div className="text-5xl mb-3 opacity-20">📚</div>
          <p className="text-birdly-muted text-sm">Your knowledge base is empty</p>
          <p className="text-xs text-birdly-muted/60 mt-1">
            Upload docs to give Birdly more context during sessions
          </p>
        </div>
      )}

      <div className="card space-y-3">
        <p className="section-title">Output Scope Mode</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            className="input"
            value={mode}
            onChange={async (event) => {
              const next = event.target.value as typeof mode
              setMode(next)
              await window.birdly.saveSettings({ outputMode: next })
            }}
          >
            <option value="general">General</option>
            <option value="interview">Interview</option>
            <option value="sales">Sales</option>
            <option value="negotiation">Negotiation</option>
            <option value="coding">Coding</option>
          </select>
          <button
            className={`btn-ghost ${
              strictScope ? 'border border-birdly-accent/40 text-birdly-accent-light' : ''
            }`}
            onClick={async () => {
              const next = !strictScope
              setStrictScope(next)
              await window.birdly.saveSettings({ strictScope: next })
            }}
          >
            {strictScope ? 'Strict Scope: ON' : 'Strict Scope: OFF'}
          </button>
        </div>
        <textarea
          className="input resize-none text-xs"
          rows={4}
          value={jobDescription}
          placeholder="Paste a job description or exact scope anchor. Birdly keeps responses in-scope."
          onChange={async (event) => {
            const next = event.target.value
            setJobDescription(next)
            await window.birdly.saveSettings({ jobDescription: next })
          }}
        />
      </div>

      <div className="text-xs text-birdly-muted/60 text-center">
        Documents are embedded locally using Xenova/all-MiniLM-L6-v2. No data leaves your machine.
      </div>
    </div>
  )
}
