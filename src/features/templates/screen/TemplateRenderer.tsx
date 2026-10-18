import { memo } from 'react'
import { useUiStore } from '@/store/uiStore'
import { PageSheet } from '@/features/preview/PageSheet'
import { MarginRuler } from '@/features/preview/MarginRuler'
import { t } from '@/lib/i18n'
import type { TemplateSpec } from '../specs'
import type { PagePlan } from '@/features/preview/pagination'
import { BlockView } from './BlockView'

const NO_KEYWORDS: readonly string[] = []

export type TemplateRendererProps = {
  plan: PagePlan
  spec: TemplateSpec
  keywords?: readonly string[]
  showMarks?: boolean
  /** Namespace kunci pengukuran untuk salinan di luar pratinjau utama (T6.4). */
  scope?: string
}

/**
 * Renderer layar generik (T4.4). Pemecahan halaman datang dari `PagePlan`
 * (`usePagination`) — mesin yang sama nanti dipakai PDF — dan setiap nilai gaya
 * datang dari `TemplateSpec`, tidak ada angka layout di komponen.
 */
export const TemplateRenderer = memo(function TemplateRenderer({
  plan,
  spec,
  keywords = NO_KEYWORDS,
  showMarks = false,
  scope,
}: TemplateRendererProps) {
  const showMarginGuides = useUiStore((state) => state.showMarginGuides)

  return (
    <div
      data-probe="preview-renderer"
      className="animate-paper-settle flex flex-col items-center gap-6"
    >
      {plan.pages.map((pageBlocks, index) => (
        <figure
          key={pageBlocks[0]?.key ?? `page-${index}`}
          className="m-0 flex flex-col items-center gap-2"
        >
          <div className="relative">
            <PageSheet
              pageNumber={index + 1}
              pageCount={plan.pageCount}
              spec={spec}
              marginPx={plan.marginPx}
            >
              {pageBlocks.map((block) => (
                <BlockView
                  key={block.key}
                  scope={scope}
                  blockKey={block.key}
                  kind={block.kind}
                  sectionKind={block.sectionKind}
                  sectionId={block.sectionId}
                  itemId={block.itemId}
                  lineIndex={block.lineIndex}
                  padAfterMm={block.padAfterMm}
                  spec={spec}
                  keywords={keywords}
                  showMarks={showMarks}
                />
              ))}
            </PageSheet>
            {showMarginGuides ? <MarginRuler marginPx={plan.marginPx} /> : null}
          </div>
          <figcaption data-probe="page-caption" className="text-page-caption">
            {t('workspace.previewCaption')} {index + 1}
          </figcaption>
        </figure>
      ))}
    </div>
  )
})
