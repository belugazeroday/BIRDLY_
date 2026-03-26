import { Ollama } from 'ollama'
import { SettingsStore } from './settings'

interface ChatPayload {
  model: string
  messages: Array<{ role: string; content: string }>
  system?: string
}

export class LLMService {
  constructor(private ollama: Ollama, private settings: SettingsStore) {}

  async chat(payload: ChatPayload): Promise<{ content: string } | { error: string }> {
    try {
      const cfg = this.settings.get()
      const messages = payload.system
        ? [{ role: 'system', content: payload.system }, ...payload.messages]
        : payload.messages

      const response = await this.ollama.chat({
        model: payload.model || cfg.model,
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
    const messages = payload.system
      ? [{ role: 'system', content: payload.system }, ...payload.messages]
      : payload.messages

    const stream = await this.ollama.chat({
      model: payload.model || cfg.model,
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
