import type { CourseId } from '../types';

/** コースの金額の決め方。 */
export type PriceRule =
  | { readonly kind: 'venue-price'; readonly multiple: number } // 会場の区分の価格 × 倍率
  | { readonly kind: 'fixed'; readonly yen: number };

/** コースの枠の決め方。 */
export type SlotsRule =
  | { readonly kind: 'venue-capacity' } // 会場のキャパまで
  | { readonly kind: 'venue-capacity-ratio'; readonly ratio: number; readonly min: number } // max(min, round(キャパ × 比))
  | { readonly kind: 'fixed'; readonly count: number };

export interface CourseDef {
  readonly id: CourseId;
  readonly name: string;
  /** 預金の条件（円以上）。 */
  readonly deposit: number;
  /** メイン口座にすることが条件か。 */
  readonly mainAccount: boolean;
  readonly price: PriceRule;
  readonly slots: SlotsRule;
  /** 枠の単位。'venue' は会場の単位（席・名）に合わせる。 */
  readonly unit: 'venue' | '席' | '枠';
  /** 手に入るもの（全部。入場は全コースに含む）。 */
  readonly perks: readonly string[];
}

/**
 * 応援コース 4 つ（この順）。金額・枠・特典・預金の条件は仮の値で、**差し替えは、このファイル 1 か所**（決定 15）。
 * 「推し活定期をはじめる」は条件に入れない。入場は全コースに含む。
 * 出典: mock/index.html の `DEMO.courses`、仕様 SP-19「コース 4 つ」。
 */
export const COURSES: readonly CourseDef[] = [
  {
    id: 'normal',
    name: '通常の席',
    deposit: 20000,
    mainAccount: false,
    price: { kind: 'venue-price', multiple: 1 },
    slots: { kind: 'venue-capacity' },
    unit: 'venue',
    perks: ['ライブへの入場'],
  },
  {
    id: 'front',
    name: '前方の席',
    deposit: 100000,
    mainAccount: true,
    price: { kind: 'venue-price', multiple: 3 },
    slots: { kind: 'venue-capacity-ratio', ratio: 0.1, min: 4 },
    unit: '席',
    perks: ['ライブへの入場（前方エリア）', '終演後のお見送り'],
  },
  {
    id: 'special',
    name: '特別コース',
    deposit: 300000,
    mainAccount: true,
    price: { kind: 'fixed', yen: 100000 },
    slots: { kind: 'fixed', count: 3 },
    unit: '枠',
    perks: [
      'ライブへの入場',
      'リハーサルの見学',
      '2ショット撮影',
      'サイン入りポスター',
      '公演の協力者として名前を掲示',
    ],
  },
  {
    id: 'top',
    name: '最上位コース',
    deposit: 1000000,
    mainAccount: true,
    price: { kind: 'fixed', yen: 300000 },
    slots: { kind: 'fixed', count: 1 },
    unit: '枠',
    perks: [
      'ライブへの入場',
      '楽屋でのあいさつ',
      '1曲リクエスト',
      '推しからの名前入りメッセージ動画',
      '打ち上げの乾杯に同席',
    ],
  },
];
