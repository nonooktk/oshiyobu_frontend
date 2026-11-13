import logoMark from '../assets/img/logo-mark.webp';
import { DemoBadge } from '../shared/components/DemoBadge';
import styles from './App.module.css';
import { pageText } from './text/page';

// 発表者用（/presenter/）。枠だけ。リセットと接続の確認の中身は、F-1 が作る
export function App() {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <img src={logoMark} alt="OSHIYOBU" width={32} height={32} />
        <DemoBadge className={styles.badge} />
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>{pageText.heading}</h1>
      </main>
    </div>
  );
}
