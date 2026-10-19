import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { PersistenceBoot } from '@/app/PersistenceBoot'
import { registerGlobalErrorHandlers } from '@/app/globalErrors'
import { registerServiceWorker } from '@/app/registerServiceWorker'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui/sonner'
import '../tailwind.css'

registerGlobalErrorHandlers()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster />
    <PersistenceBoot />
  </StrictMode>,
)
