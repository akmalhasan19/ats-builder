import { Check, Palette } from 'lucide-react'
import { cn } from 'cn'
import { t } from '@/lib/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { useThemeStore } from '@/store/themeStore'
import { THEMES, type ThemeDefinition } from './themes'

/**
 * Swatch dua warna: separuh aksen, separuh warna pendamping. Cukup untuk
 * membedakan enam tema tanpa perlu merender contoh komponen.
 */
export function ThemeSwatch({ theme, size = 16 }: { theme: ThemeDefinition; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="border-rule shrink-0 rounded-full border"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${theme.accent} 0 50%, ${theme.secondary} 50% 100%)`,
      }}
    />
  )
}

/**
 * Daftar tema untuk sheet menu mobile. Radio asli (bukan tombol) supaya
 * pembaca layar mengumumkan "1 dari 6, terpilih".
 */
export function ThemeOptionList({ className }: { className?: string }) {
  const themeId = useThemeStore((state) => state.themeId)
  const setThemeId = useThemeStore((state) => state.setThemeId)

  return (
    <div
      role="radiogroup"
      aria-label={t('theme.title')}
      className={cn('grid grid-cols-2 gap-2', className)}
    >
      {THEMES.map((theme) => {
        const active = theme.id === themeId
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-probe={`theme-option-${theme.id}`}
            onClick={() => setThemeId(theme.id)}
            className={cn(
              'border-rule bg-raised text-button text-ink flex h-10 items-center gap-2 rounded-md border px-2.5 text-left',
              active && 'border-accent-ink bg-accent-wash',
            )}
          >
            <ThemeSwatch theme={theme} />
            <span className="min-w-0 flex-1 truncate">{t(theme.labelKey)}</span>
            {active ? <Check aria-hidden="true" className="text-accent-ink size-3.5" /> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Menu tema di top bar (≥768px). */
export function ThemeMenu() {
  const themeId = useThemeStore((state) => state.themeId)
  const setThemeId = useThemeStore((state) => state.setThemeId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={t('theme.open')} size="md" data-probe="theme-trigger">
          <Palette aria-hidden="true" className="size-4" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[232px]">
        <DropdownMenuLabel className="text-eyebrow text-ink-tertiary">
          {t('theme.title')}
        </DropdownMenuLabel>
        {THEMES.map((theme) => {
          const active = theme.id === themeId
          return (
            <DropdownMenuItem
              key={theme.id}
              role="menuitemradio"
              aria-checked={active}
              data-probe={`theme-option-${theme.id}`}
              onSelect={() => setThemeId(theme.id)}
              className="justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <ThemeSwatch theme={theme} />
                {t(theme.labelKey)}
              </span>
              {active ? <Check aria-hidden="true" className="text-accent-ink size-3.5" /> : null}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <p className="text-caption text-ink-tertiary px-2 py-1.5">{t('theme.description')}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
