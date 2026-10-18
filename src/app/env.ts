/**
 * Rute internal `/dev/*` dibuang dari build produksi (T0.3). Tersedia di dev
 * server, dan di build produksi hanya lewat `pnpm build:spike` — mode itu
 * dipakai untuk mengukur bahwa chunk PDF benar-benar terpisah dari bundle awal.
 */
export const devRoutesEnabled = import.meta.env.DEV || __DEV_PAGES__
