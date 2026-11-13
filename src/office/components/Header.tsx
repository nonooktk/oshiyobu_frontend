import logoWide from '../../assets/img/logo-wide.webp';
import { DemoBadge } from '../../shared/components/DemoBadge';
import { useOffice } from '../store';
import styles from '../office.module.css';
import { text } from '../text/labels';

/** 上の帯: ロゴ・見出し・情報の扱い・「デモを最初に戻す」・札 */
export function Header() {
  const band = useOffice((s) => s.band);
  const openModal = useOffice((s) => s.openModal);
  const resetAll = useOffice((s) => s.resetAll);
  const resetOffice = useOffice((s) => s.resetOffice);
  return (
    <header className={styles.bar}>
      <img src={logoWide} alt="OSHIYOBU" width={125} height={44} />
      <h1 className={styles.title}>{text.pageTitle}</h1>
      <button
        type="button"
        className={`${styles.btn} ${styles.text} ${styles.sm}`}
        onClick={() => openModal('privacy')}
      >
        {text.privacy}
      </button>
      <div className={styles.barEnd}>
        <span className={styles.bandMsg} role="status" aria-live="polite">
          {band}
        </span>
        <button
          type="button"
          className={`${styles.btn} ${styles.secondary} ${styles.sm}`}
          onClick={resetAll}
        >
          {text.resetAll}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.secondary} ${styles.sm}`}
          onClick={resetOffice}
        >
          {text.resetOffice}
        </button>
        <DemoBadge />
      </div>
    </header>
  );
}
