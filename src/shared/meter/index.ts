import { useEffect, useSyncExternalStore } from 'react';
import type { PerformanceId } from '../../core';
import { API_BASE } from './config';
import * as client from './client';
import { createMeterEngine } from './engine';
import type { MeterEngine } from './engine';
import type { MeterFetchReason, MeterStatus, SharedMeter } from './types';

// 共有メーター（設計 D-17・D-18・D-41）。ファン向けの画面が使う口。
// API の接続先（ビルド時の VITE_API_BASE）が未設定なら、サーバーなしで動く（初期値のまま。通信しない）。
// 画面の部品から fetch を呼ばない。通信はこのフォルダの中だけ。

export type { MeterFetchReason, MeterStatus, SharedMeter };
export type { ResetOutcome } from './client';

/** API の接続先が設定されているか（未設定なら、サーバーなしで動いている） */
export const API_CONFIGURED: boolean = API_BASE !== '';

let engine: MeterEngine | null = null;
const getEngine = (): MeterEngine => (engine ??= createMeterEngine({ apiBase: API_BASE }));

/**
 * 公演のメーター。購読している間だけ、サーバーを 2 秒おきに見に行く（ホーム以降の、メーターを出している画面で呼ぶ）。
 * 値を読むだけで、2 秒おきの取得は要らない画面（はじめの画面など）は、`{ poll: false }` を渡す。
 * performanceId が null なら、何もしない。
 */
export function useSharedMeter(
  performanceId: PerformanceId | null,
  options: { readonly poll?: boolean } = {},
): SharedMeter {
  const meter = getEngine();
  const poll = options.poll ?? true;
  useEffect(() => {
    if (performanceId === null) return undefined;
    meter.watch(performanceId);
    return poll ? meter.subscribe(performanceId) : undefined;
  }, [meter, performanceId, poll]);
  return useSyncExternalStore(
    meter.subscribeStore,
    () => (performanceId === null ? meter.getIdle() : meter.getSnapshot(performanceId)),
    () => meter.getIdle(),
  );
}

/** 申し込みを送る。端末の番号で冪等。すぐ戻り、失敗しても例外を投げず、再送は内側で行う */
export function joinPerformance(performanceId: PerformanceId): void {
  getEngine().join(performanceId);
}

/** サーバーの人数を、1 回取りに行くよう頼む（前の取得から 1.8 秒たってから送る） */
export function requestMeterFetch(reason: MeterFetchReason): void {
  getEngine().requestFetch(reason);
}

/** reset を検知したときの動きを登録する。返す関数で解除する */
export function onMeterReset(handler: () => void): () => void {
  return getEngine().onReset(handler);
}

/** 通信が飛んでいる間は true（絵などの先読みは、この間は始めない。D-40） */
export function isMeterBusy(): boolean {
  return getEngine().isBusy();
}

/** 発表者用の画面: 全公演の人数を戻す。合言葉は保存しない。結果は、原因ごとに分けて返す（SP-67） */
export function resetSharedMeter(passphrase: string): Promise<client.ResetOutcome> {
  return API_BASE === ''
    ? Promise.resolve({ kind: 'network' })
    : client.postReset(API_BASE, passphrase);
}

/** 発表者用の画面: 接続の確認（GET /healthz の応答時間）。サーバーなしのときは、つながっていない扱い */
export function checkApiHealth(): ReturnType<typeof client.checkHealth> {
  return API_BASE === ''
    ? Promise.resolve({ ok: false, ms: 0, kind: 'offline' })
    : client.checkHealth(API_BASE);
}

/** テスト用: 共有の仕組みを差し替える（null で、もとの設定に戻す） */
export function setMeterEngineForTest(next: MeterEngine | null): void {
  engine?.dispose();
  engine = next;
}
