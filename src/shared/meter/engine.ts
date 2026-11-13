import type { MeterResponse, PerformanceId } from '../../core';
import { getDeviceId } from '../device';
import * as client from './client';
import type { MeterFetchReason, MeterStatus, SharedMeter } from './types';

// 共有メーターの取得・申し込みの仕組み（設計 D-17・D-18・D-41）。
// 画面は、API の応答を待たずに描く。通信は裏で行い、失敗しても例外を投げず、エラーの画面も文言も出さない。

/** ポーリングの間隔（ミリ秒）と、ゆらぎの割合（±10%） */
export const POLL_MS = 2000;
export const POLL_JITTER = 0.1;
/** 取得の間隔の下限。どの契機でも、前の取得の開始から、これ未満では送らない（10 分で 1 分あたり 34 回以下） */
export const FLOOR_MS = 1800;
/** 失敗が続いたあとの間隔（2 → 4 → 8 → 10 秒。上限 10 秒。止めない） */
export const FAILURE_MS = [2000, 4000, 8000, 10000] as const;
/** 開いた直後の最初の取得を遅らせる上限（QR の読み取りが重なっても、100 台が同時に来ない） */
export const OPEN_DELAY_MAX_MS = 1000;
/** 申し込みの再送の間隔（1・2・4・8・16 秒。最大 5 回。以後は、次の取得が成功したときに再送） */
export const JOIN_RETRY_MS = [1000, 2000, 4000, 8000, 16000] as const;

export interface EngineDeps {
  /** API の接続先（origin）。空ならサーバーなし（通信せず、初期値のまま動く） */
  readonly apiBase: string;
  readonly deviceId?: () => string;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly isVisible?: () => boolean;
  readonly isOnline?: () => boolean;
}

interface PidState {
  joined: number;
  mineCounted: boolean;
  /** 最初に受けた応答の resetAt（reset の検知の基準）。undefined は、まだ受けていない */
  baseline: string | null | undefined;
  resetEpoch: number;
  /** 公演ごとの連番。要求ごとに増やし、古い連番の応答だけ捨てる */
  seq: number;
  applied: number;
  joinSending: boolean;
  joinFailures: number;
  /** 再送を使い切った。次の取得が成功したときに、もう一度送る */
  joinUnsent: boolean;
}

export interface MeterEngine {
  watch(pid: PerformanceId): void;
  subscribe(pid: PerformanceId): () => void;
  requestFetch(reason: MeterFetchReason): void;
  join(pid: PerformanceId): void;
  onReset(handler: () => void): () => void;
  isBusy(): boolean;
  getSnapshot(pid: PerformanceId): SharedMeter;
  getIdle(): SharedMeter;
  subscribeStore(listener: () => void): () => void;
  dispose(): void;
}

