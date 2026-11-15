import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { ARTIST_IDS, costsOfTier, parseCost, parseMinPeople, venueById, venuesOf } from '../core';
import type { ArtistId, CityName, CostItemId, CostValues, VenueId } from '../core';
import { broadcastResetAll } from '../shared/link';
import { ARTIST_TEXT } from './text/artists';
import { INITIAL_QUAD_LINE, QUAD_LINE_RANGE, quadPeopleAt } from './scatter';
import type { QuadLine } from './scatter';
import {
  COST_LABELS,
  costErrorText,
  minErrorText,
  quadLineLive,
  quadLineResetLive,
  text,
  verdictText,
} from './text/labels';
import { changedKeys, snapshotOf, viewOf } from './view';
import type { ChangeKey, Snapshot } from './view';

// 事務所向けの状態（メモリだけ。再読み込みで初めに戻る。設計 D-10）。
// 計算は core の純関数（view.ts）。ここでは、選択と入力の流れだけを持つ。

export type Metric = 'reg' | 'hot';
export type ModalName = 'proposal' | 'privacy' | null;

export interface OfficeState {
  artistId: ArtistId;
  metric: Metric;
  city: CityName | null;
  venueId: VenueId | null;
  /** 費用 5 項目のうち、反映済み（検査を通った）値 */
  costs: CostValues;
  /** 入力の途中の文字（検査に通らないものを含む）。無い項目は、反映済みの値を整えて出す */
  costInputs: Partial<Record<CostItemId, string>>;
  costErrors: Partial<Record<CostItemId, string>>;
  /** 手で決めた最低人数。決めていなければ null（必要人数に追随する） */
  minHand: number | null;
  /** 最低人数の入力の途中の文字。null のときは、いまの最低人数を出す */
  minInput: string | null;
  minError: string | null;
  adjustOpen: boolean;
  modal: ModalName;
  /** 読み上げ用の知らせ（aria-live） */
  live: string;
  /** 上の帯の「最初に戻しました」 */
  band: string;
  /** 会場の先頭へフォーカスを移す合図。キーボードで市を選ぶたびに増える（仕様 SP-03）。0 は、まだ移していない */
  venueFocus: number;
  /** 4 象限の区切り（要件 R-12）。推し・市を切り替えても残す。「最初に戻す」で初めの位置に戻る */
  quadLine: QuadLine;
  /** 直前の操作で変わった数字と、その前の値（要件 R-14）。次に数字が変わるまで残す */
  changes: Changes;
}

export interface Changes {
  /** 変わった数字の名前。空なら、強調しない */
  readonly keys: readonly ChangeKey[];
  /** 変わる前の値（keys が空のときは null） */
  readonly prev: Snapshot | null;
  /** 変わるたびに 1 増える。部品が、薄れていく動きを最初からやり直す合図に使う */
  readonly seq: number;
  /**
   * 4 象限の線を動かして変わったか。線は数字を見比べながら動かすので、強調・「前」・読み上げを出さない
   * （記録は残す。#26 の統括の指摘 ②）。推し・会場・費用を替えたときは、線の位置に関係なく出す
   */
  readonly byLine: boolean;
}

const NO_CHANGES: Changes = { keys: [], prev: null, seq: 0, byLine: false };

const EMPTY_COSTS: CostValues = { venue: 0, prod: 0, fee: 0, travel: 0, profit: 0 };

export const initialOfficeState = (): OfficeState => ({
  artistId: ARTIST_IDS[0],
  metric: 'reg',
  city: null,
  venueId: null,
  costs: EMPTY_COSTS,
  costInputs: {},
  costErrors: {},
  minHand: null,
  minInput: null,
  minError: null,
  adjustOpen: false,
  modal: null,
  live: '',
  band: '',
  venueFocus: 0,
  quadLine: INITIAL_QUAD_LINE,
  changes: NO_CHANGES,
});

