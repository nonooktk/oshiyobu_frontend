// ストアを React につなぐ。条件とメーター（共有の部品の I/F）を描画のたびにストアへ渡し、
// 画面が使う「いまの状態 ＋ 派生値 ＋ 操作」を context で配る。
// ストアは、React の外（モジュールの中）に 1 つ持つ。ルートの受け皿が中身を作り直しても、状態（申し込み・人数）は残る（設計 D-40）。
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { performanceIdOf } from '../../core';
import { useEffectiveCondition } from '../../shared/condition';
import { onResetAll, useLinkedOffice } from '../../shared/link';
import {
  isSoloMeter,
  joinPerformance,
  requestMeterFetch,
  useSharedMeter,
} from '../../shared/meter';
import { getPersona } from '../../shared/persona';
import type { FanState } from '../domain/state';
import { viewOf } from '../domain/view';
import type { FanView } from '../domain/view';
import { createFanLifecycle } from './lifecycle';
import { createFanStore, defaultDeps } from './store';
import type { FanActions, FanStore } from './store';

type FanContextValue = { state: FanState; view: FanView; actions: FanActions };
const FanContext = createContext<FanContextValue | null>(null);

let appStore: FanStore | null = null;

/** 画面が使うストア（1 つだけ）。人物は、`?p=` の指定か端末の番号から決まる（設計 D-19。保存しない）。 */
export function getAppStore(): FanStore {
  appStore ??= createFanStore({
    personaNo: getPersona().no,
    deps: defaultDeps({ join: joinPerformance, fetch: requestMeterFetch, solo: isSoloMeter }),
  });
  return appStore;
}

/** テスト用: ストアを作り直す（再読み込みの代わり）。 */
export function resetAppStoreForTest(): void {
  appStore?.dispose();
  appStore = null;
}

type Props = { store: FanStore; children: ReactNode };

export function FanProvider({ store, children }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const pid = performanceIdOf(state.oshiId, state.venueId);
  const cond = useEffectiveCondition(state.venueId);
  // はじめの画面では、2 秒おきの取得はしない（契機の 1 回だけ。設計 D-18 の規則 8）
  const meter = useSharedMeter(pid, { poll: state.page !== 'start' });
  const serverJoined = meter.joined;
  const counted = meter.mineCounted;
  const resetEpoch = meter.resetEpoch;
  useLayoutEffect(() => {
    store.setEnv({ cond, pid, meter: { serverJoined, counted } });
  }, [store, cond, pid, serverJoined, counted]);

  // reset を検知したとき（resetEpoch が増えたとき）: 数えられていた自分の申し込みは「未申し込み」に戻し、擬似の仲間の加算を消す
  const countedBefore = useRef(false);
  const epochSeen = useRef(resetEpoch);
  useEffect(() => {
    if (epochSeen.current !== resetEpoch) {
      epochSeen.current = resetEpoch;
      store.actions.serverReset(countedBefore.current);
    }
    countedBefore.current = counted;
  }, [store, resetEpoch, counted]);

  // 事務所向けの「デモを最初に戻す」を受けたら、ファン向けも初めに戻る（連動。共有メーターには触らない）
  useEffect(() => onResetAll(store.actions.resetFanQuiet), [store]);
  // ひとり体験のとき: 閉じたら（bfcache から戻ったときも）初めの状態に戻し、5 分操作が無くても戻す。
  // 共有メーターあり（VITE_SHARED_METER=on）は、これまでどおり、戻さない
  useEffect(() => {
    if (!isSoloMeter()) return undefined;
    const { resetForIdle, resetFanQuiet, toast, announce } = store.actions;
    const notice = (text: string): void => {
      toast(text, 4000);
      announce(text);
    };
    return createFanLifecycle({ resetForIdle, resetQuiet: resetFanQuiet, notice }).dispose;
  }, [store]);
  // 事務所向けと連動したら、まだ選び直していない初めの値を、事務所向けの会場に合わせる
  const officeVenue = useLinkedOffice()?.selection.venueId ?? null;
  useEffect(() => {
    store.actions.applyOffice(officeVenue);
  }, [store, officeVenue]);

  const solo = isSoloMeter();
  const view = useMemo(
    () => viewOf(state, cond, { serverJoined, counted }, solo),
    [state, cond, serverJoined, counted, solo],
  );
  const value = useMemo(() => ({ state, view, actions: store.actions }), [state, view, store]);
  return <FanContext.Provider value={value}>{children}</FanContext.Provider>;
}

export function useFan(): FanContextValue {
  const v = useContext(FanContext);
  if (!v) throw new Error('FanProvider の外では使えません');
  return v;
}
