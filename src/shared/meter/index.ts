import { useEffect, useSyncExternalStore } from 'react';
import type { PerformanceId } from '../../core';
import { API_BASE, METER_BASE } from './config';
import * as client from './client';
import { createMeterEngine } from './engine';
import type { MeterEngine } from './engine';
import type { MeterFetchReason, MeterStatus, SharedMeter } from './types';

// 共有メーター（設計 D-17・D-18・D-41）。ファン向けの画面が使う口。
// API の接続先（ビルド時の VITE_API_BASE）が未設定なら、サーバーなしで動く（初期値のまま。通信しない）。
// ビルド時の VITE_SHARED_METER=on のときだけ、ファン向けは API を使う。既定は「ひとり体験」（接続先があっても通信しない）。
// 画面の部品から fetch を呼ばない。通信はこのフォルダの中だけ。

export type { MeterFetchReason, MeterStatus, SharedMeter };
export type { ResetOutcome } from './client';

/** API の接続先が設定されているか（未設定なら、サーバーなしで動いている。発表者用の画面が使う） */
export const API_CONFIGURED: boolean = API_BASE !== '';

let engine: MeterEngine | null = null;
// ファン向けの共有メーターの接続先は METER_BASE（共有にしない既定では空）。発表者用の画面は、下で API_BASE を直接使う
const getEngine = (): MeterEngine => (engine ??= createMeterEngine({ apiBase: METER_BASE }));

/** ファン向けが通信しない（ひとり体験）か。true なら、人数は端末の中だけで数え、5 分操作が無ければ初めに戻る */
export function isSoloMeter(): boolean {
  return getEngine().isSolo();
}

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

/**
 * サーバーの人数を、1 回取りに行くよう頼む（前の取得から 1.8 秒たってから送る）。
 * performanceId を渡すと、見ている公演ではなく、その公演を取る（はじめの画面で選び直して、まだ確定していない公演。G2-04）
 */
export function requestMeterFetch(reason: MeterFetchReason, performanceId?: PerformanceId): void {
  getEngine().requestFetch(reason, performanceId);
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
