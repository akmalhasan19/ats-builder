import { Suspense, lazy, type ReactNode } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from './AppShell'
import { ErrorScreen } from './ErrorScreen'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import type { TranslationKey } from '@/lib/i18n'

function createDevRoutes(): RouteObject[] {
  const TokensPage = lazy(() => import('./dev/TokensPage'))
  const PdfSpikePage = lazy(() => import('./dev/PdfSpikePage'))
  const PreviewSpikePage = lazy(() => import('./dev/PreviewSpikePage'))
  const PersistPage = lazy(() => import('./dev/PersistPage'))
  const PaginationPage = lazy(() => import('./dev/PaginationPage'))

  const mounted = (page: ReactNode): ReactNode => <Suspense fallback={null}>{page}</Suspense>

  return [
    { path: '/dev/tokens', element: mounted(<TokensPage />) },
    { path: '/dev/pdf', element: mounted(<PdfSpikePage />) },
    { path: '/dev/preview', element: mounted(<PreviewSpikePage />) },
    { path: '/dev/persist', element: mounted(<PersistPage />) },
    { path: '/dev/pagination', element: mounted(<PaginationPage />) },
  ]
}

const placeholder = (path: string, titleKey: TranslationKey): RouteObject => ({
  path,
  element: <PlaceholderPage titleKey={titleKey} />,
  errorElement: <ErrorScreen />,
})

// Kondisinya harus literal di sini supaya bundler membuang `createDevRoutes`
// — bersama dynamic import halaman dev dan chunk PDF-nya — dari build produksi.
export const router = createBrowserRouter([
  { path: '/', element: <AppShell />, errorElement: <ErrorScreen /> },
  { path: '/r/:resumeId', element: <AppShell />, errorElement: <ErrorScreen /> },
  placeholder('/templates', 'route.templates'),
  placeholder('/dashboard', 'route.dashboard'),
  placeholder('/login', 'route.login'),
  placeholder('/auth/callback', 'route.authCallback'),
  placeholder('/privacy', 'route.privacy'),
  placeholder('/terms', 'route.terms'),
  placeholder('/cover-letter', 'route.coverLetter'),
  ...(import.meta.env.DEV || __DEV_PAGES__ ? createDevRoutes() : []),
  { path: '*', element: <NotFoundPage />, errorElement: <ErrorScreen /> },
])
