import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { AlertCircle } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fieldLabelOf } from '@/features/templates/fieldSegments'
import { useCanvasStore } from '@/store/canvasStore'
import { useDocStore } from '@/store/docStore'
import { validateCanvasField, writeCanvasField } from './canvasCommit'
import { startCaretFollow, stopCaretFollow } from './canvasCaretFollow'
import { isNarrowLayout } from './canvasEditZoom'
import { normalizeCanvasValue, readCanvasFieldValue, type CanvasFieldSpec } from './canvasFields'

/**
 * C3.1 — editor in-place di atas kertas (D3).
 *
 * Kontrol swap-in: field single-line jadi `<input>`, ringkasan jadi
 * `<textarea>` auto-grow, daftar skill jadi input teks bebas yang dipecah
 * per koma saat commit. Siklusnya: klik/Enter pada segmen → control
 * menggantikan teks (guide jadi placeholder) dengan fokus + select; Enter
 * commit (Ctrl/Cmd+Enter untuk textarea), Escape batal, blur commit.
 *
 * Field wajib boleh dikosongkan: nilai kosong tetap ditulis (validasi zod
 * memang mengizinkannya) dan slotnya menampilkan guide lagi — bukan revert
 * + toast.
 *
 * Penulisan memakai jalur yang sama dengan form — `docStore.updateSection` —
 * sehingga autosave, validasi zod, dan undo punya satu sumber (D8). Jendela
 * coalesce history diputus sebelum & sesudah commit supaya satu sesi edit =
 * satu langkah undo (D9).
 *
 * FASE 14C — di layar sempit, komponen ini juga menjadi titik integrasi
 * **kamera mengikuti caret**: begitu sesi dibuka, follow dinyalakan supaya
 * kertas bergerak sedikit demi sedikit mengikuti ketikan (lihat
 * `canvasCaretFollow.ts`).
 */

export type CanvasFieldEditorProps = {
  /** Target field, widget, dan aturan wajib-nya. */
  spec: CanvasFieldSpec
  /** Teks guide — dipakai sebagai placeholder control (D5). */
  guideText: string
  /** Peran tipografi segmen yang digantikan (gaya template, tanpa angka). */
  style?: CSSProperties
}

export function CanvasFieldEditor({ spec, guideText, style }: CanvasFieldEditorProps) {
  const currentValue = useDocStore((state) => readCanvasFieldValue(state.doc, spec.target))
  const closeSession = useCanvasStore((state) => state.closeSession)
  const [draft, setDraft] = useState(currentValue)
  const [error, setError] = useState<string | null>(null)
  const controlRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const settledRef = useRef(false)

  // Fokus + pilih seluruh teks begitu sesi dibuka (D3).
  //
  // `preventScroll` penting: secara bawaan browser memunculkan "scroll into
  // view" yang akan menggulir sumbu horizontal ke tepi elemen — persis
  // membatalkan penjajaran field yang baru saja dihitung (addendum layar
  // sempit).
  useEffect(() => {
    const control = controlRef.current
    if (!control) return
    control.focus({ preventScroll: true })
    control.select()
  }, [])

  // FASE 14C — **kamera mengikuti caret** saat mengetik.
  //
  // Hanya di layar sempit (panel mode `tabs`): di desktop kertas muat di
  // layar, jadi tidak ada yang perlu digeser.
  //
  // Editor tanggal (Sheet mobile) tidak mengetik di atas kertas sehingga tidak
  // ikut follow; semua jalur lain — klik segmen, ghost row (entri/bullet
  // baru), tombol "Perbaiki →" di drawer ATS — otomatis tercover karena
  // semuanya dirender lewat komponen ini.
  //
  // Effect ini sengaja dibuat **setelah** effect fokus di atas: penataan
  // awal field (FASE 14B) harus selesai lebih dulu, dan follow tidak
  // menggeser apa pun selama caret masih berada di dalam pita (caret awal =
  // kiri field yang memang sudah mendarat di margin kiri).
  useEffect(() => {
    const control = controlRef.current
    if (!control) return
    if (!isNarrowLayout()) return
    if (spec.widget === 'dates') return
    control.focus({ preventScroll: true })
    startCaretFollow(control)
    return () => stopCaretFollow()
  }, [spec.widget])

  // Textarea tumbuh mengikuti isinya (D3).
  useEffect(() => {
    const control = controlRef.current
    if (!control || spec.widget !== 'textarea') return
    control.style.height = 'auto'
    control.style.height = `${control.scrollHeight}px`
  }, [draft, spec.widget])

  const close = () => {
    settledRef.current = true
    closeSession()
  }

  const cancel = () => {
    if (settledRef.current) return
    close()
  }

  const commit = () => {
    if (settledRef.current) return
    const value = normalizeCanvasValue(spec.target, draft)
    const message = validateCanvasField(spec.target, value)
    if (message) {
      // Validasi gagal: editor tetap terbuka + pesan error + aria-invalid (D3).
      setError(message)
      controlRef.current?.focus()
      return
    }
    writeCanvasField(spec.target, value)
    close()
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft(event.target.value)
    if (error) setError(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key !== 'Enter') return
    // Textarea: ringkasan memakai Ctrl/Cmd+Enter (D3), bullet cukup Enter
    // karena satu bullet memang satu baris (keputusan owner OQ6).
    const wantsCommit =
      spec.widget === 'textarea' ? spec.enterCommits || event.ctrlKey || event.metaKey : true
    if (!wantsCommit) return
    event.preventDefault()
    commit()
  }

  const errorId = `canvas-field-error-${spec.guideId}`
  const shared = {
    'aria-label': t('canvas.editField', {
      field: fieldLabelOf(spec.guideId),
      value: draft.trim() === '' ? guideText : draft.trim(),
    }),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    placeholder: guideText,
    value: draft,
    onChange: handleChange,
    onBlur: commit,
    onKeyDown: handleKeyDown,
    className: 'canvas-editor',
  }

  return (
    <span className="canvas-editor-shell" style={style}>
      {spec.widget === 'textarea' ? (
        <textarea
          {...shared}
          ref={(node) => {
            controlRef.current = node
          }}
          rows={1}
        />
      ) : (
        <input
          {...shared}
          type="text"
          ref={(node) => {
            controlRef.current = node
          }}
        />
      )}
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="text-error text-signal-bad mt-0.5 flex items-start gap-1"
        >
          <AlertCircle aria-hidden="true" className="mt-px size-3 shrink-0" />
          <span>{error}</span>
        </span>
      ) : null}
    </span>
  )
}
