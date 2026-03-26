import { EventEmitter } from 'events'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

// Speech-To-Text using Xenova Whisper (runs in a child worker to avoid blocking main process)
// Due to Electron's architecture, we use a lightweight approach:
// we record audio chunks in renderer via MediaRecorder, send them to main via IPC,
// then process with Whisper in the main process.
export class STTService extends EventEmitter {
  private pipeline: unknown = null
  private isRunning = false
  private onTranscript: (text: string) => void
  private isProcessing = false
  private pendingAudio: number[] | null = null

  constructor(onTranscript: (text: string) => void) {
    super()
    this.onTranscript = onTranscript
  }

  start() {
    this.isRunning = true
  }

  stop() {
    this.isRunning = false
  }

  async warmup(): Promise<void> {
    await this.getPipeline()
  }

  // Called from IPC when renderer sends audio chunk (Float32Array PCM)
  async processAudioChunk(audioData: number[]): Promise<void> {
    if (!this.isRunning) return
    if (this.isProcessing) {
      // Keep only the latest chunk to reduce latency buildup.
      this.pendingAudio = audioData
      return
    }

    this.isProcessing = true
    try {
      const pipe = await this.getPipeline()
      const float32 = new Float32Array(audioData)

      // @ts-ignore
      const result = await pipe(float32, {
        task: 'transcribe',
        chunk_length_s: 15,
        stride_length_s: 3,
      })

      const text = Array.isArray(result)
        ? result.map((r: {text: string}) => r.text).join(' ').trim()
        : (result as { text: string }).text?.trim() ?? ''

      if (text && text.length > 2) {
        this.onTranscript(text)
      }
    } catch (err) {
      console.error('[STT] Error processing chunk:', err)
    } finally {
      this.isProcessing = false
      if (this.pendingAudio && this.isRunning) {
        const pending = this.pendingAudio
        this.pendingAudio = null
        await this.processAudioChunk(pending)
      }
    }
  }

  private async getPipeline() {
    if (this.pipeline) return this.pipeline
    // @ts-ignore
    const { pipeline, env } = await import('@xenova/transformers')

    // Cache models in userData dir
    env.cacheDir = path.join(app.getPath('userData'), 'models')

    this.pipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en')
    return this.pipeline
  }
}
