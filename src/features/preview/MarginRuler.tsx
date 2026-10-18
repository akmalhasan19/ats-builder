import { memo } from 'react'
import { A4_PX, mmToPx } from '@/lib/units'

const TICK_EVERY_MM = 10
const LABEL_EVERY_MM = 20
const TICK_PX = 4

/**
 * §5.5 / §2.5 — penggaris margin hidup. Tick & label ditempatkan di pita margin
 * kertas sendiri (bukan menggantung di luar sheet) supaya tidak pernah memicu
 * scroll horizontal di well pada zoom besar.
 */
const marks = (lengthPx: number): { mm: number; atPx: number }[] => {
  const stepPx = mmToPx(TICK_EVERY_MM)
  const out: { mm: number; atPx: number }[] = []
  for (let mm = 0, at = 0; at <= lengthPx; mm += TICK_EVERY_MM, at += stepPx)
    out.push({ mm, atPx: at })
  return out
}

export const MarginRuler = memo(function MarginRuler({ marginPx }: { marginPx: number }) {
  const guide = 'var(--color-margin-guide)'
  const tick = { position: 'absolute', background: guide, opacity: 0.35 } as const

  return (
    <div
      data-probe="margin-ruler"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      <div
        style={{
          position: 'absolute',
          left: marginPx,
          top: marginPx,
          right: marginPx,
          bottom: marginPx,
          border: `1px solid ${guide}`,
        }}
      />
      {marks(A4_PX.w).map(({ mm, atPx }) => (
        <div key={`h-${mm}`}>
          <div style={{ ...tick, top: 0, left: atPx, width: 1, height: TICK_PX }} />
          {mm % LABEL_EVERY_MM === 0 ? (
            <span
              className="text-ruler-label"
              style={{ position: 'absolute', top: TICK_PX, left: atPx + 1 }}
            >
              {mm}
            </span>
          ) : null}
        </div>
      ))}
      {marks(A4_PX.h).map(({ mm, atPx }) => (
        <div key={`v-${mm}`}>
          <div style={{ ...tick, left: 0, top: atPx, width: TICK_PX, height: 1 }} />
          {mm % LABEL_EVERY_MM === 0 && mm > 0 ? (
            <span
              className="text-ruler-label"
              style={{ position: 'absolute', left: TICK_PX + 2, top: atPx - 4 }}
            >
              {mm}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
})
