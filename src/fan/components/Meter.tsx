// メーター（開催熱量）: 横の棒と、段階の名前・距離のことば。人数・達成率・金額の数字は出さない（G-08）。
// 数字の代わりに、段階（点火〜FEVER）の名前とことばで伝える。変換は domain/heat.ts。
// 伸びたときは、伸びた分が光って分かる（伸びる前の位置に薄い跡）。仲間を呼んだあとは、終わりに近いほど速く満タンへ伸びる（run）。
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GaugeRun } from '../domain/state';
import { STAGE_BOUNDS, gaugeOf } from '../domain/heat';
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
/** 仲間を呼んだあとの伸び方: 始めはゆっくり、終わりに近いほど速い。 */
const RUN_EASE = 'cubic-bezier(0.55, 0, 0.9, 0.55)';

/** 棒が伸びたとき、伸びた分（伸びる前の長さから、いまの長さまで）を、1 回ぶん光らせる。 */
type Trail = { from: number; to: number; key: number };
function useTrail(fill: number): Trail | null {
  const [prev, setPrev] = useState(fill);
  const [trail, setTrail] = useState<Trail | null>(null);
  if (prev !== fill) {
    setPrev(fill);
    if (fill > prev) setTrail({ from: prev, to: fill, key: (trail?.key ?? 0) + 1 });
  }
  return trail;
}

export function Meter({ view, run = null }: { view: FanView; run?: GaugeRun | null }) {
  const { heat } = view;
  const stageKey = usePopKey(heat.stage);
  // 仲間を呼んでいる間は、伸びる前の長さから始めて、次の描画で満タンへ向けて伸ばす（人数の状態は、伸びたあとに変わる）
  const [armed, setArmed] = useState<number | null>(null);
  const runNonce = run?.nonce ?? null;
  useEffect(() => {
    if (runNonce === null) return undefined; // 前の伸びの印（armed）は残るが、新しい伸びは、別の印（nonce）なので、伸びる前の長さから始まる
    const id = requestAnimationFrame(() => setArmed(runNonce));
    return () => cancelAnimationFrame(id);
  }, [runNonce]);
  const target = run !== null && armed === run.nonce ? run.to : run !== null ? run.from : heat.fill;
  const fill = Math.max(target, MIN_FILL);
  const trail = useTrail(fill);
  const passed = STAGE_BOUNDS.slice(0, Math.max(0, heat.stage - 1));
  const growStyle =
    run !== null ? ({ '--g-ms': `${run.ms}ms`, '--g-ease': RUN_EASE } as CSSProperties) : undefined;
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
        <div className={styles.gTrack} style={growStyle}>
          <div className={styles.gTrough}>
            <i style={{ '--g': fill } as CSSProperties} />
            {trail === null ? null : (
              <span
                key={trail.key}
                className={styles.gTrail}
                style={
                  {
                    '--tl': `${(trail.from * 100).toFixed(1)}%`,
                    '--tw': `${((trail.to - trail.from) * 100).toFixed(1)}%`,
                  } as CSSProperties
                }
              />
            )}
            {passed.map((b) => (
              <b
                key={b}
                className={styles.gTick}
                style={{ left: `${(gaugeOf(b) * 100).toFixed(1)}%` }}
              />
            ))}
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