interface OfficeActions {
  setArtist(id: ArtistId): void;
  setMetric(metric: Metric): void;
  pickCity(city: CityName): void;
  /** キーボードで市を選んだあと、会場の先頭へフォーカスを移すよう頼む（すでに選んでいる市でも移す） */
  focusVenues(): void;
  pickVenue(id: VenueId): void;
  setAdjustOpen(open: boolean): void;
  setCostInput(id: CostItemId, raw: string): void;
  blurCost(id: CostItemId): void;
  setMinInput(raw: string): void;
  blurMin(): void;
  resetMin(): void;
  /** 区切りを動かす。範囲の外・刻みに合わない値は、範囲に収めて刻みに丸める */
  setQuadLine(what: keyof QuadLine, value: number): void;
  resetQuadLine(): void;
  openModal(name: Exclude<ModalName, null>): void;
  closeModal(): void;
  resetOffice(): void;
  resetAll(): void;
}

export const officeStore = createStore<OfficeState & OfficeActions>()((set, get) => {
  let bandTimer: ReturnType<typeof setTimeout> | null = null;

  const announce = (message: string): void => {
    if (bandTimer !== null) clearTimeout(bandTimer);
    set({ band: message });
    bandTimer = setTimeout(() => set({ band: '' }), 4000);
  };

  /** いまの会場のキャパと単位（会場を選んでいないとき null） */
  const capOf = (): { cap: number; unit: string } | null => {
    const id = get().venueId;
    if (id === null) return null;
    const venue = venueById(id);
    return { cap: venue.cap, unit: venue.unit };
  };

  return {
    ...initialOfficeState(),

    setArtist(id) {
      if (id === get().artistId) return;
      set({ artistId: id });
      const view = viewOf(get());
      const name = ARTIST_TEXT[id].name;
      set({
        live:
          `${name}に切り替えました。` +
          (view === null
            ? ''
            : `${get().city}の払える熱いファンの見込みは${view.expected}人。${verdictText(view.level)}。`),
      });
    },

    setMetric(metric) {
      set({ metric });
    },

    pickCity(city) {
      if (get().city === city) return;
      // 市を変えると、会場を選ぶまで判定は出さない。会場・手で書き換えた最低人数・費用の入力は消える（I-14）
      set({
        city,
        venueId: null,
        costs: EMPTY_COSTS,
        costInputs: {},
        costErrors: {},
        minHand: null,
        minInput: null,
        minError: null,
        adjustOpen: false,
        live: `${city}を選びました。会場の候補は${venuesOf(city).length}件です。`,
      });
    },

    focusVenues() {
      set({ venueFocus: get().venueFocus + 1 });
    },

    pickVenue(id) {
      const venue = venueById(id);
      // 会場を選び直したら、費用は会場の区分の値、最低人数は必要人数から始める
      set({
        venueId: id,
        costs: costsOfTier(venue.tier),
        costInputs: {},
        costErrors: {},
        minHand: null,
        minInput: null,
        minError: null,
      });
      const view = viewOf(get());
      if (view !== null) set({ live: `${venue.name}を選びました。${verdictText(view.level)}。` });
    },

    setAdjustOpen(open) {
      set({ adjustOpen: open });
    },

    setCostInput(id, raw) {
      const result = parseCost(raw);
      const errors = { ...get().costErrors };
      if (result.ok) {
        delete errors[id];
        set({
          costs: { ...get().costs, [id]: result.value },
          costInputs: { ...get().costInputs, [id]: raw },
          costErrors: errors,
        });
        return;
      }
      // 反映せず、理由を出す。直させる（空欄は 0 円にしない。決定 13）
      errors[id] = costErrorText(result, COST_LABELS[id]) ?? '';
      set({ costInputs: { ...get().costInputs, [id]: raw }, costErrors: errors });
    },

    blurCost(id) {
      // 欄を離れたら、反映済みの値を 3 桁区切りで出し直す
      const inputs = { ...get().costInputs };
      delete inputs[id];
      set({ costInputs: inputs });
    },

    setMinInput(raw) {
      const place = capOf();
      if (place === null) return;
      const result = parseMinPeople(raw, place.cap);
      if (result.ok) {
        set({ minHand: result.value, minInput: raw, minError: null });
        const view = viewOf(get());
        if (view !== null) {
          set({ live: `最低人数を ${result.value}人にしました。${verdictText(view.level)}。` });
        }
        return;
      }
      // 空欄は、打ち直しの途中（反映しない。理由も出さない）。範囲の外などは、反映せずに理由を出す
      set({ minInput: raw, minError: minErrorText(result, place.cap, place.unit) });
    },

    blurMin() {
      const place = capOf();
      const view = viewOf(get());
      if (place === null || view === null) return;
      const keep = view.condition.min;
      const raw = get().minInput;
      if (raw === null) return;
      const result = parseMinPeople(raw, place.cap);
      if (result.ok) {
        set({ minInput: null, minError: null });
        return;
      }
      // 反映していないので、いまの値に戻す。理由は残す（空欄は理由なし）
      const reason = minErrorText(result, place.cap, place.unit);
      set({
        minInput: null,
        minError: reason === null ? null : `${reason}。もとの ${keep}人 に戻しました`,
      });
    },

    resetMin() {
      set({ minHand: null, minInput: null, minError: null });
      const view = viewOf(get());
      if (view !== null) {
        set({ live: `最低人数を計算の値の ${view.condition.min}人に戻しました。` });
      }
    },

    setQuadLine(what, value) {
      if (!Number.isFinite(value)) return;
      const { min, max, step } = QUAD_LINE_RANGE[what];
      const snapped = Math.min(max, Math.max(min, Math.round((value - min) / step) * step + min));
      if (snapped === get().quadLine[what]) return;
      const quadLine = { ...get().quadLine, [what]: snapped };
      set({ quadLine });
      const { artistId, city } = get();
      if (city !== null) {
        const hotRich = quadPeopleAt(artistId, city, quadLine).people.hotRich;
        set({ live: quadLineLive(what, snapped, hotRich) });
      }
    },

    resetQuadLine() {
      set({ quadLine: INITIAL_QUAD_LINE, live: quadLineResetLive });
    },

    openModal(name) {
      set({ modal: name });
    },
    closeModal() {
      set({ modal: null });
    },

    // 事務所向けだけ戻す。ファン向けには何も送らない（F-36）
    resetOffice() {
      set({ ...initialOfficeState() });
      announce(text.resetOfficeDone);
    },

    // デモを最初に戻す。同じブラウザのファン向けも、人物の初期値に戻る（共有メーターには触らない）
    resetAll() {
      set({ ...initialOfficeState() });
      broadcastResetAll();
      announce(text.resetAllDone);
    },
  };
});