export function createMeterEngine(deps: EngineDeps): MeterEngine {
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const deviceId = deps.deviceId ?? getDeviceId;
  const visible =
    deps.isVisible ??
    (() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const online = deps.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine);
  const base = deps.apiBase;

  const states = new Map<PerformanceId, PidState>();
  const snapshots = new Map<PerformanceId, SharedMeter>();
  const pollers = new Map<PerformanceId, number>();
  const listeners = new Set<() => void>();
  const resetHandlers = new Set<() => void>();
  let status: MeterStatus = base === '' ? 'offline' : 'connecting';
  let idle: SharedMeter | null = null;
  let failures = 0;
  let inflight = 0;
  let getInflight = false;
  let lastStart = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerAt = Number.POSITIVE_INFINITY;
  let watched: PerformanceId | null = null;
  let oneShot: PerformanceId | null = null;
  let pendingReason: MeterFetchReason | null = null;

  const stateOf = (pid: PerformanceId): PidState => {
    let state = states.get(pid);
    if (state === undefined) {
      state = {
        joined: 0,
        mineCounted: false,
        baseline: undefined,
        resetEpoch: 0,
        seq: 0,
        applied: 0,
        joinSending: false,
        joinFailures: 0,
        joinUnsent: false,
      };
      states.set(pid, state);
    }
    return state;
  };

  const build = (state: PidState): SharedMeter => ({
    joined: state.joined,
    status,
    mineCounted: state.mineCounted,
    resetEpoch: state.resetEpoch,
  });
  const same = (a: SharedMeter, b: SharedMeter): boolean =>
    a.joined === b.joined &&
    a.status === b.status &&
    a.mineCounted === b.mineCounted &&
    a.resetEpoch === b.resetEpoch;

  const publish = (pid: PerformanceId): void => {
    const next = build(stateOf(pid));
    const prev = snapshots.get(pid);
    if (prev === undefined || !same(prev, next)) {
      snapshots.set(pid, next);
      listeners.forEach((listener) => listener());
    }
  };
  const setStatus = (next: MeterStatus): void => {
    if (status !== next) {
      status = next;
      idle = null;
      for (const pid of states.keys()) publish(pid);
      listeners.forEach((listener) => listener());
    }
  };
  const succeeded = (): void => {
    failures = 0;
    penaltyMs = 0;
    setStatus('ok');
  };
  /** サーバーが待つよう求めた時間（Retry-After）。次の間隔は、これより短くしない。成功したら 0 に戻す */
  let penaltyMs = 0;
  const failed = (retryAfterMs?: number): void => {
    failures += 1;
    penaltyMs = retryAfterMs ?? 0;
    setStatus('failing');
  };

  /** 応答を反映する。古い連番の応答だけ捨てる。reset の検知は D-18 の規則 10 */
  const apply = (pid: PerformanceId, seq: number, meter: MeterResponse, isJoin: boolean): void => {
    const state = stateOf(pid);
    if (seq < state.applied) return;
    state.applied = seq;
    if (state.baseline === undefined) {
      state.baseline = meter.resetAt;
    } else if (meter.resetAt !== state.baseline) {
      state.baseline = meter.resetAt;
      state.mineCounted = false;
      state.resetEpoch += 1;
      resetHandlers.forEach((handler) => handler());
    }
    state.joined = meter.joined;
    // 申し込みの応答は、counted が true でも false（前に数えられていた）でも、サーバーの人数に自分の分が入っている
    if (isJoin) state.mineCounted = true;
    publish(pid);
  };

  const pollTarget = (): PerformanceId | null => {
    if (watched !== null && (pollers.get(watched) ?? 0) > 0) return watched;
    for (const [pid, count] of pollers) if (count > 0) return pid;
    return null;
  };
  const nextDelay = (): number =>
    failures > 0
      ? Math.max(FAILURE_MS[Math.min(failures - 1, FAILURE_MS.length - 1)] ?? 10000, penaltyMs)
      : POLL_MS * (1 + (random() * 2 - 1) * POLL_JITTER);

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    timerAt = Number.POSITIVE_INFINITY;
  };
  /** delay 後に取りに行く。前の取得の開始から FLOOR_MS 未満にはしない。すでにもっと早い予約があれば、それを残す */
  const schedule = (delay: number): void => {
    const at = Math.max(now() + delay, lastStart + FLOOR_MS);
    if (timer !== null && timerAt <= at) return;
    clearTimer();
    timerAt = at;
    timer = setTimeout(() => void tick(), Math.max(0, at - now()));
  };

  const attemptJoin = async (pid: PerformanceId): Promise<void> => {
    const state = stateOf(pid);
    state.seq += 1;
    const seq = state.seq;
    inflight += 1;
    const result = await client.postJoin(base, pid, deviceId());
    inflight -= 1;
    if (result.ok) {
      apply(pid, seq, result.value, true);
      state.joinSending = false;
      state.joinUnsent = false;
      succeeded();
      return;
    }
    const retryAfterMs = result.kind === 'http' ? result.retryAfterMs : undefined;
    if (result.kind === 'http' && result.status === 409) {
      // 上限に達している（cap_reached）。申し込みは送信済みとして扱い、再送しない。画面には出さない
      state.joinSending = false;
      state.joinUnsent = false;
      return;
    }
    failed(retryAfterMs);
    state.joinFailures += 1;
    const wait = JOIN_RETRY_MS[state.joinFailures - 1];
    if (wait === undefined) {
      // 再送を使い切った。次の取得が成功したときに、もう一度送る
      state.joinSending = false;
      state.joinUnsent = true;
      return;
    }
    setTimeout(() => void attemptJoin(pid), Math.max(wait, retryAfterMs ?? 0));
  };

  const startJoin = (pid: PerformanceId): void => {
    const state = stateOf(pid);
    state.joinSending = true;
    state.joinUnsent = false;
    state.joinFailures = 0;
    void attemptJoin(pid);
  };

  const runGet = async (pid: PerformanceId): Promise<void> => {
    const state = stateOf(pid);
    state.seq += 1;
    const seq = state.seq;
    lastStart = now();
    inflight += 1;
    getInflight = true;
    const result = await client.getMeter(base, pid);
    getInflight = false;
    inflight -= 1;
    if (result.ok) {
      apply(pid, seq, result.value, false);
      succeeded();
      if (state.joinUnsent && !state.joinSending) startJoin(pid);
    } else {
      failed(result.kind === 'http' ? result.retryAfterMs : undefined);
    }
  };

  const tick = async (): Promise<void> => {
    timer = null;
    timerAt = Number.POSITIVE_INFINITY;
    const pid = pollTarget() ?? oneShot;
    oneShot = null;
    // 隠れている間・回線が切れている間は取らない。戻ったときに、すぐ 1 回取りに行く
    if (pid === null || base === '' || !visible() || !online() || getInflight) return;
    await runGet(pid);
    if (pollTarget() !== null) schedule(nextDelay());
  };

  const resume = (): void => {
    if (base !== '' && (pollTarget() !== null || oneShot !== null)) schedule(0);
  };
  const onVisibility = (): void => {
    if (visible()) resume();
    else clearTimer();
  };
  const onOnline = (): void => resume();
  const onOffline = (): void => clearTimer();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

  return {
    watch(pid) {
      watched = pid;
      if (pendingReason !== null) {
        const reason = pendingReason;
        pendingReason = null;
        this.requestFetch(reason);
      }
    },
    subscribe(pid) {
      watched = pid;
      pollers.set(pid, (pollers.get(pid) ?? 0) + 1);
      if (base !== '' && timer === null && !getInflight) schedule(nextDelay());
      return () => {
        const count = (pollers.get(pid) ?? 1) - 1;
        if (count <= 0) pollers.delete(pid);
        else pollers.set(pid, count);
        // 見ている画面が無くなったら、2 秒おきの取得を止める
        if (pollTarget() === null && oneShot === null) clearTimer();
      };
    },
    requestFetch(reason) {
      if (base === '') return;
      if (watched === null) {
        pendingReason = reason;
        return;
      }
      oneShot = watched;
      schedule(reason === 'open' ? random() * OPEN_DELAY_MAX_MS : 0);
    },
    join(pid) {
      if (base === '') return;
      const state = stateOf(pid);
      if (state.mineCounted || state.joinSending) return;
      startJoin(pid);
    },
    onReset(handler) {
      resetHandlers.add(handler);
      return () => {
        resetHandlers.delete(handler);
      };
    },
    isBusy: () => inflight > 0,
    getSnapshot(pid) {
      let snapshot = snapshots.get(pid);
      if (snapshot === undefined) {
        snapshot = build(stateOf(pid));
        snapshots.set(pid, snapshot);
      }
      return snapshot;
    },
    getIdle() {
      idle ??= { joined: 0, status, mineCounted: false, resetEpoch: 0 };
      return idle;
    },
    subscribeStore(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      clearTimer();
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onVisibility);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    },
  };
}
