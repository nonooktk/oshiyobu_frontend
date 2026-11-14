// 預金を積み増す額の入力（「口座と預金」の画面の 1 枚のカード）。
// 入力欄（数字のキーボード）・足すボタン・よく使う額の小さいボタン。決まりは domain/deposit.ts。
// 決まりに外れたら、足さずに、理由を入力欄のそばに出す（role="alert"・aria-invalid・aria-describedby で、読み上げにも伝える）。
// 足したあとの表示（トースト・読み上げ・条件の変わり方）は、ストアの runAcct が出す。
import { useId, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  DEPOSIT_MAX,
  QUICK_DEPOSITS,
  canAddDeposit,
  depositErrorText,
  parseDepositInput,
} from '../domain/deposit';
import { opensText } from '../domain/view';
import { yen } from '../text/format';
import fan from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import styles from './pages.module.css';

type Props = {
  /** カードの見出し（「預金を積み増す」） */
  title: string;
  /** 見出しの下の 1 文 */
  desc: string;
  /** この画面で、いちばん先にやってほしい行動か（主のボタンの色にする） */
  primary: boolean;
};

export function DepositCard({ title, desc, primary }: Props) {
  const { state, view, actions } = useFan();
  const { deposit: d, pay: p } = state.acct;
  const base = useId();
  const inputId = `${base}-amount`;
  const hintId = `${base}-hint`;
  const errId = `${base}-error`;
  const [value, setValue] = useState('');
  // 理由の文。同じ入力をもう一度送っても読み上げ直されるよう、送るたびに nonce を変えて、要素を作り直す
  const [error, setError] = useState<{ text: string; nonce: number } | null>(null);

  const typed = parseDepositInput(value, d);
  const after = typed.ok ? d + typed.yen : null;

  const onChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setValue(e.target.value);
    setError(null);
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!typed.ok) {
      setError((prev) => ({ text: depositErrorText(typed.error), nonce: (prev?.nonce ?? 0) + 1 }));
      return;
    }
    setError(null);
    setValue('');
    actions.runAcct('deposit', 'acct', typed.yen);
  };
  const addQuick = (n: number): void => {
    setError(null);
    actions.runAcct('deposit', 'acct', n);
  };

  return (
    <div className={fan.card} id="ac-deposit">
      <h3 className={styles.actH} id="fan-ac-deposit-h" tabIndex={-1}>
        {title}
      </h3>
      <p className={styles.actD}>{desc}</p>
      {state.acct.times > 0 ? (
        <p className={styles.actDone}>✓ {state.acct.times}回積み増しました</p>
      ) : null}
      <form onSubmit={onSubmit} noValidate>
        <label className={styles.amountLab} htmlFor={inputId}>
          積み増す額（円）
        </label>
        <div className={styles.amountRow}>
          <input
            id={inputId}
            className={styles.amount}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={onChange}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${errId} ${hintId}` : hintId}
          />
          <button type="submit" className={primary ? fan.btn : `${fan.btn} ${fan.btnSecondary}`}>
            積み増す
          </button>
        </div>
        {error ? (
          <p key={error.nonce} id={errId} className={styles.amountErr} role="alert">
            {error.text}
          </p>
        ) : null}
        <p id={hintId} className={styles.amountHint}>
          {`デモ用の仮の預金です。実際の入金は行われません。1円以上の整数で入れてください（預金は合計 ${yen(DEPOSIT_MAX)}まで）。`}
        </p>
      </form>
      <div className={styles.quick} role="group" aria-label="よく使う額">
        {QUICK_DEPOSITS.map((n) => (
          <button
            key={n}
            type="button"
            className={`${fan.btn} ${fan.btnSecondary}`}
            aria-label={`${yen(n)}を積み増す`}
            disabled={!canAddDeposit(n, d)}
            onClick={() => addQuick(n)}
          >
            +{n.toLocaleString('ja-JP')}
          </button>
        ))}
      </div>
      {after !== null ? (
        <>
          <p className={styles.before}>押すと、こうなります</p>
          <dl className={styles.rows}>
            <div>
              <dt>預金</dt>
              <dd className={fan.num}>{`${yen(d)} → ${yen(after)}`}</dd>
            </div>
            <div>
              <dt>開くコース</dt>
              <dd className={fan.num}>{opensText(view.cond, d, after, p, p)}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </div>
  );
}
