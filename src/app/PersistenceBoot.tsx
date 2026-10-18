import { useEffect } from 'react'
import { initPersistence } from '@/features/persistence/init'

/**
 * Dipasang setelah <Toaster /> agar urutan efek React menjamin subscriber
 * sonner sudah ada sebelum boot memanggil toast (mis. dokumen korup) —
 * sonner membuang toast yang datang tanpa subscriber.
 */
export function PersistenceBoot() {
  useEffect(() => {
    void initPersistence()
  }, [])
  return null
}
