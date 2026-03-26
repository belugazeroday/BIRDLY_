import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import Tesseract from 'tesseract.js'

export type DocumentKind = 'knowledge' | 'resume'

export interface KBDocument {
  id: string
  name: string
  path: string
  addedAt: number
  chunkCount: number
  kind: DocumentKind
}

export interface KBChunk {
  id: string
  docId: string
  content: string
  embedding: number[]
}

export interface QueryOptions {
  kinds?: DocumentKind[]
}

export class RAGService {
  private documents: Map<string, KBDocument> = new Map()
  private chunks: KBChunk[] = []
  private pipeline: unknown = null
  private storePath: string
  private ocrWorker: Tesseract.Worker | null = null

  constructor() {
    this.storePath = path.join(app.getPath('userData'), 'knowledge_base.json')
    this.loadFromDisk()
  }

  private async getEmbeddingPipeline() {
    if (this.pipeline) return this.pipeline
    // Dynamic import to avoid blocking startup
    // @ts-ignore
    const { pipeline } = await import('@xenova/transformers')
    this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    return this.pipeline
  }

  private async embed(text: string): Promise<number[]> {
    const pipe = await this.getEmbeddingPipeline() as (
      text: string,
      opts: unknown
    ) => Promise<{ data: Float32Array }>
    const output = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data as Float32Array)
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8)
  }

  private chunkText(text: string, chunkSize = 400, overlap = 50): string[] {
    const words = text.split(/\s+/)
    const chunks: string[] = []
    let i = 0
    while (i < words.length) {
      chunks.push(words.slice(i, i + chunkSize).join(' '))
      i += chunkSize - overlap
    }
    return chunks
  }

  async addDocument(
    filePath: string,
    options: { kind?: DocumentKind; name?: string } = {}
  ): Promise<KBDocument> {
    const ext = path.extname(filePath).toLowerCase()
    let text = ''

    if (ext === '.txt' || ext === '.md') {
      text = fs.readFileSync(filePath, 'utf-8')
    } else if (ext === '.pdf') {
      const pdfModule = await import('pdf-parse')
      const pdfParse = (pdfModule as any).default ?? pdfModule
      const buf = fs.readFileSync(filePath)
      const data = await pdfParse(buf)
      text = data.text
    } else if (ext === '.docx') {
      const mammothModule = await import('mammoth')
      const mammoth = (mammothModule as any).default ?? mammothModule
      const result = await mammoth.extractRawText({ path: filePath })
      text = result.value
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      text = await this.extractImageText(filePath)
    } else {
      throw new Error(`Unsupported file type: ${ext}`)
    }

    return this.addTextDocument(options.name ?? path.basename(filePath), text, {
      kind: options.kind,
      path: filePath,
    })
  }

  async addTextDocument(
    name: string,
    text: string,
    options: { kind?: DocumentKind; path?: string } = {}
  ): Promise<KBDocument> {
    if (!text.trim()) {
      throw new Error(`No extractable text found in ${name}`)
    }

    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const rawChunks = this.chunkText(text)
    const embeddedChunks: KBChunk[] = []

    for (const content of rawChunks) {
      if (content.trim().length < 20) continue
      const embedding = await this.embed(content)
      embeddedChunks.push({
        id: `chunk_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        docId: id,
        content,
        embedding,
      })
    }

    const doc: KBDocument = {
      id,
      name,
      path: options.path ?? name,
      addedAt: Date.now(),
      chunkCount: embeddedChunks.length,
      kind: options.kind ?? 'knowledge',
    }

    this.documents.set(id, doc)
    this.chunks.push(...embeddedChunks)
    this.saveToDisk()

    return doc
  }

  private async extractImageText(filePath: string): Promise<string> {
    if (!this.ocrWorker) {
      this.ocrWorker = await Tesseract.createWorker('eng', 1, { logger: () => {} })
    }
    const result = await this.ocrWorker.recognize(filePath)
    return result.data.text?.trim() ?? ''
  }

  removeDocument(id: string): boolean {
    const existed = this.documents.delete(id)
    this.chunks = this.chunks.filter((chunk) => chunk.docId !== id)
    this.saveToDisk()
    return existed
  }

  removeDocumentsByKind(kind: DocumentKind): number {
    const idsToRemove = Array.from(this.documents.values())
      .filter((doc) => doc.kind === kind)
      .map((doc) => doc.id)

    for (const id of idsToRemove) {
      this.documents.delete(id)
    }

    if (idsToRemove.length > 0) {
      const removed = new Set(idsToRemove)
      this.chunks = this.chunks.filter((chunk) => !removed.has(chunk.docId))
      this.saveToDisk()
    }

    return idsToRemove.length
  }

  listDocuments(options: QueryOptions = {}): KBDocument[] {
    const kinds = options.kinds
    const documents = Array.from(this.documents.values())
    return kinds?.length
      ? documents.filter((doc) => kinds.includes(doc.kind))
      : documents
  }

  async query(
    queryText: string,
    topK = 3,
    options: QueryOptions = {}
  ): Promise<Array<{ content: string; score: number; docName: string; kind: DocumentKind }>> {
    const documents = options.kinds?.length
      ? new Set(
          Array.from(this.documents.values())
            .filter((doc) => options.kinds!.includes(doc.kind))
            .map((doc) => doc.id)
        )
      : null

    const candidateChunks = documents
      ? this.chunks.filter((chunk) => documents.has(chunk.docId))
      : this.chunks

    if (candidateChunks.length === 0) return []

    const queryEmbedding = await this.embed(queryText)

    const scored = candidateChunks.map((chunk) => {
      const doc = this.documents.get(chunk.docId)
      return {
        content: chunk.content,
        docName: doc?.name ?? 'Unknown',
        kind: doc?.kind ?? 'knowledge',
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
      }
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  private saveToDisk() {
    try {
      const data = {
        documents: Array.from(this.documents.entries()),
        chunks: this.chunks,
      }
      fs.writeFileSync(this.storePath, JSON.stringify(data), 'utf-8')
    } catch (err) {
      console.error('[RAG] Save error:', err)
    }
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(this.storePath)) return
      const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
      this.documents = new Map(
        (data.documents ?? []).map(([id, doc]: [string, Partial<KBDocument>]) => [
          id,
          {
            ...doc,
            id,
            kind: doc.kind ?? 'knowledge',
          } as KBDocument,
        ])
      )
      this.chunks = data.chunks || []
    } catch (err) {
      console.error('[RAG] Load error:', err)
    }
  }
}
