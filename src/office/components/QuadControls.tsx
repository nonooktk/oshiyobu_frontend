import { useState } from 'react';
import styles from '../office.module.css';
import { isInitialLine, QUAD_LINE_RANGE } from '../scatter';
import type { QuadLine } from '../scatter';
import { useOffice } from '../store';
import { quadLineText } from '../text/labels';

// 4 象限の線を動かす操作（要件 R-12。仕様 3.3）。スライダーと数字の入力・初めの位置に戻す。
// 付ける名前は、軸の名前（預金額・熱量）だけ。
// スライダーはすぐ反映する。数字の入力は、打ち終えて欄を離れるか Enter で反映する（打つ途中の「2」で線が飛ばないように）

function LineField({ what }: { readonly what: keyof QuadLine }) {
  const value = useOffice((s) => s.quadLine[what]);
  const setQuadLine = useOffice((s) => s.setQuadLine);
  const [draft, setDraft] = useState<string | null>(null);
  const { min, max, step } = QUAD_LINE_RANGE[what];
  const id = `quad-line-${what}`;
  const label = quadLineText[what];
  const unit = what === 'deposit' ? '万円' : '';
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.trim());
    if (draft.trim() !== '' && Number.isFinite(n)) setQuadLine(what, n);
    setDraft(null);
  };
  return (
    <div className={styles.qLineField}>
      <label htmlFor={`${id}-range`}>{label}</label>
      <div className={styles.qLineRow}>
        <input
          id={`${id}-range`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => setQuadLine(what, Number(event.target.value))}
        />
        <div className={styles.qLineNum}>
          <input
            type="number"
            inputMode="decimal"
            aria-label={label}
            min={min}
            max={max}
            step={step}
            value={draft ?? String(value)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
            }}
          />
          {unit !== '' && <span>{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export function QuadControls() {
  const line = useOffice((s) => s.quadLine);
  const resetQuadLine = useOffice((s) => s.resetQuadLine);
  const initial = isInitialLine(line);
  return (
    // 見出しの語は足さない。まとまりの名前は、⑥の見出し（「熱量と資金」。id="j3"）を読ませる
    <div className={styles.qLines} role="group" aria-labelledby="j3">
      <LineField what="deposit" />
      <LineField what="heat" />
      <button
        type="button"
        className={`${styles.btn} ${styles.secondary} ${styles.sm}`}
        disabled={initial}
        onClick={resetQuadLine}
      >
        {quadLineText.reset}
      </button>
    </div>
  );
}
