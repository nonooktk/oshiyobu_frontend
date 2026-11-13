import type { ArtistId, CityName } from '../types';

/**
 * 人物 1 人。QR で開いた端末が、番号（1〜15）で 1 人に決まる（設計 D-19・D-20）。
 * 公演（推しと会場）は、推しと地元の市の既定の会場で決まる（personaVenueId）。
 * 達成状況は持たない（決定メモ §4 の表に無い）。
 */
export interface Persona {
  readonly no: number;
  readonly artistId: ArtistId;
  /** 地元の市。 */
  readonly city: CityName;
  /** 預金額（円。擬似）。 */
  readonly depositYen: number;
  /** メイン口座にしているか（擬似）。 */
  readonly mainAccount: boolean;
}

/** 人物の数。 */
export const PERSONA_COUNT = 15;

/** モックの既定の人物（預金 90,000円・メイン口座は未・tech0・久留米市）。受入テストとリハーサルは `/fan/?p=4`。 */
export const PERSONA_DEFAULT_NO = 4;

/**
 * 人物 15 通り。出典: 決定メモ §4、仕様 SP-64。
 * 1〜9 が基準の公演（tech0・久留米市・Cボックス）で、共有のメーターが一緒に進む（決定 2）。
 * 値を変えたら CORE_VERSION を上げる（QR の URL は変わらない）。
 */
export const PERSONAS: readonly Persona[] = [
  { no: 1, artistId: 'tech0', city: '久留米市', depositYen: 15000, mainAccount: false },
  { no: 2, artistId: 'tech0', city: '久留米市', depositYen: 28000, mainAccount: false },
  { no: 3, artistId: 'tech0', city: '久留米市', depositYen: 62000, mainAccount: false },
  { no: 4, artistId: 'tech0', city: '久留米市', depositYen: 90000, mainAccount: false },
  { no: 5, artistId: 'tech0', city: '久留米市', depositYen: 95000, mainAccount: true },
  { no: 6, artistId: 'tech0', city: '久留米市', depositYen: 120000, mainAccount: true },
  { no: 7, artistId: 'tech0', city: '久留米市', depositYen: 180000, mainAccount: false },
  { no: 8, artistId: 'tech0', city: '久留米市', depositYen: 320000, mainAccount: true },
  { no: 9, artistId: 'tech0', city: '久留米市', depositYen: 1050000, mainAccount: true },
  { no: 10, artistId: 'krs48', city: '福岡市', depositYen: 48000, mainAccount: false },
  { no: 11, artistId: 'krs48', city: '熊本市', depositYen: 240000, mainAccount: true },
  { no: 12, artistId: 'riji', city: '久留米市', depositYen: 90000, mainAccount: true },
  { no: 13, artistId: 'riji', city: '佐賀市', depositYen: 320000, mainAccount: false },
  { no: 14, artistId: 'terao', city: '長崎市', depositYen: 9000, mainAccount: false },
  { no: 15, artistId: 'heisei', city: '宮崎市', depositYen: 400000, mainAccount: true },
];

/** 番号（1〜15）から人物を返す。範囲外は例外（番号の決め方は personaNoOf・personaNoFromParam）。 */
export function personaByNo(no: number): Persona {
  const persona = Number.isInteger(no) ? PERSONAS[no - 1] : undefined;
  if (persona === undefined) {
    throw new RangeError(`人物の番号は 1〜${PERSONA_COUNT} の整数です（受け取った値: ${no}）`);
  }
  return persona;
}
