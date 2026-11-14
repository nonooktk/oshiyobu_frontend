import { useEffect, useRef } from 'react';
import { conditionOf, demandOf, venuesOf } from '../../core';
import { HOME_CITY } from '../../core';
import styles from '../office.module.css';
import { useOffice } from '../store';
import { sideNote, text, yen } from '../text/labels';

/** 会場の候補（市を選ぶと出る）。市を選ぶまでは、案内と収支シミュレーターへの入口 */
export function SidePanel() {
  const city = useOffice((s) => s.city);
  const venueId = useOffice((s) => s.venueId);
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
  const list = venuesOf(city);
  const expected = demandOf('tech0', city).expected;
  const reach = list.some((venue) => conditionOf(venue.id).need <= expected);
  const [first, second] = sideNote(city === HOME_CITY, reach);
  return (
    <div className={styles.sideCol}>
      <h3 className={styles.sideH}>{city}の会場</h3>
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
              {venue.publicFee !== undefined && (
                <span className={styles.vfee}>
                  <small>公開料金の目安</small>
                  {yen(venue.publicFee)}
                </span>
              )}
            </button>
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
