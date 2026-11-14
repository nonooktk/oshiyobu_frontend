// 同じ端末（同じブラウザ）の中で、事務所向け（/）とファン向け（/fan/）をつなぐ。伝えるのは「デモを最初に戻す」だけ。
// 事務所向けで選んだ会場・費用・最低人数は、ファン向けへ伝えない（ファン向けは、core の既定の条件だけを使う。
// 事務所向けの作り直しで、ファン向けの「申し込む → 仲間を呼ぶ で必ず成立に届く」決まり〈G-02〉が崩れないようにするため。統括の決定 2026-11-14）。
// 聞き手のスマホには相手がいないので、何も起きない。BroadcastChannel が使えなくても、エラーにしない。

export const LINK_CHANNEL_NAME = 'oshiyobu-link-v1';

/** チャンネルに流すメッセージ。いまは「デモを最初に戻す」だけ（昔の版は、事務所向けの選択の 'office' と、ファン向けの 'hello' も流した。読まない） */
type LinkMessage = { readonly type: 'resetAll' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface Link {
  /** 事務所向け:「デモを最初に戻す」。同じブラウザのファン向けが初期値に戻る（共有メーターには触らない） */
  broadcastResetAll(): void;
  /** ファン向け: resetAll を受けたときの動き（resetFan を渡す） */
  onResetAll(handler: () => void): () => void;
  close(): void;
}

export function createLink(
  ChannelCtor: typeof BroadcastChannel | undefined = globalThis.BroadcastChannel,
): Link {
  let channel: BroadcastChannel | null = null;
  try {
    channel = ChannelCtor ? new ChannelCtor(LINK_CHANNEL_NAME) : null;
  } catch {
    channel = null;
  }
  const resetHandlers = new Set<() => void>();

  const post = (message: LinkMessage): void => {
    try {
      channel?.postMessage(message);
    } catch {
      // 送れなくても、画面は動く
    }
  };

  channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
    const data = event.data;
    // resetAll だけを受ける。そのほか（昔の版の選択・hello、形の違うもの）は、何もせずに捨てる
    if (isRecord(data) && data.type === 'resetAll') {
      resetHandlers.forEach((handler) => handler());
    }
  });

  return {
    broadcastResetAll() {
      post({ type: 'resetAll' });
    },
    onResetAll(handler) {
      resetHandlers.add(handler);
      return () => {
        resetHandlers.delete(handler);
      };
    },
    close() {
      channel?.close();
    },
  };
}

let singleton: Link | null = null;
const getLink = (): Link => (singleton ??= createLink());

export const broadcastResetAll = (): void => getLink().broadcastResetAll();
export const onResetAll = (handler: () => void): (() => void) => getLink().onResetAll(handler);

/** テスト用: 共有の接続を作り直す */
export function resetLinkForTest(): void {
  singleton?.close();
  singleton = null;
}
