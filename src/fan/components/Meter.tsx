// メーター（開催熱量）: 横の棒と、段階の名前・距離のことば。人数・達成率・金額の数字は出さない（G-08）。
// 数字の代わりに、段階（点火〜FEVER）の名前とことばで伝える。変換は domain/heat.ts。
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { FanView } from '../domain/view';
import styles from '../fan.module.css';

/** 値が変わったときだけ、段階の名前がはずむ（動きを減らす設定では、CSS が止める）。 */
function usePopKey(value: number): number {
  const [prev, setPrev] = useState(value);
  const [key, setKey] = useState(0);
  if (prev !== value) {
    setPrev(value);
    setKey(key + 1);
  }
  return key;
}

/** 棒が 0 のままだと、棒の色が見えない。最低限の長さを置く。 */
const MIN_FILL = 0.02;

export function Meter({ view }: { view: FanView }) {
  const { heat } = view;
  const stageKey = usePopKey(heat.stage);
  const fill = Math.max(heat.fill, MIN_FILL);
  return (
    <div
      className={styles.gauge}
      data-heat={heat.stage}
      role="img"
      aria-label={`開催熱量。${heat.name}。${heat.distance}`}
    >
      <p className={styles.gRow} aria-hidden="true">
        <span className={styles.gKick}>開催熱量</span>
        <span className={styles.gDist}>{heat.distance}</span>
      </p>
      <p
        key={stageKey}
        className={stageKey > 0 ? `${styles.gName} ${styles.pop}` : styles.gName}
        aria-hidden="true"
      >
        {heat.name}
      </p>
      <div className={styles.gLine} aria-hidden="true">
        <div className={styles.gTrack}>
          <div className={styles.gTrough}>
            <i style={{ '--g': fill } as CSSProperties} />
          </div>
          {heat.next === null ? null : (
            <svg
              className={styles.gStar}
              style={{ left: `${(heat.next * 100).toFixed(1)}%` }}
              viewBox="-13 -13 26 26"
            >
              <path d="M0,-12 L3.2,-4 L11.4,-3.7 L4.9,1.6 L7.1,9.7 L0,5 L-7.1,9.7 L-4.9,1.6 L-11.4,-3.7 L-3.2,-4 Z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
