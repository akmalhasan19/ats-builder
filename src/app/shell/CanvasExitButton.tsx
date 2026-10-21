import { Minimize2 } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { t } from '@/lib/i18n'
import { useUiStore } from '@/store/uiStore'
import { useCanvasFull } from '../useCanvasFull'

/**
 * FASE 13 — T3.3 (D2/D6) — jalan keluar pertama dari kertas layar penuh.
 *
 * Aksi tombol ini **tidak** mengganti `editMode`: pengguna tetap berada di mode
 * "Langsung di CV", hanya kembali berpanel (rail & formulir muncul lagi).
 * Jalan keluar kedua — kembali ke "Form terpandu" — tetap lewat `TampilanMenu`,
 * dengan label yang berbeda supaya keduanya tidak tertukar.
 *
 * FASE 13 (T5.2/T5.3) — di bawah 640px tombol ini hanya ikon, jadi
 * `canvas.fullscreenExitHint` dipakai sebagai tooltip: keterangan singkat
 * tentang apa yang terjadi setelah tombol ditekan.
 */
export function CanvasExitButton() {
  const canvasFull = useCanvasFull()
  const setCanvasFullscreen = useUiStore((state) => state.setCanvasFullscreen)

  if (!canvasFull) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          size="sm"
          variant="ghost"
          label={t('canvas.fullscreenExit')}
          data-probe="canvas-exit"
          className="rounded"
          onClick={() => setCanvasFullscreen(false)}
        >
          <Minimize2 className="size-3.5" aria-hidden="true" />
        </IconButton>
      </TooltipTrigger>
      <TooltipContent>{t('canvas.fullscreenExitHint')}</TooltipContent>
    </Tooltip>
  )
}
