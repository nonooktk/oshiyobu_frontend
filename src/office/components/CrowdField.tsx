// ② 集まる人数（要件 R-04。仕様 1.4）。条件の帯に置く。会場の候補を、キャパが人数に近い会場から出すことにだけ使い、
// 成立の最低人数とは別（確認 8）。⑤⑥ の数字は変わらない（#26 の強調の対象にも入らない）。
// - 数字の入力: 打ち終えて欄を離れるか Enter で反映する。空にすると、決めないに戻る。受け付けない値は、いまの値のまま
// - よく使う値のボタン（30・100・300・500・1000）: 押すとその人数。押されているものをもう一度押すと、決めないに戻る
import { useState } from 'react';
import styles from '../office.module.css';
import { useOffice } from '../store';
import { crowdText } from '../text/labels';

export function CrowdField() {
  const crowd = useOffice((s) => s.crowd);
  const setCrowd = useOffice((s) => s.setCrowd);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (trimmed === '') setCrowd(null);
    else setCrowd(Number(trimmed));
    setDraft(null);
  };
  return (
    <div className={styles.crowd} role="group" aria-labelledby="crowd-label">
      <label className={styles.crowdLabel} id="crowd-label" htmlFor="crowd-in">
        {crowdText.label}
      </label>
      <span className={styles.qLineNum}>
        <input
          id="crowd-in"
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          step={1}
          value={draft ?? (crowd === null ? '' : String(crowd))}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
        <span>{crowdText.unit}</span>
      </span>
      <span className={styles.crowdPresets}>
        {crowdText.presets.map((n) => (
          <button
            key={n}
            type="button"
            className={styles.crowdBtn}
            aria-pressed={crowd === n}
            onClick={() => setCrowd(crowd === n ? null : n)}
          >
            {n}
          </button>
        ))}
      </span>
    </div>
  );
}
