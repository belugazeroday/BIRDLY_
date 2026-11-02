export function createRecorder(stream: MediaStream): MediaRecorder {
  const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type))
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
}

export async function convertBlobToMono16kPcm(blob: Blob): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new OfflineAudioContext(1, 1, 48000)
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const channelData =
      audioBuffer.numberOfChannels > 1 ? mixToMono(audioBuffer) : audioBuffer.getChannelData(0)
    const resampled = resampleLinear(channelData, audioBuffer.sampleRate, 16000)
    return Array.from(resampled)
  } catch {
    return []
  }
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length
  const mixed = new Float32Array(length)
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      mixed[i] += data[i] / audioBuffer.numberOfChannels
    }
  }
  return mixed
}

function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return input
  const ratio = sourceRate / targetRate
  const newLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const left = Math.floor(srcIndex)
    const right = Math.min(left + 1, input.length - 1)
    const t = srcIndex - left
    output[i] = input[left] * (1 - t) + input[right] * t
  }
  return output
}
