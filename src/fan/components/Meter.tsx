// メーター（SP-56）: 「ライブ開催まで あと N 人」と達成率、横棒（80% の位置に星）。金額（「円」「万」）は出さない。
import { useState } from 'react';
import type { FanView } from '../domain/view';
import styles from '../fan.module.css';

/** 値が変わったときだけ、数字がはずむ（動きを減らす設定では、CSS が止める）。 */
function usePopKey(value: number): number {
  const [prev, setPrev] = useState(value);
  const [key, setKey] = useState(0);
  if (prev !== value) {
    setPrev(value);
    setKey(key + 1);
  }
  return key;
}

export function Meter({ view }: { view: FanView }) {
  const { status, cond } = view;
  const leftKey = usePopKey(status.left);
  const pctKey = usePopKey(status.pct);
  const state = status.established
    ? 'ライブの開催が決まりました。'
    : status.gathered
      ? '人数は集まりました。あと少しの支援で、開催が決まります。'
      : `ライブ開催まで あと${status.left}人。`;
  return (
    <div
      className={styles.gauge}
      role="img"
      aria-label={`支援者${status.supporters}人、最低人数${cond.min}人。${state}達成率${status.pct}%`}
    >
      <p className={`${styles.gRow} ${styles.num}`} aria-hidden="true">
        <span className={styles.gLeft}>
          {status.established ? (
            <b className={styles.gEst}>ライブの開催が決まりました</b>
          ) : status.gathered ? (
            <b className={styles.gEst}>人数は集まりました</b>
          ) : (
            <>
              <span className={styles.gLab}>ライブ開催まで</span>
              <span>あと</span>
              <b key={leftKey} className={leftKey > 0 ? styles.pop : undefined}>
                {status.left}
              </b>
              <span>人</span>
            </>
          )}
        </span>
        <span className={styles.gPct}>
          <span>達成率</span>
          <b key={pctKey} className={pctKey > 0 ? styles.pop : undefined}>
            {status.pct}%
          </b>
        </span>
        {status.gathered ? (
          <span className={styles.gSub}>あと少しの支援で、開催が決まります</span>
        ) : null}
      </p>
      <div className={styles.gLine} aria-hidden="true">
        <div className={styles.gTrack}>
          <div className={styles.gTrough}>
            <i style={{ width: `${status.fill.toFixed(1)}%` }} />
          </div>
          <svg className={styles.gStar} viewBox="-13 -13 26 26">
            <path d="M0,-12 L3.2,-4 L11.4,-3.7 L4.9,1.6 L7.1,9.7 L0,5 L-7.1,9.7 L-4.9,1.6 L-11.4,-3.7 L-3.2,-4 Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
