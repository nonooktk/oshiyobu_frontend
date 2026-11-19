import { CITIES, demandOf, metricValues } from '../../core';
import type { ArtistId, CityName } from '../../core';
import styles from '../office.module.css';
import { gaugeOfShare, shareOfReg } from '../share';
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
  // 地図の指標に合わせて、行に出す数字を変える（2026-11-19。docs/office/要件.md の N23-1〜N23-3）。
  // 人数: 登録の人数だけ。払える熱量: 見込みの人数と、割合のゲージ（割合の文字は出さず、読み上げに残す）。並び順は、どちらも見込みの順（N23-2）
  const metric = useOffice((s) => s.metric);
  const rows = cityRankOf(artistId);
  return (
    <section className={styles.rank} aria-labelledby="rank-h" data-testid="city-rank">
      <div className={styles.rankHead}>
        {/* 見出しは、「人数」のときは「登録の人数」、「払える熱量」のときは見込みの見出し（2026-11-20。N5-3） */}
        <p className={styles.rankH} id="rank-h">
          {metric === 'reg' ? text.rankHeadReg : text.rankHead}
        </p>
        <span className={styles.fictChip} data-testid="rank-fict">
          {text.rankFict}
        </span>
      </div>
      <ol className={styles.rankList}>
        {rows.map((row, n) => {
          const share = shareOfReg(row.expected, row.reg);
          const gauge = gaugeOfShare(row.expected, row.reg);
          return (
            <li key={row.name}>
              <button
                type="button"
                className={styles.rankBtn}
                aria-pressed={city === row.name}
                aria-label={`${n + 1} ${row.name} ${text.rankExpected} ${people(row.expected)} ${text.rankReg} ${people(row.reg)}${share === null ? '' : ` ${text.shareOfReg(share)}`}`}
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
                {metric === 'reg' ? (
                  <span className={styles.rankReg}>
                    {text.rankReg} {people(row.reg)}
                  </span>
                ) : (
                  <>
                    <span className={styles.rankExp}>{people(row.expected)}</span>
                    {/* 割合（見込み ÷ 登録）のゲージ。目盛りは 0〜20%（N23-3）。数字は読み上げ（行の名前）にある */}
                    {gauge !== null && (
                      <span
                        className={styles.rankGauge}
                        data-testid="rank-gauge"
                        data-share={share ?? undefined}
                        aria-hidden="true"
                      >
                        <i style={{ width: `${gauge.toFixed(1)}%` }} />
                      </span>
                    )}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
