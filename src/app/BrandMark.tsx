import { cn } from 'cn'

export type BrandMarkProps = {
  className?: string
  size?: 20 | 22
}

/**
 * §5.2 — lembar A4 putih 12×15 di atas cyanotype, dengan satu goresan stabilo
 * di sepertiga bawah. Warna diambil dari token lewat currentColor/fill utility.
 */
export function BrandMark({ className, size = 22 }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('bg-cyanotype inline-flex items-center justify-center rounded', className)}
      style={{ width: size, height: size }}
    >
      <svg width="12" height="15" viewBox="0 0 12 15" fill="none">
        <rect x="0.5" y="0.5" width="11" height="14" rx="0.5" className="fill-raised" />
        <rect x="2" y="3" width="8" height="1" className="fill-rule-strong" />
        <rect x="2" y="5.5" width="8" height="1" className="fill-rule-strong" />
        <rect x="2" y="8" width="5" height="1" className="fill-rule-strong" />
        <rect x="2" y="10.5" width="8" height="2" className="fill-highlighter" />
      </svg>
    </span>
  )
}
