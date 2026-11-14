// ファン向けの状態の型と、初めの値（端末の中だけ。再読み込みで初めに戻る。設計 D-10）。
import { defaultVenueIdOf } from '../../core';
import type { ArtistId, CityName, CourseId, VenueId } from '../../core';

/** 達成した行動 6 つ（SP-45）。 */
export const ACT_IDS = ['join', 'share', 'friend', 'main', 'deposit', 'teiki'] as const;
export type ActId = (typeof ACT_IDS)[number];
/** 特典 1・2・3 を開く行動（SP-29。開く順番は問わない）。 */
export const GIFT_ACTS = ['join', 'share', 'friend'] as const;
export type GiftAct = (typeof GIFT_ACTS)[number];
/** 口座と預金の 3 つの行動。 */
export type AcctId = 'main' | 'deposit' | 'teiki';

export type Page =
  | 'start'
  | 'home'
  | 'next'
  | 'more'
  | 'menu'
  | 'acct'
  | 'contrib'
  | 'area'
  | 'how'
  | 'opt'
  | 'priv';

/** 呼ぶ市は、どの推しでも久留米市（統括の決定）。会場は、久留米の既定の会場（久留米シティプラザ Cボックス）。 */
export const FAN_CITY: CityName = '久留米市';
export const FAN_VENUE_ID: VenueId = defaultVenueIdOf(FAN_CITY);

export type ShareMode = 'friend' | 'share';

/** 端末の中の、ファン向けの進み（SP「端末の中の状態」）。 */
export type Fan = {
  oshiId: ArtistId;
  /** 希望のコース。申し込んだコースとは別（「推し・条件の変更」で選ぶ）。 */
  seat: CourseId;
  city: CityName;
  venueId: VenueId;
  /** 申し込んだコース。null ＝ まだ申し込んでいない。 */
  course: CourseId | null;
  /** 目指すコース（まだ申し込んでいないときに、上位コースを目指して登録したもの）。 */
  aim: CourseId | null;
  /** 擬似の仲間（端末の中だけ。0 か 1）。 */
  friends: number;
  /** 80% の演出を出したか（やめて申し込み直しても戻さない）。 */
  milestoneShown: boolean;
  done: Readonly<Partial<Record<ActId, true>>>;
  /** 開いた特典（3 つ）。 */
  gifts: readonly [boolean, boolean, boolean];
  /** 呼んだ仲間の数。 */
  called: number;
  /** 直前に開いた特典の行動（推しのひとことを決める）。 */
  lastGift: GiftAct;
  /** ホームの絵: 開いた特典の何番目の絵を出しているか（−1 ＝ 開放が 0）。 */
  homeIdx: number;
  /** 擬似の口座・預金。 */
  acct: { pay: boolean; deposit: number; times: number };
  /** 感謝のメッセージを出したか（1 回だけ）。 */
  thanksShown: boolean;
};

/** はじめの画面（推し → コースの 2 つ）の、選んでいる最中の値。市は選ばない（久留米市に固定）。 */
export type StartSel = {
  step: 0 | 1;
  oshiId: ArtistId;
  seat: CourseId;
  /** 利用者が、推し・コースのどれかを選び直したか（5 分操作が無いとき、戻すものがあるかの判断）。 */
  touched: boolean;
};

/** 「推し・条件の変更」の、選んでいる最中の値。 */
export type Pend = { oshiId: ArtistId; seat: CourseId };

/**
 * 演出の種類。称賛の演出（行動の直後）は、申し込み（join・stage）・投稿（share）・仲間に知らせる（notify）・仲間を呼ぶ（friend）・
 * FEVER の瞬間（fever）。gift は特典が開いたときのごほうび。
 */
export type FxKind = 'join' | 'stage' | 'share' | 'notify' | 'friend' | 'fever' | 'gift';

/** 80% の演出・特典の演出などの、全画面の演出。 */
export type FxSpec = {
  id: number;
  kind: FxKind;
  /** 派手にするか（帯・揺れ。FEVER の瞬間だけ）。ほかは標準の強さ。 */
  strong: boolean;
  /** ホームの上で、ゲージの手前までを暗くするか（ゲージの伸びが見えるように。称賛の演出が true）。 */
  overHome: boolean;
  title: string;
  small: string;
  sub: string;
  size: number;
  stroke: number;
  subSize: number;
  /** 下の枠に出す、推しの口調の一言。 */
  say?: string;
  /** 長さ（ミリ秒）。動きを減らす設定では reduceMs。 */
  ms: number;
  reduceMs: number;
  confetti: readonly Confetto[];
};

