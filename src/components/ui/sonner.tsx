'use client'

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useUiStore } from '@/store/uiStore'

/* §5.11 — toast adalah satu-satunya tempat --machine muncul di chrome; MVP
   tidak punya dark mode, jadi theme dikunci 'light'. */
const Toaster = ({ ...props }: ToasterProps) => {
  const compact = useUiStore((state) => state.panelMode === 'tabs')

  return (
    <Sonner
      theme="light"
      className="toaster group"
      duration={3500}
      visibleToasts={3}
      position={compact ? 'top-center' : 'bottom-right'}
      // §5.11 — di mobile toast duduk **di bawah top bar** (52px) + tab bar
      // (44px). Tanpa offset, toast menutupi tombol Menu di kanan top bar dan
      // menelan klik selama 3,5 detik (ditemukan oleh e2e C5.6). Sonner memakai
      // `mobileOffset` untuk viewport sentuh, jadi keduanya diisi.
      offset={compact ? { top: 104 } : undefined}
      mobileOffset={compact ? { top: 104 } : undefined}
      closeButton={false}
      icons={{
        success: <CircleCheckIcon className="text-signal-ok size-4" />,
        info: <InfoIcon className="text-accent-ink size-4" />,
        warning: <TriangleAlertIcon className="text-signal-warn size-4" />,
        error: <OctagonXIcon className="text-signal-bad size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'bg-machine text-machine-text border-0 rounded-lg px-3.5 py-2.5 text-button items-start gap-2 shadow-[var(--shadow-dialog)]',
          description: 'text-machine-dim',
          actionButton: 'bg-accent text-accent-on',
          cancelButton: 'bg-machine-dim text-machine-text',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--machine)',
          '--normal-text': 'var(--machine-text)',
          '--normal-border': 'transparent',
          '--border-radius': 'var(--radius)',
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
