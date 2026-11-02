import Tesseract from 'tesseract.js'
import { getTesseractOptions } from './tessdata'

export class OCRService {
  private worker: Tesseract.Worker | null = null

  async init() {
    if (this.worker) return
    this.worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {}, // Silence logger
      ...getTesseractOptions(),
    })
  }

  async extractText(imageBuffer: Buffer): Promise<string> {
    await this.init()
    if (!this.worker) return ''
    const result = await this.worker.recognize(imageBuffer)
    return result.data.text.trim()
  }

  async terminate() {
    await this.worker?.terminate()
    this.worker = null
  }
}
