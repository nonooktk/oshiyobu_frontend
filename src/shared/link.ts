import { useSyncExternalStore } from 'react';
import { VENUE_IDS } from '../core';
import type { CostValues, VenueId } from '../core';

// 同じ端末（同じブラウザ）の中で、事務所向け（/）とファン向け（/fan/）をつなぐ（設計 D-44。決定 14・19・22）。
// 聞き手のスマホには相手がいないので、何も起きない。BroadcastChannel が使えなくても、エラーにしない。

export const LINK_CHANNEL_NAME = 'oshiyobu-link-v1';
/** 事務所向けの入力は、この間隔でまとめて送る */
export const PUBLISH_DEBOUNCE_MS = 100;

/** 事務所向けの選択のうち、ファン向けに渡すもの */
export interface OfficeSelection {
  readonly venueId: VenueId;
  /** 費用 5 項目の入力値（円）。書き換えていなければ、会場の標準の値 */
  readonly costs: CostValues;
  /** 手で決めた最低人数。決めていなければ null（必要人数に追随する） */
  readonly minPeople: number | null;
}

/** 連動で届いた、事務所向けの選択。receivedAt は受け取った時刻（Date.now）。起動直後の 300 ms の判定に使う */
export interface LinkedOffice {
  readonly selection: OfficeSelection;
  readonly receivedAt: number;
}

type LinkMessage =
  | { readonly type: 'office'; readonly selection: OfficeSelection }
  | { readonly type: 'hello' }
  | { readonly type: 'resetAll' };

const COST_KEYS = ['venue', 'prod', 'fee', 'travel', 'profit'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 受け取った選択を検査する。形が違えば null（捨てる。落ちない） */
export function parseOfficeSelection(value: unknown): OfficeSelection | null {
  if (!isRecord(value) || !isRecord(value.costs)) {
    return null;
  }
  const { venueId, costs, minPeople } = value;
  if (typeof venueId !== 'string' || !(VENUE_IDS as readonly string[]).includes(venueId)) {
    return null;
  }
  const parsed: Record<string, number> = {};
  for (const key of COST_KEYS) {
    const yen = costs[key];
    if (typeof yen !== 'number' || !Number.isSafeInteger(yen) || yen < 0) {
      return null;
    }
    parsed[key] = yen;
  }
  if (
    minPeople !== null &&
    (typeof minPeople !== 'number' || !Number.isSafeInteger(minPeople) || minPeople < 1)
  ) {
    return null;
  }
  return {
    venueId: venueId as VenueId,
    costs: parsed as unknown as CostValues,
    minPeople: minPeople,
  };
}

export interface Link {
  /** 事務所向け: 選択が変わるたびに呼ぶ（100 ms でまとめて送る）。起動直後にも 1 回呼ぶ */
  publishOffice(selection: OfficeSelection): void;
  /** 事務所向け:「デモを最初に戻す」。同じブラウザのファン向けが初期値に戻る（共有メーターには触らない） */
  broadcastResetAll(): void;
  /** ファン向け: 事務所向けの選択が届いているか */
  getLinked(): LinkedOffice | null;
  /** ファン向け: 変化の購読。最初の購読のとき、事務所向けに hello を送る */
  subscribe(listener: () => void): () => void;
  /** ファン向け: resetAll を受けたときの動き（resetFan を渡す） */
  onResetAll(handler: () => void): () => void;
  close(): void;
}

export function createLink(
  ChannelCtor: typeof BroadcastChannel | undefined = globalThis.BroadcastChannel,
  now: () => number = Date.now,
): Link {
  let channel: BroadcastChannel | null = null;
  try {
    channel = ChannelCtor ? new ChannelCtor(LINK_CHANNEL_NAME) : null;
  } catch {
    channel = null;
  }
  let lastPublished: OfficeSelection | null = null;
  let pending: OfficeSelection | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let linked: LinkedOffice | null = null;
  let helloSent = false;
  const listeners = new Set<() => void>();
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
    if (!isRecord(data)) {
      return;
    }
    if (data.type === 'office') {
      const selection = parseOfficeSelection(data.selection);
      if (selection !== null) {
        linked = { selection, receivedAt: now() };
        listeners.forEach((listener) => listener());
      }
    } else if (data.type === 'hello') {
      // 起動したファン向けに、いまの選択を返す
      if (lastPublished !== null) {
        post({ type: 'office', selection: lastPublished });
      }
    } else if (data.type === 'resetAll') {
      resetHandlers.forEach((handler) => handler());
    }
  });

  const flush = (): void => {
    timer = null;
    if (pending !== null) {
      post({ type: 'office', selection: pending });
      pending = null;
    }
  };

  return {
    publishOffice(selection) {
      lastPublished = selection;
      pending = selection;
      timer ??= setTimeout(flush, PUBLISH_DEBOUNCE_MS);
    },
    broadcastResetAll() {
      post({ type: 'resetAll' });
    },
    getLinked: () => linked,
    subscribe(listener) {
      listeners.add(listener);
      if (!helloSent) {
        helloSent = true;
        post({ type: 'hello' });
      }
      return () => {
        listeners.delete(listener);
      };
    },
    onResetAll(handler) {
      resetHandlers.add(handler);
      return () => {
        resetHandlers.delete(handler);
      };
    },
    close() {
      if (timer !== null) {
        clearTimeout(timer);
      }
      channel?.close();
    },
  };
}

let singleton: Link | null = null;
const getLink = (): Link => (singleton ??= createLink());

export const publishOffice = (selection: OfficeSelection): void =>
  getLink().publishOffice(selection);
export const broadcastResetAll = (): void => getLink().broadcastResetAll();
export const onResetAll = (handler: () => void): (() => void) => getLink().onResetAll(handler);

/** ファン向け: 事務所向けから届いた選択（届いていなければ null）。届くたびに描き直す */
export function useLinkedOffice(): LinkedOffice | null {
  const link = getLink();
  return useSyncExternalStore(link.subscribe, link.getLinked, () => null);
}

/** テスト用: 共有の接続を作り直す */
export function resetLinkForTest(): void {
  singleton?.close();
  singleton = null;
}
