import { useEffect, useRef } from 'react'

const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ABCDEFﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ'

type Props = { reducedMotion: boolean; paused: boolean }

export function MatrixRain({ reducedMotion, paused }: Props) {
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
          speed: 1.2 + Math.random() * 3.5,
          chars: Array.from({ length: 24 }, () => CHARS[(Math.random() * CHARS.length) | 0]!),
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
      ctx.fillStyle = 'rgba(2, 6, 4, 0.15)'
      ctx.fillRect(0, 0, w, h)
      ctx.font = '11px ui-monospace, monospace'
      columns.forEach((col, i) => {
        const x = i * 14 + 4
        col.y += col.speed
        if (col.y > h + 40) col.y = -40
        col.chars.forEach((ch, j) => {
          const y = col.y - j * 14
          if (y < -20 || y > h + 20) return
          const head = j === 0
          ctx.fillStyle = head ? '#e8fff0' : `rgba(0, 255, 120, ${0.08 + (1 - j / col.chars.length) * 0.35})`
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

  return <canvas ref={ref} className="matrix-rain" aria-hidden />
}
