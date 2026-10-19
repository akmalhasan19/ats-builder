import { cn } from 'cn'

export type BrandMarkProps = {
  className?: string
  /** Sisi kotak (px). Logo asli 633×570, di-center di dalam kotak. */
  size?: number
}

/**
 * Logo Vetra (public/vetra-mark.webp — turunan `vetra_logo.webp` yang sudah
 * dipangkas & diberi padding). Dekoratif: nama merek selalu ada di teks
 * sekitarnya, jadi `alt` kosong supaya pembaca layar tidak membacanya dua kali.
 */
export function BrandMark({ className, size = 22 }: BrandMarkProps) {
  return (
    <img
      src="/vetra-mark.webp"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      className={cn('shrink-0 object-contain select-none', className)}
      style={{ width: size, height: size }}
    />
  )
}
