// ファン向けの先読みの登録（絵・遅れて読む塊。設計 D-40）。共有の部品 `src/shared/prefetch.tsx` が、これを読んで先読みする。
import { configurePrefetch } from '../shared/prefetch';
import { PREFETCH_IMAGES, PREFETCH_PLAN } from './art/registry';

/** 遅れて読む画面（メニュー配下。fan-pages）と、層（やめる確認・引き継ぎ。fan-layers）。先読みは、この順 */
export const loadPagesChunk = () => import('./pages/Pages');
export const loadLayersChunk = () => import('./layers/Sheets');
export type PagesModule = Awaited<ReturnType<typeof loadPagesChunk>>;
export type LayersModule = Awaited<ReturnType<typeof loadLayersChunk>>;

export function setupFanPrefetch(): void {
  configurePrefetch({
    images: PREFETCH_IMAGES,
    plan: PREFETCH_PLAN,
    chunks: { 'fan-pages': loadPagesChunk, 'fan-layers': loadLayersChunk },
  });
}
