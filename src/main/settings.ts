import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface BirdlySettings {
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  overlayOpacity: number
  hotkey: string
  overlayX: number
  overlayY: number
  overlayWidth: number
  overlayHeight: number
  autoCaptureSreen: boolean
  screenCaptureInterval: number
  enableToneAnalysis: boolean
  language: string
  theme: 'dark' | 'darker' | 'glass'
  fontSize: 'sm' | 'md' | 'lg'
  showTranscript: boolean
  role: string
  outputMode: 'general' | 'interview' | 'sales' | 'negotiation' | 'coding'
  jobDescription: string
  strictScope: boolean
  resumeText: string
  resumeFileName: string
  customRoles: Array<{ name: string; prompt: string }>
}

const DEFAULTS: BirdlySettings = {
  model: 'llama3.2',
  temperature: 0.7,
  maxTokens: 512,
  systemPrompt: '',
  overlayOpacity: 0.85,
  hotkey: 'Control+Shift+B',
  overlayX: -1,
  overlayY: -1,
  overlayWidth: 620,
  overlayHeight: 520,
  autoCaptureSreen: false,
  screenCaptureInterval: 10,
  enableToneAnalysis: false,
  language: 'en',
  theme: 'dark',
  fontSize: 'md',
  showTranscript: true,
  role: 'General Coach',
  outputMode: 'general',
  jobDescription: '',
  strictScope: true,
  resumeText: '',
  resumeFileName: '',
  customRoles: [
    {
      name: 'Sales Coach',
      prompt: 'You are an expert sales coach. Focus on objection handling, closing techniques, and rapport building. Suggest specific rebuttals and talking points.',
    },
    {
      name: 'Interview Coach',
      prompt: 'You are an expert interview coach. Help structure STAR answers, suggest follow-up questions, highlight strengths to emphasize.',
    },
    {
      name: 'Negotiation Coach',
      prompt: 'You are a master negotiator. Identify leverage points, suggest anchoring strategies, and recommend when to concede or push harder.',
    },
    {
      name: 'Technical Interview',
      prompt: 'You are a technical interview coach. Suggest code approaches, data structures, algorithm hints, and help explain complexity.',
    },
  ],
}

export class SettingsStore {
  private settings: BirdlySettings
  private filePath: string

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'birdly-settings.json')
    this.settings = this.load()
  }

  get(): BirdlySettings {
    return { ...this.settings }
  }

  save(partial: Partial<BirdlySettings>) {
    this.settings = { ...this.settings, ...partial }
    fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
  }

  private load(): BirdlySettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
        return { ...DEFAULTS, ...raw }
      }
    } catch {}
    return { ...DEFAULTS }
  }
}
