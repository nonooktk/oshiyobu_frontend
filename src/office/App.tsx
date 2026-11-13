import logoWide from '../assets/img/logo-wide.webp';
import { DemoBadge } from '../shared/components/DemoBadge';
import styles from './App.module.css';
import { pageText } from './text/page';

// 事務所向け（/）。枠だけ。地図・判定・提案などの中身は、F-1 が作る
export function App() {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <img src={logoWide} alt="OSHIYOBU" width={125} height={44} />
        <DemoBadge className={styles.badge} />
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>{pageText.heading}</h1>
      </main>
    </div>
  );
}
