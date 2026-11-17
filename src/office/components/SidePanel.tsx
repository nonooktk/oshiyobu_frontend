import { useEffect, useRef } from 'react';
import { venuesOf } from '../../core';
import { HOME_CITY } from '../../core';
import styles from '../office.module.css';
import { useOffice } from '../store';
import { crowdText, sideNote, text, yen } from '../text/labels';
import { CityRealChip, VenueFacts } from './VenueFacts';

/** 会場の候補（市を選ぶと出る）。市を選ぶまでは、案内と収支シミュレーターへの入口 */
export function SidePanel() {
  const city = useOffice((s) => s.city);
  const venueId = useOffice((s) => s.venueId);
  const crowd = useOffice((s) => s.crowd);
  const pickVenue = useOffice((s) => s.pickVenue);
  // キーボードで市を選んだとき（合図が増えたとき）、会場の先頭のボタンへフォーカスを移す（SP-03）
  const venueFocus = useOffice((s) => s.venueFocus);
  const venueList = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (venueFocus > 0) venueList.current?.querySelector('button')?.focus();
  }, [venueFocus]);
  if (city === null) {
    return (
      <div className={styles.sideCol}>
        <div className={styles.empty}>
          <p style={{ margin: 0 }}>
            <b>{text.emptyHead}</b>
            {text.emptyBody}
          </p>
          <a
            className={`${styles.btn} ${styles.secondary} ${styles.sm}`}
            href="/simulator.html"
            style={{ marginTop: 'var(--s4)' }}
          >
            {text.simulator}
          </a>
        </div>
      </div>
    );
  }
  // ② 集まる人数を決めていれば、キャパが人数に近い会場から出す（同じ近さは、もとの順のまま。要件 R-04）。
  // 決めていなければ、core の順のまま。並べ替えは表示だけで、候補の数は変えない
  const list =
    crowd === null
      ? venuesOf(city)
      : [...venuesOf(city)].sort((a, b) => Math.abs(a.cap - crowd) - Math.abs(b.cap - crowd));
  const [first, second] = sideNote(city === HOME_CITY);
  return (
    <div className={styles.sideCol}>
      {/* 番号の印は、見出しの外（同じ親の中）に置く。見出しの名前は「<市>の会場」のまま（I-03・C-05 が、見出しの親の中の会場を探す） */}
      <span className={styles.sideNum} aria-hidden="true">
        3
      </span>
      <h3 className={styles.sideH}>{city}の会場</h3>
      {/* 実在の札は、見出しの外に置く（見出しの名前は「<市>の会場」のまま） */}
      <CityRealChip venueIds={list.map((venue) => venue.id)} />
      <ul className={styles.venues} ref={venueList}>
        {list.map((venue) => (
          <li key={venue.id}>
            <button
              type="button"
              className={styles.venue}
              aria-pressed={venue.id === venueId}
              onClick={() => pickVenue(venue.id)}
            >
              <span className={styles.vn}>{venue.name}</span>
              <span className={styles.vcap}>
                {venue.cap}
                {venue.unit}・{venue.type}
              </span>
              {/* 規模感（R-06）: キャパ ÷ 人数の数字だけ。判定の言葉は付けない（仕様 1.4） */}
              {crowd !== null && (
                <span className={styles.vratio} data-testid="venue-ratio">
                  {crowdText.ratio(venue.cap, crowd)}
                </span>
              )}
              {venue.publicFee !== undefined && (
                <span className={styles.vfee}>
                  <small>公開料金の目安</small>
                  {yen(venue.publicFee)}
                </span>
              )}
            </button>
            {/* 選んだ会場だけ、詳しい欄（実在の情報と出典）。ボタンの外に置く（押せる物を入れ子にしない。
                ボタンの名前は core の名前のまま） */}
            {venue.id === venueId && <VenueFacts venueId={venue.id} />}
          </li>
        ))}
      </ul>
      <p className={styles.dummyNote}>
        <span>{first}</span>
        <span className={styles.sub}>{second}</span>
      </p>
    </div>
  );
}
