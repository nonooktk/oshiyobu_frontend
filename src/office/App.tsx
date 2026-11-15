import { useEffect } from 'react';
import { ArtistBar } from './components/ArtistBar';
import { Header } from './components/Header';
import { Judge } from './components/Judge';
import { MapPanel } from './components/MapPanel';
import { Privacy, Proposal } from './components/Modals';
import { SidePanel } from './components/SidePanel';
import styles from './office.module.css';
import { useOffice } from './store';
import { text } from './text/labels';
import { viewOf } from './view';

// 事務所向け（/）: アーティスト 5 組 → 地図の 9 市 → 会場 → 判定 3 点 → 提案の 1 枚（設計 D-34 の F-1）。
// 計算はすべて core。選んだ会場・費用・最低人数は、ファン向けへ渡さない（ファン向けは core の既定の条件だけを使う。G-02。統括の決定 2026-11-14）。
// 同じ端末のファン向けへ伝えるのは、「デモを最初に戻す」だけ（store.ts の resetAll）
export function App() {
  const artistId = useOffice((s) => s.artistId);
  const city = useOffice((s) => s.city);
  const venueId = useOffice((s) => s.venueId);
  const costs = useOffice((s) => s.costs);
  const minHand = useOffice((s) => s.minHand);
  const modal = useOffice((s) => s.modal);
  const live = useOffice((s) => s.live);
  const view = viewOf({ artistId, city, venueId, costs, minHand });

  // 最初の画面（地図）が描けて、操作できる時刻に印を打つ（設計 D-40・SP-94。実ブラウザの速さの測定が読む）
  useEffect(() => {
    const frame = requestAnimationFrame(() => performance.mark('oshiyobu:ready'));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.office}>
          <Header />
          <ArtistBar />
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          {/* 左で選び（① 地図・③ 会場）、右で結果を見る（⑥ 満たせるか・⑤ 開催条件）。仕様 1.2 の案 B */}
          <main className={styles.board}>
            <div className={styles.leftCol}>
              <MapPanel />
              <SidePanel />
            </div>
            <div className={styles.rightCol}>
              {view !== null ? (
                <Judge view={view} />
              ) : (
                <div className={styles.empty}>
                  <p style={{ margin: 0 }}>
                    <b>{text.pickVenue}</b>
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      {modal === 'proposal' && view !== null && <Proposal view={view} />}
      {modal === 'privacy' && <Privacy />}
    </div>
  );
}
