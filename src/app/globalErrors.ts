import { useErrorStore } from '@/store/errorStore'

let installed = false

/** T9.6 — galat tak terduga tidak boleh berujung layar putih atau hilang senyap. */
export function registerGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    console.error('[resume-studio] galat runtime', event.error ?? event.message)
    useErrorStore.getState().showError('runtime')
  })

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[resume-studio] promise ditolak tanpa penanganan', event.reason)
    useErrorStore.getState().showError('runtime')
  })
}
