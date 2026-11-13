import { CITY_NAMES } from '../types';
import type { CityName, PrefName } from '../types';

export interface CityData {
  readonly name: CityName;
  readonly pref: PrefName;
}

/**
 * 地図の 9 市（地図の並び。登録者数・熱量の配列も、この並びと同じ順）。
 * 地図上の座標・ラベルの向きは frontend が持つ（設計 D-06）。出典: mock/index.html の `DEMO.cities`。
 */
export const CITIES: readonly CityData[] = [
  { name: '福岡市', pref: '福岡県' },
  { name: '北九州市', pref: '福岡県' },
  { name: '久留米市', pref: '福岡県' },
  { name: '佐賀市', pref: '佐賀県' },
  { name: '長崎市', pref: '長崎県' },
  { name: '熊本市', pref: '熊本県' },
  { name: '大分市', pref: '大分県' },
  { name: '宮崎市', pref: '宮崎県' },
  { name: '鹿児島市', pref: '鹿児島県' },
];

/** 支援の状況の表で、地元の県の次に並べる隣の県（近い順）。出典: モックの `DEMO.neighbors`、仕様 SP-19。 */
export const NEIGHBOR_PREFS: Readonly<Record<PrefName, readonly [PrefName, PrefName]>> = {
  福岡県: ['佐賀県', '熊本県'],
  佐賀県: ['福岡県', '長崎県'],
  長崎県: ['佐賀県', '福岡県'],
  熊本県: ['福岡県', '大分県'],
  大分県: ['福岡県', '熊本県'],
  宮崎県: ['熊本県', '鹿児島県'],
  鹿児島県: ['熊本県', '宮崎県'],
};

/** 市の名前から、CITIES の中の位置を返す（登録者数・熱量の配列の添字）。 */
export function cityIndex(name: CityName): number {
  const index = CITY_NAMES.indexOf(name);
  if (index < 0) {
    throw new RangeError(`知らない市です: ${name}`);
  }
  return index;
}

/** 市の名前から、その市のデータを返す。 */
export function cityByName(name: CityName): CityData {
  const city = CITIES[cityIndex(name)];
  if (city === undefined) {
    throw new RangeError(`知らない市です: ${name}`);
  }
  return city;
}
