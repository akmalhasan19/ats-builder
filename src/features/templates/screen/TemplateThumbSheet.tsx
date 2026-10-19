import { useDeferredValue, useMemo } from 'react'
import { A4_PX } from '@/lib/units'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { resolveSpec } from '@/features/templates/specs'
import type { TemplateId } from '@/types/resume'
import { PageSheet } from '@/features/preview/PageSheet'
import { BlockView } from './BlockView'

export type TemplateThumbSheetProps = {
  templateId: TemplateId
  /** 0.16 popover §5.2 · 0.24 galeri §5.8 · 0.6 halaman /templates (T6.4). */
  scale: number
  className?: string
}

/**
 * Render nyata template (T6.4) di atas dokumen yang sedang aktif — bukan gambar
 * statis. Halaman dihitung dari jalur estimasi (tanpa pengukuran DOM), dan
 * `BlockView` diberi `scope` per template: tinggi antar-template berbeda, dan
 * store tinggi bersifat global — tanpa scope thumbnail menimpa metrik pratinjau.
 * Melebihi satu halaman dipotong; thumbnail hanya menjanjikan lembar pertama.
 */
export function TemplateThumbSheet({ templateId, scale, className }: TemplateThumbSheetProps) {
  // QA Fase 9: thumbnail ikut render dokumen nyata, tapi render-nya tidak boleh
  // menang atas ketikan. Nilai dokumen ditunda (React deferred) sehingga layar
  // kerja tetap responsif di CPU lambat, dan thumbnail mengejar saat idle.
  const liveDoc = useDocStore((state) => state.doc)
  const doc = useDeferredValue(liveDoc)
  const spec = useMemo(
    () => resolveSpec(templateId, doc.theme, doc.settings.page),
    [templateId, doc.theme, doc.settings.page],
  )
  const plan = useMemo(() => createPagePlan(doc, spec), [doc, spec])
  const firstPage = plan.pages[0] ?? []
  const scope = `thumb-${templateId}`

  return (
    <div
      role="img"
      aria-label={t('templates.thumbLabel', { name: t(`template.${templateId}`) })}
      className={className}
      style={{ width: A4_PX.w * scale, height: A4_PX.h * scale, overflow: 'hidden' }}
    >
      <div style={{ width: A4_PX.w, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <PageSheet pageNumber={1} pageCount={plan.pageCount} spec={spec} marginPx={plan.marginPx}>
          {firstPage.map((block) => (
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
              keywords={[]}
              showMarks={false}
            />
          ))}
        </PageSheet>
      </div>
    </div>
  )
}
