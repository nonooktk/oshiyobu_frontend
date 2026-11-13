// ファン向けのストアのテストの共通部品。通信は無い（共有メーターは、テストが env で作る）。
import { conditionOf, performanceIdOf } from '../../../src/fan/core';
import type { PerformanceId } from '../../../src/fan/core';
import { createFanStore } from '../../../src/fan/store/store';
import type { Deps } from '../../../src/fan/store/store';

export type Harness = ReturnType<typeof harness>;

/**
 * ストアを作る。join は「サーバーに数えられた」状態を env に反映する（共有の部品の仮実装と同じ動き）。
 * server＝ほかの端末の申し込みを含む、サーバーの件数。
 */
export function harness(
  personaNo = 4,
  opts: { reduceMotion?: boolean; server?: number; minPeople?: number } = {},
) {
  const joins: PerformanceId[] = [];
  const opened: string[] = [];
  const copied: string[] = [];
  let server = opts.server ?? 0;
  let counted = false;
  const deps: Deps = {
    join: (pid) => {
      joins.push(pid);
      if (!counted) {
        counted = true;
        server += 1;
        sync();
      }
    },
    fetch: () => undefined,
    reduceMotion: () => opts.reduceMotion ?? false,
    openWindow: (url) => opened.push(url),
    copyText: async (text) => {
      copied.push(text);
      return true;
    },
    random: () => 0.5,
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
    opened,
    copied,
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
