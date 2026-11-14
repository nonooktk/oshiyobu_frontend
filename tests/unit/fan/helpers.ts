// ファン向けのストアのテストの共通部品。通信は無い（共有メーターは、テストが env で作る）。
import { conditionOf, performanceIdOf } from '../../../src/core';
import type { PerformanceId } from '../../../src/core';
import { createFanStore } from '../../../src/fan/store/store';
import type { Deps } from '../../../src/fan/store/store';

export type Harness = ReturnType<typeof harness>;

/**
 * ストアを作る。join は「サーバーに数えられた」状態を env に反映する（共有の部品の仮実装と同じ動き）。
 * server＝ほかの端末の申し込みを含む、サーバーの件数。
 */
export function harness(
  personaNo = 4,
  opts: { reduceMotion?: boolean; server?: number; minPeople?: number; solo?: boolean } = {},
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

/** はじめの画面の「次へ」を 3 回押して、ホームへ（初めから選んである値のまま）。 */
export function passStart(h: Harness): void {
  h.a.startNext();
  h.a.startNext();
  h.a.startNext();
}
