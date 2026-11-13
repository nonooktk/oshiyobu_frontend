import type { CityName } from '../../core';

// 地図の市の位置とラベルを置く向き（l 左・r 右・b 下）。出典: モックの DEMO.cities。viewBox は 0 0 460 590。
// 久留米市と佐賀市は、丸が近すぎて押しにくいため、少し離してある
export const MAP_VIEWBOX = { width: 460, height: 590 } as const;

export const CITY_POS: Readonly<
  Record<CityName, { readonly x: number; readonly y: number; readonly pos: 'l' | 'r' | 'b' }>
> = {
  福岡市: { x: 205, y: 90, pos: 'l' },
  北九州市: { x: 312, y: 48, pos: 'r' },
  久留米市: { x: 236, y: 170, pos: 'r' },
  佐賀市: { x: 166, y: 158, pos: 'l' },
  長崎市: { x: 94, y: 206, pos: 'b' },
  熊本市: { x: 238, y: 240, pos: 'b' },
  大分市: { x: 368, y: 158, pos: 'b' },
  宮崎市: { x: 340, y: 392, pos: 'r' },
  鹿児島市: { x: 240, y: 462, pos: 'r' },
};

// 地図の濃淡の色（淡い → 濃い）。人数はパレットの青 5 段、払える熱量は熱量の赤 5 段（tokens.css の変数）
export const RAMPS = {
  reg: ['--bg-c', '--line', '--gray-300', '--primary', '--primary-dark'],
  hot: ['--heat-1', '--heat-2', '--heat-3', '--heat-4', '--heat-5'],
} as const;
