import { useEffect } from 'react'
import { useDocStore } from '@/store/docStore'

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

/**
 * C1.1 — undo/redo tingkat dokumen. Saat fokus berada di field teks, shortcut
 * diserahkan ke browser supaya undo bawaan field itu tetap bekerja.
 */
export function useUndoRedoShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      const isUndo = key === 'z' && !event.shiftKey
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y'
      if (!isUndo && !isRedo) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      const store = useDocStore.getState()
      if (isUndo) store.undo()
      else store.redo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
