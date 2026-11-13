import { artistById } from '../data/artists';
import { AREA_OTHER_CITY_SPLIT, AREA_RATIOS } from '../data/constants';
import { CITIES, NEIGHBOR_PREFS, cityByName } from '../data/cities';
import type { CityName, PrefName } from '../types';

/** 支援の状況の表の、市の行。 */
export interface AreaCity {
  /** 市の名前。地元の県に地図の市が足りないときは「ほかの市町村」。 */
  readonly name: string;
  readonly n: number;
  /** 地元の市。 */
  readonly isHome?: true;
}

/** 支援の状況の表の、県の行。 */
export interface AreaPref {
  /** 県の名前。そのほかは「そのほか」。 */
  readonly pref: PrefName | 'そのほか';
  readonly n: number;
  /** 地元の県だけ、市ごとの内訳を持つ。 */
  readonly cities: readonly AreaCity[];
}

/**
 * 支援の状況の表（県別・市別の人数。仕様 SP-32）。割合は仮のまま（決定 26）。
 * @param start 初めの支援者 N
 * @param home 地元の市
 * @param extra 申し込んだ人数（支援者 − 初めの支援者）。申し込んだ人（自分と仲間）は地元に足す
 * 地元の県のうち地元の市のほかは、同じ県の地図の市（tech0 の登録者 × 熱量の大きい順）に 82 : 18 で分ける。
 * 人数 0 の県の行は出さない。
 */
export function areaFor(start: number, home: CityName, extra: number): readonly AreaPref[] {
  const homeCity = cityByName(home);
  const tech0 = artistById('tech0');
  const local = Math.round(start * AREA_RATIOS.local) + extra;
  const prefN = Math.round(start * AREA_RATIOS.pref) + extra;
  const near1 = Math.round(start * AREA_RATIOS.near1);
  const near2 = Math.round(start * AREA_RATIOS.near2);
  const rest = Math.max(0, start - Math.round(start * AREA_RATIOS.pref) - near1 - near2);

  const others = CITIES.map((city, i) => ({
    name: city.name,
    pref: city.pref,
    weight: (tech0.reg[i] ?? 0) * (tech0.hot[i] ?? 0),
  }))
    .filter((city) => city.pref === homeCity.pref && city.name !== homeCity.name)
    .sort((a, b) => b.weight - a.weight)
    .map((city) => city.name);

  const left = prefN - local;
  const cities: AreaCity[] = [{ name: homeCity.name, n: local, isHome: true }];
  const [first, second] = others;
  if (first !== undefined && second !== undefined) {
    const firstN = Math.round(left * AREA_OTHER_CITY_SPLIT);
    cities.push({ name: first, n: firstN }, { name: second, n: left - firstN });
  } else if (first !== undefined) {
    cities.push({ name: first, n: left });
  } else if (left > 0) {
    cities.push({ name: 'ほかの市町村', n: left });
  }

  const [neighbor1, neighbor2] = NEIGHBOR_PREFS[homeCity.pref];
  const rows: AreaPref[] = [
    { pref: homeCity.pref, n: prefN, cities },
    { pref: neighbor1, n: near1, cities: [] },
    { pref: neighbor2, n: near2, cities: [] },
    { pref: 'そのほか', n: rest, cities: [] },
  ];
  return rows.filter((row) => row.n > 0);
}
