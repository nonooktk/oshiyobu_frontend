import { useEffect } from 'react';
import { ArtistBar } from './components/ArtistBar';
import { ChangeLive } from './components/Changed';
import { ConditionBand } from './components/ConditionBand';
import { CrowdField } from './components/CrowdField';
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
          {/* 条件の帯（要件 R-15）: 境目（預金額・熱量）。② 集まる人数は、2026-11-18 に ① 地図の下へ移した（M-02） */}
          <ConditionBand view={view} />
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          <ChangeLive />
          {/* 左で選び（① 地図・③ 会場）、右で結果を見る（⑥ 満たせるか・⑤ 開催条件）。仕様 1.2 の案 B */}
          <main className={styles.board}>
            <div className={styles.leftCol}>
              <MapPanel />
              {/* ② 集まる人数は、① 地図のすぐ下（2026-11-18。docs/office/要件.md の M-02）。市・会場を選ぶ前から使える */}
              <div className={styles.crowdRow} data-testid="crowd-row">
                <CrowdField />
              </div>
              {/* 地図の下は、③ 会場の候補だけ。④ これまでの公演は外し、空いた幅を ③ に使う
                  （2026-11-19。docs/office/要件.md の N5-1・N5-2。公演のデータ src/office/data/events.ts は残す） */}
              <div className={styles.lowerRow} data-testid="lower-row">
                <SidePanel />
              </div>
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
