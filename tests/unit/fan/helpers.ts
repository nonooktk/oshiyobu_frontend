// ファン向けのストアのテストの共通部品。通信は無い（共有メーターは、テストが env で作る）。
import { conditionOf, performanceIdOf } from '../../../src/core';
import type { PerformanceId } from '../../../src/core';
import type { SoundCue } from '../../../src/fan/sound';
import { createFanStore } from '../../../src/fan/store/store';
import type { Deps } from '../../../src/fan/store/store';

export type Harness = ReturnType<typeof harness>;

/**
 * ストアを作る。join は「サーバーに数えられた」状態を env に反映する（共有の部品の仮実装と同じ動き）。
 * server＝ほかの端末の申し込みを含む、サーバーの件数。
 */
export function harness(
  personaNo = 4,
  opts: {
    reduceMotion?: boolean;
    server?: number;
    minPeople?: number;
    solo?: boolean;
    /** 称賛の音を鳴らす合図が、ここに順に入る（省略しても動く） */
    sounds?: SoundCue[];
  } = {},
) {
  const joins: PerformanceId[] = [];
  const fetches: string[] = [];
  /** 取得の依頼で渡された公演（渡さなかったときは undefined）。fetches と同じ順 */
  const fetchPids: (PerformanceId | undefined)[] = [];
  let server = opts.server ?? 0;
  let counted = false;
  const deps: Deps = {
    join: (pid) => {
      joins.push(pid);
      // ひとり体験は、サーバーに数えられない（人数は端末の中だけ）
      if (!counted && !opts.solo) {
        counted = true;
        server += 1;
        sync();
      }
    },
    fetch: (reason, pid) => {
      fetches.push(reason);
      fetchPids.push(pid);
    },
    reduceMotion: () => opts.reduceMotion ?? false,
    random: () => 0.5,
    solo: () => opts.solo ?? false,
    sound: (cue) => opts.sounds?.push(cue),
  };
  const store = createFanStore({ personaNo, deps });
  function sync() {
    const s = store.getState();
    store.setEnv({
      cond: conditionOf(
        s.venueId,
        opts.minPeople === undefined ? {} : { minPeople: opts.minPeople },
      ),
      pid: performanceIdOf(s.oshiId, s.venueId),
      meter: { serverJoined: server, counted },
    });
  }
  sync();
  store.subscribe(sync);
  return {
    store,
    a: store.actions,
    joins,
    fetches,
    fetchPids,
    state: () => store.getState(),
    view: () => store.view(),
    setServer(n: number) {
      server = n;
      sync();
    },
  };
}

/** はじめの画面（推し → コースの 2 つ）を、初めから選んである値のまま進めて、ホームへ。まだ申し込めない（口座なし・預金 0円）。 */
export function passStartOnly(h: Harness): void {
  h.a.startNext();
  h.a.startNext();
}

/**
 * ホームから、目指すコースに申し込める所まで進めて、申し込む（主のボタンの流れ）。
 * 推し活定期をはじめる → （メイン口座が条件なら）メイン口座にする → 預金を、条件にちょうど届く額だけ積み増す → 申し込む。
 */
export function fundAndApply(h: Harness): void {
  h.a.runAcct('teiki', 'home');
  const t = h.view().target;
  if (!t) return;
  if (t.mainAccount) h.a.runAcct('main', 'home');
  const gap = Math.max(0, t.deposit - h.state().acct.deposit);
  if (gap > 0) h.a.runAcct('deposit', 'home', gap);
  h.a.homePrimary();
}

/** はじめの画面を進めて、ホームで、目指すコースに申し込むところまで（人物ごとの違いは無い）。 */
export function passStart(h: Harness): void {
  passStartOnly(h);
  fundAndApply(h);
}
