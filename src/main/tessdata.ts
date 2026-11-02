import path from 'path'
import fs from 'fs'
import { app } from 'electron'

interface TesseractOptions {
  langPath?: string
  gzip?: boolean
  workerPath?: string
  corePath?: string
}

export function getTesseractOptions(): TesseractOptions {
  const options: TesseractOptions = {}
  const destDir = path.join(app.getPath('userData'), 'tessdata')
  const dest = path.join(destDir, 'eng.traineddata')

  if (!fs.existsSync(dest)) {
    const candidates = [
      path.join(process.resourcesPath, 'eng.traineddata'),
      path.join(app.getAppPath(), 'eng.traineddata'),
    ]
    const source = candidates.find((candidate) => fs.existsSync(candidate))
    if (source) {
      fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(source, dest)
    }
  }

  if (fs.existsSync(dest)) {
    options.langPath = destDir
    options.gzip = false
  }

  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
    const workerPath = path.join(
      unpacked,
      'tesseract.js',
      'src',
      'worker-script',
      'node',
      'index.js'
    )
    const corePath = path.join(unpacked, 'tesseract.js-core')
    if (fs.existsSync(workerPath) && fs.existsSync(corePath)) {
      options.workerPath = workerPath
      options.corePath = corePath
    }
  }

  return options
}
