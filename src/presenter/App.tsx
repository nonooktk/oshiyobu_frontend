import { useState } from 'react';
import logoMark from '../assets/img/logo-mark.webp';
import { DemoBadge } from '../shared/components/DemoBadge';
import { API_CONFIGURED, checkApiHealth, resetSharedMeter } from '../shared/meter';
import type { ResetOutcome } from '../shared/meter';
import styles from './App.module.css';
import { pageText } from './text/page';

/**
 * 合言葉は HTTP ヘッダー（X-Presenter-Key）に載せて送る。印字できる ASCII（半角の英数字と記号。空白を含む）以外の文字は
 * ヘッダーに載せられず、ブラウザの通信が例外になる。正しい合言葉でも「通信できません」と出てしまうので、送る前にはじく（G2-03）
 */
const SENDABLE_PASSPHRASE = /^[\x20-\x7e]*$/;

/** 結果の種類。サーバーに送った結果（ResetOutcome）のほかに、送る前に画面で見つけた「使えない文字」がある */
type Outcome = ResetOutcome | { readonly kind: 'invalid_passphrase' };

/** 結果の文言と種類。原因ごとに分けて出す（仕様 SP-67） */
function describe(outcome: Outcome): { readonly message: string; readonly ok: boolean } {
  switch (outcome.kind) {
    case 'ok':
      return { message: pageText.resultOk(outcome.resetAt), ok: true };
    case 'invalid_passphrase':
      return { message: pageText.resultInvalidPassphrase, ok: false };
    case 'unauthorized':
      return { message: pageText.resultUnauthorized, ok: false };
    case 'not_configured':
      return { message: pageText.resultNotConfigured, ok: false };
    case 'timeout':
      return { message: pageText.resultTimeout, ok: false };
    case 'network':
      return { message: pageText.resultNetwork, ok: false };
    case 'error':
      return { message: pageText.resultError, ok: false };
  }
}

// 発表者用（/presenter/）: 合言葉つきのリセット（2 段の確認）と、接続の確認だけ。合言葉は保存しない
export function App() {
  const [passphrase, setPassphrase] = useState('');
  const [armed, setArmed] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; ms: number } | 'checking' | null>(null);

  const execute = async () => {
    if (!SENDABLE_PASSPHRASE.test(passphrase)) {
      setResult({ kind: 'invalid_passphrase' });
      return;
    }
    setBusy(true);
    setResult(null);
    const outcome = await resetSharedMeter(passphrase);
    setBusy(false);
    setResult(outcome);
    if (outcome.kind === 'ok') {
      // 合言葉は、成功したら画面からも消す（保存しない）
      setPassphrase('');
      setConfirm('');
      setArmed(false);
    }
  };

  const check = async () => {
    setHealth('checking');
    const response = await checkApiHealth();
    setHealth({ ok: response.ok, ms: response.ms });
  };

  const shown = result === null ? null : describe(result);
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <img src={logoMark} alt="OSHIYOBU" width={32} height={32} />
        <DemoBadge className={styles.badge} />
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>{pageText.heading}</h1>
        <p className={styles.lead}>{pageText.lead}</p>

        <section className={styles.card} aria-labelledby="reset-h">
          <h2 id="reset-h">{pageText.reset}</h2>
          <div className={styles.field}>
            <label htmlFor="passphrase">{pageText.passphraseLabel}</label>
            <input
              id="passphrase"
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </div>
          <p className={styles.help}>{pageText.passphraseHelp}</p>
          {!armed ? (
            <div className={styles.row}>
              <button type="button" className={styles.btn} onClick={() => setArmed(true)}>
                {pageText.reset}
              </button>
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label htmlFor="confirm">{pageText.confirmLabel}</label>
                <input
                  id="confirm"
                  autoComplete="off"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
              <div className={styles.row}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.danger}`}
                  disabled={confirm !== 'RESET' || busy}
                  onClick={() => void execute()}
                >
                  {busy ? pageText.working : pageText.execute}
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.secondary}`}
                  disabled={busy}
                  onClick={() => {
                    setArmed(false);
                    setConfirm('');
                  }}
                >
                  {pageText.cancel}
                </button>
              </div>
            </>
          )}
          {shown !== null && (
            <p className={`${styles.result} ${shown.ok ? styles.ok : styles.ng}`} role="status">
              {shown.message}
            </p>
          )}
        </section>

        <section className={styles.card} aria-labelledby="check-h">
          <h2 id="check-h">{pageText.check}</h2>
          {!API_CONFIGURED && <p className={styles.help}>{pageText.notConfigured}</p>}
          <div className={styles.row}>
            <button
              type="button"
              className={`${styles.btn} ${styles.secondary}`}
              disabled={health === 'checking'}
              onClick={() => void check()}
            >
              {health === 'checking' ? pageText.checking : pageText.check}
            </button>
          </div>
          {health !== null && health !== 'checking' && (
            <p className={`${styles.result} ${health.ok ? styles.ok : styles.ng}`} role="status">
              {health.ok ? pageText.healthOk(health.ms) : pageText.healthNg}
            </p>
          )}
        </section>

        <section className={styles.card} aria-labelledby="notes-h">
          <h2 id="notes-h">{pageText.notesHead}</h2>
          <ul className={styles.notes}>
            {pageText.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