/** いまの状態での、強調の対象の数字（判定が出ていなければ null） */
export function snapshotOfState(state: OfficeState): Snapshot | null {
  const view = viewOf(state);
  if (view === null || state.city === null) return null;
  return snapshotOf(view, quadPeopleAt(state.artistId, state.city, state.quadLine).people);
}

// 状態が変わるたびに、⑤ ⑥ の数字を前と比べる（要件 R-14）。
// - 変わった数字があれば、その名前と前の値を changes に入れる（次に数字が変わるまで残す）
// - 判定が消えた（市を変えた・最初に戻した）ときは、強調を消す。初めて判定が出たときは、強調しない
// - 数字が変わらない操作（枠を開く・指標を替えるなど）は、changes をそのままにする
// - ただし、会場を替えて数字が変わらなかったときは、強調と前の値を消す（前の会場のときの「前」を、
//   今の会場の数字と比べたように見せない。#26 の統括の指摘）
// - 4 象限の線を動かして変わったときは、byLine の印を付ける（画面には出さない。記録は残す）
let lastSnapshot: Snapshot | null = snapshotOfState(officeStore.getState());
let lastVenueId: VenueId | null = officeStore.getState().venueId;
let lastLine: QuadLine = officeStore.getState().quadLine;
officeStore.subscribe((state) => {
  const next = snapshotOfState(state);
  const prev = lastSnapshot;
  const venueChanged = state.venueId !== lastVenueId;
  const byLine =
    state.quadLine.deposit !== lastLine.deposit || state.quadLine.heat !== lastLine.heat;
  lastSnapshot = next;
  lastVenueId = state.venueId;
  lastLine = state.quadLine;
  if (next === null) {
    if (state.changes.keys.length > 0) officeStore.setState({ changes: NO_CHANGES });
    return;
  }
  const keys = changedKeys(prev, next);
  if (keys.length === 0) {
    if (venueChanged && state.changes.keys.length > 0)
      officeStore.setState({ changes: NO_CHANGES });
    return;
  }
  officeStore.setState({ changes: { keys, prev, seq: state.changes.seq + 1, byLine } });
});

export function useOffice<T>(selector: (state: OfficeState & OfficeActions) => T): T {
  return useStore(officeStore, selector);
}
