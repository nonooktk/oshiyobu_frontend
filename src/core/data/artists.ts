import type { ArtistId } from '../types';

/** 熱量 × 資金の散布図の 4 象限。 */
export type QuadKey = 'hotRich' | 'hotPoor' | 'coolRich' | 'coolPoor';

export interface ArtistData {
  readonly id: ArtistId;
  /** 市ごとの登録者数（CITIES と同じ並び）。 */
  readonly reg: readonly number[];
  /** 市ごとの払える熱量 0〜100（CITIES と同じ並び）。 */
  readonly hot: readonly number[];
  readonly quad: {
    /** 基準の市（久留米市）での、1 点あたりの人数。 */
    readonly perDot: number;
    /** 基準の市（久留米市）の 4 象限の人数。hotRich が「払える熱いファンの見込み」。 */
    readonly people: Readonly<Record<QuadKey, number>>;
    /** 点の位置を決める乱数の種（固定。毎回同じ並びにする）。点の生成そのものは frontend の仕事。 */
    readonly seed: number;
    /** 点の偏り [横の指数, 縦の指数]。無い象限は偏りなし。 */
    readonly spread: Readonly<Partial<Record<QuadKey, readonly [number, number]>>>;
  };
}

/**
 * アーティスト 5 組の数値（表示順）。すべて仮の架空の値。
 * 出典: mock/index.html の `DEMO.artists`（reg・hot・quad）、仕様 SP-19。
 * 名前・頭文字・絵・タイプの説明は frontend が持つ（設計 D-06）。
 */
export const ARTISTS: readonly ArtistData[] = [
  {
    id: 'tech0',
    reg: [4820, 2150, 1380, 640, 980, 1760, 720, 510, 1120],
    hot: [41, 33, 86, 47, 29, 52, 31, 26, 38],
    quad: {
      perDot: 3,
      people: { hotRich: 187, hotPoor: 54, coolRich: 42, coolPoor: 24 },
      seed: 20261120,
      spread: { hotRich: [0.8, 1] },
    },
  },
  {
    id: 'krs48',
    reg: [21800, 9800, 4100, 2900, 3600, 7700, 3300, 2100, 4900],
    hot: [36, 30, 42, 28, 25, 38, 22, 18, 29],
    quad: {
      perDot: 6,
      people: { hotRich: 120, hotPoor: 30, coolRich: 330, coolPoor: 420 },
      seed: 20261121,
      spread: {},
    },
  },
  {
    id: 'riji',
    reg: [1900, 820, 680, 310, 260, 720, 290, 170, 380],
    hot: [58, 40, 55, 44, 31, 49, 35, 24, 37],
    quad: {
      perDot: 2,
      people: { hotRich: 96, hotPoor: 6, coolRich: 40, coolPoor: 8 },
      seed: 20261122,
      spread: { hotRich: [0.5, 1], coolRich: [0.5, 1] },
    },
  },
  {
    id: 'terao',
    reg: [5400, 2300, 1490, 920, 1260, 2100, 860, 610, 1400],
    hot: [31, 26, 34, 22, 19, 30, 18, 15, 21],
    quad: {
      perDot: 3,
      people: { hotRich: 45, hotPoor: 210, coolRich: 12, coolPoor: 60 },
      seed: 20261123,
      spread: { hotPoor: [1.4, 1] },
    },
  },
  {
    id: 'heisei',
    reg: [1500, 640, 380, 190, 330, 520, 210, 140, 300],
    hot: [66, 45, 63, 38, 40, 52, 34, 28, 36],
    quad: {
      perDot: 2,
      people: { hotRich: 66, hotPoor: 9, coolRich: 6, coolPoor: 3 },
      seed: 20261124,
      spread: { hotRich: [0.6, 4] },
    },
  },
];

/** アーティストの ID から数値を返す。 */
export function artistById(id: ArtistId): ArtistData {
  const artist = ARTISTS.find((item) => item.id === id);
  if (artist === undefined) {
    throw new RangeError(`知らないアーティストです: ${id}`);
  }
  return artist;
}
