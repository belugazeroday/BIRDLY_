import { Ollama } from 'ollama'
import { SettingsStore } from './settings'

interface ChatPayload {
  model: string
  messages: Array<{ role: string; content: string }>
  system?: string
}

export class LLMService {
  private modelCache: { at: number; models: string[] } | null = null

  constructor(private ollama: Ollama, private settings: SettingsStore) {}

  private async resolveModel(requested: string): Promise<string> {
    const now = Date.now()
    if (!this.modelCache || now - this.modelCache.at > 10_000) {
      try {
        const list = await this.ollama.list()
        this.modelCache = { at: now, models: list.models.map((item) => item.name) }
      } catch {
        this.modelCache = { at: now, models: [] }
      }
    }

    const models = this.modelCache.models
    if (models.length === 0) {
      throw new Error(
        'No Ollama models found. Start Ollama and pull a model, for example: ollama pull llama3.2'
      )
    }

    if (models.includes(requested)) return requested
    const family = requested.split(':')[0]
    return models.find((name) => name.split(':')[0] === family) ?? models[0]
  }

  async chat(payload: ChatPayload): Promise<{ content: string } | { error: string }> {
    try {
      const cfg = this.settings.get()
      const model = await this.resolveModel(payload.model || cfg.model)
      const messages = payload.system
        ? [{ role: 'system', content: payload.system }, ...payload.messages]
        : payload.messages

      const response = await this.ollama.chat({
        model,
        messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        options: {
          temperature: cfg.temperature ?? 0.7,
          num_predict: cfg.maxTokens ?? 512,
        },
      })
      return { content: response.message.content }
    } catch (err) {
      throw new Error(`LLM error: ${(err as Error).message}`)
    }
  }

  async stream(payload: ChatPayload, onChunk: (chunk: string) => void): Promise<void> {
    const cfg = this.settings.get()
    const model = await this.resolveModel(payload.model || cfg.model)
    const messages = payload.system
      ? [{ role: 'system', content: payload.system }, ...payload.messages]
      : payload.messages

    const stream = await this.ollama.chat({
      model,
      messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      stream: true,
      options: {
        temperature: cfg.temperature ?? 0.7,
        num_predict: cfg.maxTokens ?? 512,
      },
    })

    for await (const chunk of stream) {
      if (chunk.message?.content) {
        onChunk(chunk.message.content)
      }
    }
  }
}
