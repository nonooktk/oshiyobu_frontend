// 【仮】レーン間の I/F（設計 D-35）の仮の実装。本物（`src/shared/`）が dev に入ったら消す（`_stub/README.md`）。
// 通信はしない（共有メーターの人数は、メモリの中の仮の値）。形は設計 D-18・D-35・D-40・D-44 に合わせる。
import { useSyncExternalStore } from 'react';
import { conditionOf } from '../core';
import type { ArtistId, Condition, CostValues, PerformanceId, VenueId } from '../core';

/* ---------- 端末の番号（設計 D-10・K-23） ---------- */
const DEVICE_KEY = 'oshiyobu.v1.device';
let memoryDeviceId: string | null = null;

function makeDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 端末の番号。localStorage に残す。使えないときは、メモリの番号で動く。 */
export function getDeviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const made = makeDeviceId();
    localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    memoryDeviceId ??= makeDeviceId();
    return memoryDeviceId;
  }
}

/* ---------- 共有メーター（設計 D-18・D-41） ---------- */
export type MeterStatus = 'idle' | 'ok' | 'failing';
export type SharedMeter = {
  /** サーバーの件数（申し込みの件数。0 から）。取れていなければ 0。 */
  joined: number;
  status: MeterStatus;
  /** この端末の申し込みが、サーバーに数えられた印。 */
  mineCounted: boolean;
};
export type MeterFetchReason = 'open' | 'step3' | 'performance-changed';

type MeterEntry = { joined: number; counted: boolean };
const meters = new Map<PerformanceId, MeterEntry>();
const meterListeners = new Set<() => void>();
const snapshots = new Map<PerformanceId, SharedMeter>();

function meterSnapshot(pid: PerformanceId): SharedMeter {
  const entry = meters.get(pid) ?? { joined: 0, counted: false };
  const prev = snapshots.get(pid);
  if (prev && prev.joined === entry.joined && prev.mineCounted === entry.counted) return prev;
  const next: SharedMeter = { joined: entry.joined, status: 'idle', mineCounted: entry.counted };
  snapshots.set(pid, next);
  return next;
}
function emitMeter(): void {
  meterListeners.forEach((listener) => listener());
}

export function useSharedMeter(performanceId: PerformanceId): SharedMeter {
  return useSyncExternalStore(
    (listener) => {
      meterListeners.add(listener);
      return () => meterListeners.delete(listener);
    },
    () => meterSnapshot(performanceId),
  );
}

/** 取得の契機の依頼。仮の実装では、何もしない。 */
export function requestMeterFetch(reason: MeterFetchReason): void {
  void reason;
}

/** 申し込みを送る。即座に戻る。仮の実装では、メモリの件数を 1 つ増やして、数えられた印を付ける（同じ端末は 1 回だけ）。 */
export function joinPerformance(performanceId: PerformanceId): void {
  const entry = meters.get(performanceId) ?? { joined: 0, counted: false };
  if (!entry.counted) {
    meters.set(performanceId, { joined: entry.joined + 1, counted: true });
    emitMeter();
  }
}

/** テスト・確認用: ほかの端末の申し込みでサーバーの件数が変わった状態を作る。 */
export function stubSetServerJoined(performanceId: PerformanceId, joined: number): void {
  const entry = meters.get(performanceId) ?? { joined: 0, counted: false };
  meters.set(performanceId, { ...entry, joined });
  emitMeter();
}
/** テスト・確認用: 共有メーターを空にする（reset 後の端末の状態も初めに戻る）。 */
export function stubResetMeters(): void {
  meters.clear();
  snapshots.clear();
  emitMeter();
}

/** reset を検知したときの受け口。counted ＝ 自分の申し込みが、サーバーに数えられていたか。 */
export type MeterResetInfo = { performanceId: PerformanceId; counted: boolean };
const resetListeners = new Set<(info: MeterResetInfo) => void>();
export function subscribeMeterReset(listener: (info: MeterResetInfo) => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}
/** テスト・確認用: 発表者の reset を、端末が検知した状態を作る（人数は 0 に戻り、数えた印は消える）。 */
export function stubTriggerReset(performanceId: PerformanceId): void {
  const entry = meters.get(performanceId) ?? { joined: 0, counted: false };
  meters.set(performanceId, { joined: 0, counted: false });
  emitMeter();
  resetListeners.forEach((listener) => listener({ performanceId, counted: entry.counted }));
}

/* ---------- 事務所向けとの連動（設計 D-44） ---------- */
export type OfficeSelection = {
  venueId: VenueId;
  costs: CostValues;
  minPeople: number | null;
};

/** 連動で届いた、事務所向けの選択。連動の相手がいなければ null。仮の実装では、いつも null。 */
export function useLinkedOffice(): OfficeSelection | null {
  return null;
}

/** いま出す条件。事務所向けと同じ会場を出しているときだけ、事務所向けの費用・最低人数を使う（決定 14）。 */
export function useEffectiveCondition(venueId: VenueId): Condition {
  const office = useLinkedOffice();
  if (office && office.venueId === venueId) {
    return conditionOf(venueId, { costs: office.costs, minPeople: office.minPeople });
  }
  return conditionOf(venueId);
}

/* ---------- 先読み（設計 D-40） ---------- */
export type ImageState = 'ready' | 'loading' | 'missing';
const imageStates = new Map<string, ImageState>();
const imageListeners = new Set<() => void>();

/** 絵を、高い優先度で読み始める。 */
export function needImage(url: string): void {
  if (imageStates.has(url)) return;
  imageStates.set(url, 'loading');
  const img = new Image();
  img.onload = () => {
    imageStates.set(url, 'ready');
    imageListeners.forEach((listener) => listener());
  };
  img.onerror = () => {
    imageStates.set(url, 'missing');
    imageListeners.forEach((listener) => listener());
  };
  img.src = url;
}

export function useImageState(url: string): ImageState {
  return useSyncExternalStore(
    (listener) => {
      imageListeners.add(listener);
      return () => imageListeners.delete(listener);
    },
    () => imageStates.get(url) ?? 'loading',
  );
}

/** テスト用: 絵の読み込みの記録を空にする。 */
export function stubResetImages(): void {
  imageStates.clear();
}

/** ready の 1 秒後に呼ぶ先読みの入り口。仮の実装では、何もしない。 */
export function startPrefetch(artistId: ArtistId): void {
  void artistId;
}
