// ストアを React につなぐ。条件とメーター（共有の部品の I/F）を描画のたびにストアへ渡し、
// 画面が使う「いまの状態 ＋ 派生値 ＋ 操作」を context で配る。
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { performanceIdOf, resolvePersonaNo } from '../core';
import {
  getDeviceId,
  joinPerformance,
  requestMeterFetch,
  subscribeMeterReset,
  useEffectiveCondition,
  useLinkedOffice,
  useSharedMeter,
} from '../adapter';
import { registerResetFan } from '../link';
import type { FanState } from '../domain/state';
import { viewOf } from '../domain/view';
import type { FanView } from '../domain/view';
import { createFanStore, defaultDeps } from './store';
import type { FanActions, FanStore } from './store';

type FanContextValue = { state: FanState; view: FanView; actions: FanActions; personaNo: number };
const FanContext = createContext<FanContextValue | null>(null);

/** `?p=` の指定と端末の番号から、人物の番号を決める（設計 D-19。保存しない）。 */
export function personaNoFromLocation(search: string): number {
  return resolvePersonaNo(getDeviceId(), new URLSearchParams(search).get('p'));
}

type Props = { personaNo: number; store?: FanStore; children: ReactNode };

export function FanProvider({ personaNo, store: given, children }: Props) {
  const [store] = useState<FanStore>(
    () =>
      given ??
      createFanStore({
        personaNo,
        deps: defaultDeps({ join: joinPerformance, fetch: requestMeterFetch }),
      }),
  );
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const pid = performanceIdOf(state.oshiId, state.venueId);
  const cond = useEffectiveCondition(state.venueId);
  const meter = useSharedMeter(pid);
  const serverJoined = meter.joined;
  const counted = meter.mineCounted;
  useLayoutEffect(() => {
    store.setEnv({ cond, pid, meter: { serverJoined, counted } });
  }, [store, cond, pid, serverJoined, counted]);
  useLayoutEffect(() => () => store.dispose(), [store]);
  // 共有メーターの reset の検知と、事務所向けの「デモを最初に戻す」を受ける
  useEffect(() => {
    const off1 = subscribeMeterReset((info) => store.actions.serverReset(info.counted));
    const off2 = registerResetFan(store.actions.resetFanQuiet);
    return () => {
      off1();
      off2();
    };
  }, [store]);
  // 事務所向けと連動したら、まだ選び直していない初めの値を、事務所向けの会場に合わせる
  const officeVenue = useLinkedOffice()?.venueId ?? null;
  useEffect(() => {
    store.actions.applyOffice(officeVenue);
  }, [store, officeVenue]);
  const view = useMemo(
    () => viewOf(state, cond, { serverJoined, counted }),
    [state, cond, serverJoined, counted],
  );
  const value = useMemo(
    () => ({ state, view, actions: store.actions, personaNo }),
    [state, view, store, personaNo],
  );
  return <FanContext.Provider value={value}>{children}</FanContext.Provider>;
}

export function useFan(): FanContextValue {
  const v = useContext(FanContext);
  if (!v) throw new Error('FanProvider の外では使えません');
  return v;
}