/** 紙吹雪の 1 粒。 */
export type Confetto = { left: number; color: string; dur: number; delay: number };

/** 行動の直後の短い称賛（推し活定期をはじめた・預金を積み増した・メイン口座にした）。控えめな札で、操作は止めない。 */
export type AchSpec = {
  id: number;
  /** 1 行目（あなたがしたこと）。 */
  title: string;
  /** 2 行目（それで何が進んだか）。 */
  sub: string;
  ms: number;
};

/** 仲間を呼んだあとの、ゲージの伸び（伸びる前の長さ → 満タンまで。終わりに近いほど速く伸びる）。 */
export type GaugeRun = { from: number; to: number; ms: number; nonce: number };

export type Layer =
  | { kind: 'fx'; fx: FxSpec }
  | { kind: 'gift'; replay: boolean }
  | { kind: 'thanks' }
  | { kind: 'share'; mode: ShareMode }
  | { kind: 'deposit' }
  | { kind: 'cancel' }
  | { kind: 'carry' };

/** ストアが持つ全部（ファン向けの進み ＋ 画面の状態）。 */
export type FanState = Fan & {
  page: Page;
  /** 詳細の画面を開いたとき、どこから来たか（戻るの行き先）。 */
  origin: 'home' | 'more';
  start: StartSel | null;
  pend: Pend | null;
  layers: readonly Layer[];
  ach: AchSpec | null;
  toast: { id: number; text: string } | null;
  /** 読み上げ（aria-live）に伝える一文。 */
  live: string;
  /** 称賛の音のオン・オフ（既定はオン。画面の音ボタン。端末の中だけ）。 */
  soundOn: boolean;
  /** 条件を変えた直後の「引き継いだもの」の記録。 */
  carry: CarrySnap | null;
  /** ✓ が付く動きを待たせる時間（秒）。達成のエフェクトを飛ばしたら 0。 */
  ckDelay: number;
  /** 仲間を呼んでいる最中のゲージの伸び（無ければ null。人数の状態は、伸びたあとに変わる）。 */
  gaugeRun: GaugeRun | null;
  /** 直前の達成の演出で新しく付いた ✓ と、全部そろった印。 */
  fresh: {
    ids: readonly string[];
    all: boolean;
    act: AcctId | null;
    from: Page;
    nonce: number;
  } | null;
};

export type CarrySnap = {
  oshiName: string;
  city: CityName;
  gifts: number;
  doneCount: number;
  doneNames: readonly ActId[];
  called: number;
  deposit: number;
  pay: boolean;
  held: number;
  seatPrice: number;
  /** 引き継いだときの熱量の段階の名前（数字は持たない）。 */
  heatName: string;
  venueName: string;
};

/**
 * ファン向けの初めの値。人物（`?p=1`〜`15`）の番号は、入口として残すが、初めの状態は全員同じ（統括の決定）:
 * 推し ＝ tech0・市 ＝ 久留米市・口座なし（推し活定期をはじめていない）・預金 0円・メイン口座ではない。
 * core の人物のデータ（`src/core/data/personas.ts`。事務所向け・発表者用が使う）は変えず、ファン向けの側で、ここで上書きする。
 */
export function initialFan(_personaNo: number): Fan {
  return {
    oshiId: 'tech0',
    seat: 'normal',
    city: FAN_CITY,
    venueId: FAN_VENUE_ID,
    course: null,
    aim: null,
    friends: 0,
    milestoneShown: false,
    done: {},
    gifts: [false, false, false],
    called: 0,
    lastGift: 'join',
    homeIdx: -1,
    acct: { pay: false, deposit: 0, times: 0 },
    thanksShown: false,
  };
}

export function initialState(personaNo: number): FanState {
  const fan = initialFan(personaNo);
  return {
    ...fan,
    page: 'start',
    origin: 'home',
    start: startSelOf(fan),
    pend: null,
    layers: [],
    ach: null,
    toast: null,
    live: '',
    soundOn: true,
    carry: null,
    ckDelay: 1,
    gaugeRun: null,
    fresh: null,
  };
}

/** はじめの画面の初めの選び（推しは tech0、コースは通常の席）。 */
export function startSelOf(fan: Fan): StartSel {
  return { step: 0, oshiId: fan.oshiId, seat: 'normal', touched: false };
}
