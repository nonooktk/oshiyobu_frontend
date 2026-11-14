// ファン向けの「閉じたら戻す」「5 分で戻す」（ひとり体験のとき。人数を端末の中だけで数える既定の形）。
// ブラウザに保存しているのは端末の番号だけで（設計 D-10）、ファン向けの状態はメモリにだけある。
// 閉じる・再読み込み・別のページへ移ると、メモリごと消えて、次は初めの状態で始まる。残る例外が bfcache（ページを凍結して、戻るときに元の
// メモリのまま再開する）なので、pagehide と pageshow（persisted）で、初めの状態に戻す。
import { IDLE_RESET_TEXT } from '../text/ui';

/** 最後の操作から、初めの状態に戻すまでの秒数（5 分。ここ 1 か所） */
export const IDLE_RESET_SEC = 300;

/** 「最後の操作」に数える入力。画面が見える状態に戻ったことは数えない */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;

export interface LifecycleDeps {
  /** 5 分たったとき: 初めの状態に戻す。戻したら true（はじめの画面のまま、戻すものが無いときは false） */
  resetForIdle: () => boolean;
  /** 閉じる・bfcache から戻る: 静かに、初めの状態に戻す */
  resetQuiet: () => void;
  /** 戻した理由を、短く表示する */
  notice: (text: string) => void;
  now?: () => number;
}

export function createFanLifecycle(deps: LifecycleDeps): { dispose: () => void } {
  const now = deps.now ?? Date.now;
  const limitMs = IDLE_RESET_SEC * 1000;
  let last = now();
  /** 戻してから、次の操作があるまで false（操作が無い間、何度も戻さない） */
  let armed = true;
  /** 画面が裏にある間に戻した。見える状態に戻ったときに、理由を伝える */
  let pendingNotice = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const visible = (): boolean => document.visibilityState !== 'hidden';
  const clear = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  // 時計は、期限に 1 回だけ張る（scroll・wheel のたびに張り直さない）。着いたら、時刻の差で数え直す
  const arm = (): void => {
    if (timer !== null || !armed) return;
    timer = setTimeout(check, Math.max(0, last + limitMs - now()));
  };
  const check = (): void => {
    clear();
    if (!armed) return;
    if (last + limitMs - now() > 0) {
      arm();
      return;
    }
    armed = false;
    if (!deps.resetForIdle()) return;
    if (visible()) deps.notice(IDLE_RESET_TEXT);
    else pendingNotice = true;
  };
  const restart = (): void => {
    last = now();
    armed = true;
    arm();
  };

  const onActivity = (): void => restart();
  const onVisibility = (): void => {
    if (!visible()) return;
    if (pendingNotice) {
      pendingNotice = false;
      deps.notice(IDLE_RESET_TEXT);
      return;
    }
    // 裏でタイマーが止められていても、時刻の差で測って、超えていれば、その場で戻す
    check();
  };
  const onPageHide = (): void => deps.resetQuiet();
  const onPageShow = (event: Event): void => {
    if (!(event as PageTransitionEvent).persisted) return;
    deps.resetQuiet();
    restart();
  };

  for (const type of ACTIVITY_EVENTS)
    window.addEventListener(type, onActivity, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  arm();

  return {
    dispose() {
      clear();
      for (const type of ACTIVITY_EVENTS)
        window.removeEventListener(type, onActivity, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    },
  };
}
