import { CITIES, demandOf, metricValues } from '../../core';
import type { ArtistId, CityName } from '../../core';
import styles from '../office.module.css';
import { useOffice } from '../store';
import { text } from '../text/labels';

export interface CityRankRow {
  readonly name: CityName;
  /** 預金の支えがある熱いファンの見込み（core の demandOf(推し, 市).expected のまま） */
  readonly expected: number;
  /** 登録者数（core の metricValues(推し, 'reg') のまま。地図の丸の面積と同じ値） */
  readonly reg: number;
}

/** 9 市を、見込みの多い市から並べる（同じ数のときは CITIES の並び）。数字は core の値をそのまま使い、画面で足し算はしない */
export function cityRankOf(artistId: ArtistId): readonly CityRankRow[] {
  const regs = metricValues(artistId, 'reg');
  return CITIES.map((city, i) => ({
    name: city.name,
    expected: demandOf(artistId, city.name).expected,
    reg: regs[i] ?? 0,
    i,
  }))
    .sort((a, b) => b.expected - a.expected || a.i - b.i)
    .map(({ name, expected, reg }) => ({ name, expected, reg }));
}

const people = (n: number): string => `${n.toLocaleString('ja-JP')}人`;

/** ① の地図の横に置く、市の一覧（要件 R-02・R-03）。行を押すと、地図の丸と同じく、その市を選ぶ */
export function CityRank() {
  const artistId = useOffice((s) => s.artistId);
  const city = useOffice((s) => s.city);
  const pickCity = useOffice((s) => s.pickCity);
  const focusVenues = useOffice((s) => s.focusVenues);
  const rows = cityRankOf(artistId);
  return (
    <section className={styles.rank} aria-labelledby="rank-h" data-testid="city-rank">
      <div className={styles.rankHead}>
        <p className={styles.rankH} id="rank-h">
          {text.rankHead}
        </p>
        <span className={styles.fictChip} data-testid="rank-fict">
          {text.rankFict}
        </span>
      </div>
      <ol className={styles.rankList}>
        {rows.map((row, n) => (
          <li key={row.name}>
            <button
              type="button"
              className={styles.rankBtn}
              aria-pressed={city === row.name}
              aria-label={`${n + 1} ${row.name} ${text.rankExpected} ${people(row.expected)} ${text.rankReg} ${people(row.reg)}`}
              onClick={(event) => {
                pickCity(row.name);
                // キーボードで押したとき（detail が 0）は、地図の丸と同じく、会場の先頭へフォーカスを移す（SP-03）
                if (event.detail === 0) focusVenues();
              }}
            >
              <span className={styles.rankNo} aria-hidden="true">
                {n + 1}
              </span>
              <span className={styles.rankName}>{row.name}</span>
              <span className={styles.rankExp}>{people(row.expected)}</span>
              <span className={styles.rankReg}>
                {text.rankReg} {people(row.reg)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
