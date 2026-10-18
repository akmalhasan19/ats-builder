import type { CSSProperties, ReactNode } from 'react'
import { A4_PX } from '@/lib/units'
import { t } from '@/lib/i18n'
import type { TemplateSpec } from '@/features/templates/specs'
import { screenStylesOf } from '@/features/templates/screen/screenStyles'

/** §5.5 PageSheet — `794 × 1123`, kertas paling terang, radius 1px, shadow §2.4. */
export type PageSheetProps = {
  pageNumber: number
  pageCount: number
  spec: TemplateSpec
  marginPx: number
  children: ReactNode
}

const sheetSize = (marginPx: number): CSSProperties => ({
  width: A4_PX.w,
  height: A4_PX.h,
  padding: marginPx,
  boxSizing: 'border-box',
  overflow: 'hidden',
  // T4.5 — sheet di luar viewport tidak perlu melukis isinya.
  contentVisibility: 'auto',
  containIntrinsicSize: `${A4_PX.w}px ${A4_PX.h}px`,
})

export function PageSheet({ pageNumber, pageCount, spec, marginPx, children }: PageSheetProps) {
  return (
    <section
      data-probe="page-sheet"
      data-page-number={pageNumber}
      aria-label={t('workspace.pageLabel', { page: pageNumber, total: pageCount })}
      className="rounded-paper bg-raised shadow-paper"
      style={{ ...sheetSize(marginPx), ...screenStylesOf(spec).sheet }}
    >
      {children}
    </section>
  )
}
