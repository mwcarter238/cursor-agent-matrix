import { useEffect, useRef } from 'react'

const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ABCDEFﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ'

type Props = {
  reducedMotion: boolean
  paused: boolean
  /** Canvas opacity — inspiration uses ~0.05 */
  opacity?: number
}

export function MatrixRain({ reducedMotion, paused, opacity = 0.055 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || reducedMotion) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2)

    const columns: { y: number; speed: number; chars: string[] }[] = []

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth
      const h = parent.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      columns.length = 0
      const colW = 14
      for (let x = 0; x < w / colW + 1; x++) {
        columns.push({
          y: Math.random() * h,
          speed: 1.1 + Math.random() * 3.2,
          chars: Array.from({ length: 22 }, () => CHARS[(Math.random() * CHARS.length) | 0]!),
        })
      }
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas.parentElement!)
    resize()

    const draw = () => {
      if (paused) {
        raf = requestAnimationFrame(draw)
        return
      }
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.fillStyle = 'rgba(2, 8, 2, 0.12)'
      ctx.fillRect(0, 0, w, h)
      ctx.font = '11px Share Tech Mono, ui-monospace, monospace'
      columns.forEach((col, i) => {
        const x = i * 14 + 4
        col.y += col.speed
        if (col.y > h + 40) col.y = -40
        col.chars.forEach((ch, j) => {
          const y = col.y - j * 14
          if (y < -20 || y > h + 20) return
          const head = j === 0
          ctx.fillStyle = head ? '#d8ffe8' : `rgba(0, 255, 100, ${0.06 + (1 - j / col.chars.length) * 0.32})`
          ctx.fillText(ch, x, y)
        })
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reducedMotion, paused])

  if (reducedMotion) return null

  return <canvas ref={ref} className="nx-rain-canvas" style={{ opacity }} aria-hidden />
}
