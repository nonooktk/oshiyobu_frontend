import { useEffect } from 'react';
import { publishOffice } from '../shared/link';
import { ArtistBar } from './components/ArtistBar';
import { Header } from './components/Header';
import { Judge } from './components/Judge';
import { MapPanel } from './components/MapPanel';
import { Privacy, Proposal } from './components/Modals';
import { SidePanel } from './components/SidePanel';
import styles from './office.module.css';
import { useOffice } from './store';
import { viewOf } from './view';

// 事務所向け（/）: アーティスト 5 組 → 地図の 9 市 → 会場 → 判定 3 点 → 提案の 1 枚（設計 D-34 の F-1）。
// 計算はすべて core。選んだ会場・費用・最低人数は、同じ端末のファン向けへ連動で渡す（D-44）
export function App() {
  const artistId = useOffice((s) => s.artistId);
  const city = useOffice((s) => s.city);
  const venueId = useOffice((s) => s.venueId);
  const costs = useOffice((s) => s.costs);
  const minHand = useOffice((s) => s.minHand);
  const modal = useOffice((s) => s.modal);
  const live = useOffice((s) => s.live);
  const view = viewOf({ artistId, city, venueId, costs, minHand });

  // 会場を選んでいるあいだ、選択が変わるたびにファン向けへ渡す（100 ms でまとめて送る）
  useEffect(() => {
    if (venueId !== null) {
      publishOffice({ venueId, costs, minPeople: minHand });
    }
  }, [venueId, costs, minHand]);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.office}>
          <Header />
          <ArtistBar />
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          <main>
            <div className={styles.top}>
              <MapPanel />
              <SidePanel />
            </div>
            {view !== null && <Judge view={view} />}
          </main>
        </div>
      </div>
      {modal === 'proposal' && view !== null && <Proposal view={view} />}
      {modal === 'privacy' && <Privacy />}
    </div>
  );
}
