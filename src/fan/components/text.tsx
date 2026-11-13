// 文字の出し方の小さな部品。折り返してよい所（wbr）と、折り返さない語（nw）。
import { Fragment } from 'react';
import type { Seg } from '../text/format';
import styles from '../fan.module.css';

/** 折り返してよい区切りごとの配列を、<wbr> でつないで出す（語の途中で切れないように）。 */
export function Wbr({ parts }: { parts: readonly string[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {p}
        </Fragment>
      ))}
    </>
  );
}

/** 文の一部を折り返さないで出す（例: 「74人 → 75人」）。 */
export function Rich({ segs }: { segs: readonly Seg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        typeof s === 'string' ? (
          <Fragment key={i}>{s}</Fragment>
        ) : (
          <span key={i} className={styles.nw}>
            {s.nw}
          </span>
        ),
      )}
    </>
  );
}
