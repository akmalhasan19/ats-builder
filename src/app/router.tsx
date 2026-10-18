import { Suspense, lazy, type ReactNode } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { RootPage } from './RootPage'

function createDevRoutes(): RouteObject[] {
  const TokensPage = lazy(() => import('./dev/TokensPage'))
  const PdfSpikePage = lazy(() => import('./dev/PdfSpikePage'))
  const PreviewSpikePage = lazy(() => import('./dev/PreviewSpikePage'))

  const mounted = (page: ReactNode): ReactNode => <Suspense fallback={null}>{page}</Suspense>

  return [
    { path: '/dev/tokens', element: mounted(<TokensPage />) },
    { path: '/dev/pdf', element: mounted(<PdfSpikePage />) },
    { path: '/dev/preview', element: mounted(<PreviewSpikePage />) },
  ]
}

// Kondisinya harus literal di sini supaya bundler membuang `createDevRoutes`
// — bersama dynamic import halaman dev dan chunk PDF-nya — dari build produksi.
export const router = createBrowserRouter([
  { path: '/', element: <RootPage /> },
  ...(import.meta.env.DEV || __DEV_PAGES__ ? createDevRoutes() : []),
  { path: '*', element: <RootPage /> },
])
