import { useEffect, useRef } from 'react'
import { convertBlobToMono16kPcm, createRecorder } from './audio'

export function useMicCapture(active: boolean, onChunk: (pcm: number[]) => void) {
  const onChunkRef = useRef(onChunk)

  useEffect(() => {
    onChunkRef.current = onChunk
  }, [onChunk])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null

    const start = async () => {
      try {
        const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          nextStream.getTracks().forEach((track) => track.stop())
          return
        }

        stream = nextStream
        recorder = createRecorder(nextStream)
        recorder.ondataavailable = async (event) => {
          if (event.data.size === 0) return
          const pcm = await convertBlobToMono16kPcm(event.data)
          if (pcm.length > 0) onChunkRef.current(pcm)
        }
        recorder.start(3000)
      } catch (err) {
        console.error('[Mic] Capture error:', err)
      }
    }

    void start()

    return () => {
      cancelled = true
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [active])
}
