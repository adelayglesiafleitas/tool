import { useEffect, useRef, useState } from 'react'

const TOTAL = 121
const FPS = 24

function src(i) {
  return `/animacion/animacion_${String(i + 1).padStart(4, '0')}.jpg`
}

export function useScrollFrames(canvasRef) {
  const imgs = useRef([])
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const frameIdx = useRef(0)
  const rafId = useRef(null)

  useEffect(() => {
    let loaded = 0
    imgs.current = Array.from({ length: TOTAL }, (_, i) => {
      const img = new Image()
      img.onload = img.onerror = () => {
        loaded++
        if (loaded === TOTAL) setReady(true)
      }
      img.src = src(i)
      return img
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()

    function draw(idx) {
      const img = imgs.current[idx]
      if (!img?.naturalWidth) return
      const cw = canvas.width, ch = canvas.height
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
    }

    const interval = 1000 / FPS
    let last = 0

    function loop(ts) {
      if (ts - last >= interval) {
        last = ts
        draw(frameIdx.current)
        if (frameIdx.current < TOTAL - 1) {
          frameIdx.current++
        } else {
          setDone(true)
          return
        }
      }
      rafId.current = requestAnimationFrame(loop)
    }

    draw(0)
    rafId.current = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => { resize(); draw(frameIdx.current) })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafId.current)
      ro.disconnect()
    }
  }, [ready, canvasRef])

  return { ready, done }
}
