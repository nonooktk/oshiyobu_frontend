import logoMark from '../assets/img/logo-mark.webp';
import { DemoBadge } from '../shared/components/DemoBadge';
import styles from './App.module.css';
import { pageText } from './text/page';

// ファン向け（/fan/。QR の行き先）。枠だけ。はじめの画面・ホームなどの中身は、F-2 が作る
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
