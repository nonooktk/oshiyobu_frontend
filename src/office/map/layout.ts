import type { CityName } from '../../core';

// 地図の市の位置とラベルを置く向き（l 左・r 右・b 下）。viewBox は 0 0 460 578（shapes.ts と同じ写し方。2026-11-19 の N-1）。
// 位置の出典: 7 市は Natural Earth「Populated Places」1:10m（ne_10m_populated_places_simple.geojson。パブリックドメイン。
//   取得日 2026-11-19）の緯度・経度。久留米市と佐賀市は、Natural Earth に無いので、public/simulator.html の会場のデータの位置
//   （久留米市 = 久留米シティプラザ FUK-019、佐賀市 = 佐賀市松原 SAG-002）を使った。
// 久留米市と佐賀市は、丸が近すぎて押しにくいため、これまでどおり少し離してある（実の位置から、久留米市は東へ 13、佐賀市は西へ 15）
export const MAP_VIEWBOX = { width: 460, height: 578 } as const;

export const CITY_POS: Readonly<
  Record<CityName, { readonly x: number; readonly y: number; readonly pos: 'l' | 'r' | 'b' }>
> = {
  福岡市: { x: 181, y: 84, pos: 'l' },
  北九州市: { x: 245, y: 34, pos: 'r' },
  久留米市: { x: 210, y: 136, pos: 'r' },
  佐賀市: { x: 150, y: 147, pos: 'l' },
  長崎市: { x: 100, y: 236, pos: 'b' },
  熊本市: { x: 226, y: 229, pos: 'b' },
  大分市: { x: 365, y: 148, pos: 'b' },
  宮崎市: { x: 337, y: 391, pos: 'r' },
  鹿児島市: { x: 205, y: 452, pos: 'r' },
};

/**
 * 名前の範囲も押せるようにする市。鹿児島市だけ（丸が小さく、名前を押すと下の県の形に当たり、選べなかった）。
 * 9 市すべてに広げると、佐賀市の名前が長崎市の丸に、推しによっては久留米市と大分市の名前どうしが重なるため、広げない
 * （tests/integration/office-map-hit.test.tsx が、よその市の押せる範囲と重ならないことを確かめる）
 */
export const LABEL_HIT_CITIES: readonly CityName[] = ['鹿児島市'];

/** 市の名前の文字の大きさ（office.module.css の .cityLabel の font-size と同じ値） */
export const LABEL_FONT = 18;
/** 名前の 2 行目（数字）の行の送り（MapPanel の tspan の dy と同じ 1.25em） */
const LABEL_LINE = 1.25;
/** 名前の範囲の、字の外側の余白（px） */
const LABEL_PAD = 4;

/** 市の名前を置く点（1 行目の字の並びの線）と、そろえ方。丸の半径 r から決める */
export function labelAnchor(
  x: number,
  y: number,
  r: number,
  pos: 'l' | 'r' | 'b',
): { readonly lx: number; readonly ly: number; readonly anchor: 'start' | 'end' | 'middle' } {
  if (pos === 'r') return { lx: x + r + 5, ly: y - 2, anchor: 'start' };
  if (pos === 'l') return { lx: x - r - 5, ly: y - 2, anchor: 'end' };
  return { lx: x, ly: y + r + 19, anchor: 'middle' };
}

/** 字の幅の見積もり（em）。英数字・記号は半角で 0.6、ほかは全角で 1 */
function textEm(s: string): number {
  let em = 0;
  for (const ch of s) em += /[\x20-\x7e]/.test(ch) ? 0.6 : 1;
  return em;
}

/**
 * 市の名前（2 行: 名前・数字）が占める四角。名前を押しても市を選べるように、透明な押せる範囲に使う。
 * 字の幅はブラウザで測らず、字の数から見積もる（テストの jsdom では測れないため）。少し大きめに取る
 */
export function labelBox(
  x: number,
  y: number,
  r: number,
  pos: 'l' | 'r' | 'b',
  lines: readonly string[],
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const { lx, ly, anchor } = labelAnchor(x, y, r, pos);
  const width = Math.max(...lines.map(textEm)) * LABEL_FONT + 2 * LABEL_PAD;
  const left =
    anchor === 'start'
      ? lx - LABEL_PAD
      : anchor === 'end'
        ? lx - width + LABEL_PAD
        : lx - width / 2;
  // 1 行目の字の上（字の並びの線から 1.15em 上。MOBO の字の枠は約 1.13em）から、最後の行の字の下（線から 0.25em 下）まで
  const top = ly - 1.15 * LABEL_FONT - LABEL_PAD;
  const bottom = ly + (lines.length - 1) * LABEL_LINE * LABEL_FONT + 0.25 * LABEL_FONT + LABEL_PAD;
  return { x: left, y: top, width, height: bottom - top };
}

// 地図の濃淡の色（淡い → 濃い）。人数はパレットの青 5 段、払える熱量は熱量の赤 5 段（tokens.css の変数）
export const RAMPS = {
  reg: ['--bg-c', '--line', '--gray-300', '--primary', '--primary-dark'],
  hot: ['--heat-1', '--heat-2', '--heat-3', '--heat-4', '--heat-5'],
} as const;
