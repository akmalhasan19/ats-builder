import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { t, type TranslationKey } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { usePreviewStore } from '@/store/previewStore'
import { AppShell } from '@/app/AppShell'
import { paginationDoc, type PaginationFixtureName } from '../../../tests/fixtures/docs'

const FIXTURES: { name: PaginationFixtureName; labelKey: TranslationKey }[] = [
  { name: 'pendek', labelKey: 'pagination.fixture.pendek' },
  { name: 'sedang', labelKey: 'pagination.fixture.sedang' },
  { name: 'panjang', labelKey: 'pagination.fixture.panjang' },
]

/**
 * Harness dev-only untuk bukti Gate Fase 4: memuat fixture pendek / sedang /
 * panjang ke dalam ruang kerja nyata (rail + form + preview). Rute `/dev/*`
 * di-DCE dari build produksi, jadi fixture tidak ikut terbundel.
 */
export default function PaginationPage() {
  const [fixture, setFixture] = useState<PaginationFixtureName>('sedang')

  useEffect(() => {
    usePreviewStore.getState().resetHeights()
    useDocStore.getState().loadDoc(paginationDoc(fixture))
  }, [fixture])

  return (
    <div className="flex min-h-dvh flex-col">
      <div
        data-probe="pagination-harness"
        className="border-rule bg-sunken flex flex-wrap items-center gap-2 border-b px-4 py-2"
      >
        <span className="text-eyebrow">{t('pagination.dev.label')}</span>
        {FIXTURES.map((item) => (
          <Button
            key={item.name}
            type="button"
            size="sm"
            variant={fixture === item.name ? 'primary' : 'subtle'}
            data-fixture={item.name}
            onClick={() => setFixture(item.name)}
          >
            {t(item.labelKey)}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 lg:h-[calc(100dvh-52px)] lg:overflow-hidden">
        <AppShell />
      </div>
    </div>
  )
}
