// ファン向けの状態の型と、初めの値（端末の中だけ。再読み込みで初めに戻る。設計 D-10）。
import { defaultVenueIdOf, personaByNo, personaVenueId } from '../../core';
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

export type ShareMode = 'friend' | 'share' | 'notice';

/** 端末の中の、ファン向けの進み（SP「端末の中の状態」）。 */
export type Fan = {
  oshiId: ArtistId;
  /** 希望のコース。申し込んだコースとは別（「推し・条件の変更」で選ぶ）。 */
  seat: CourseId;
  city: CityName;
  venueId: VenueId;
  /** ファンの選択を優先中か（事務所向けより優先）。 */
  custom: boolean;
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

/** はじめの画面の、選んでいる最中の値。 */
export type StartSel = {
  step: 0 | 1 | 2;
  oshiId: ArtistId;
  city: CityName;
  seat: CourseId;
  /** 初めの市（これと違う市を選ぶと、ファンの選択を優先する）。 */
  baseCity: CityName;
  /** 利用者が、推し・市・コースのどれかを選び直したか（事務所向けとの連動で、初めの値を取り替えてよいかの判断）。 */
  touched: boolean;
};

/** 「推し・条件の変更」の、選んでいる最中の値。 */
export type Pend = { oshiId: ArtistId; city: CityName; seat: CourseId };

/** 80% の演出・特典の演出などの、全画面の演出。 */
export type FxSpec = {
  id: number;
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

/** 条件の達成のエフェクト（操作を止めない・押すと消える）。 */
export type AchSpec = {
  id: number;
  kind: 'one' | 'all';
  title: string;
  title2?: string;
  small?: string;
  sub: string;
  ms: number;
  flash: boolean;
  confetti: readonly Confetto[];
};

export type Layer =
  | { kind: 'fx'; fx: FxSpec }
  | { kind: 'gift'; replay: boolean }
  | { kind: 'thanks' }
  | { kind: 'share'; mode: ShareMode }
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

/** 人物（番号）の初めの値でファン向けを作る。 */
export function initialFan(personaNo: number): Fan {
  const persona = personaByNo(personaNo);
  return {
    oshiId: persona.artistId,
    seat: 'normal',
    city: persona.city,
    venueId: personaVenueId(persona),
    custom: false,
    course: null,
    aim: null,
    friends: 0,
    milestoneShown: false,
    done: {},
    gifts: [false, false, false],
    called: 0,
    lastGift: 'join',
    homeIdx: -1,
    acct: { pay: persona.mainAccount, deposit: persona.depositYen, times: 0 },
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
    fresh: null,
  };
}

/** はじめの画面の初めの選び（推し・市は人物の値、コースは通常の席）。 */
export function startSelOf(fan: Fan): StartSel {
  return {
    step: 0,
    oshiId: fan.oshiId,
    city: fan.city,
    seat: 'normal',
    baseCity: fan.city,
    touched: false,
  };
}

/** 市を選び直したときの会場（久留米市は Cボックス、ほかは tech0 の見込みにキャパが最も近い 1 件。SP-49）。 */
export const venueOfCity = (city: CityName): VenueId => defaultVenueIdOf(city);

/** いま出している市を選んだままなら、いまの会場のまま（事務所向けと連動した会場を、勝手に替えない）。市が替わったら、その市の会場。 */
export const venueForCity = (fan: Pick<Fan, 'city' | 'venueId'>, city: CityName): VenueId =>
  city === fan.city ? fan.venueId : venueOfCity(city);
