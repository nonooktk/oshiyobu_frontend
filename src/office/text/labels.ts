import { MAX_COST_YEN } from '../../core';
import type { CostItemId, ParseResult } from '../../core';
import type { AdjustId } from '../adjust';
import type { ChangeKey, Snapshot } from '../view';

// 事務所向けの画面の文言（出典: モック index.html と 文言の校正.md。決まった言い方は仕様の「文言」）。
// 決まった言い方・使わない語は、仕様 SP-81。ここを直すときは、tests/unit/forbidden-words.test.ts の語を使わない

export const COST_LABELS: Readonly<Record<CostItemId, string>> = {
  venue: '会場費',
  prod: '制作費',
  fee: '出演料',
  travel: '移動・宿泊',
  profit: 'アーティストの利益',
};

/**
 * ⑤「条件を調整」の入力の名前（2026-11-20。N-13・Issue #53。収支シミュレーターの「1 数字」と同じ項目）。
 * 提案の 1 枚の内訳は、COST_LABELS（core の 5 項目）のまま
 */
export const ADJUST_LABELS: Readonly<Record<AdjustId, string>> = {
  venue: '会場費',
  prod: '制作費',
  travel: '移動・宿泊',
  hope: '利益',
};

export const yen = (n: number): string => `${n.toLocaleString('ja-JP')}円`;

export const text = {
  pageTitle: '事務所向け',
  artistLabel: 'アーティスト',
  metricGroup: '地図の指標',
  metricReg: '人数',
  metricHot: '払える熱量',
  formula: '＝ 熱量 × 預金額',
  mapTitle:
    '九州の簡略地図。丸の大きさは登録者数、濃さは選んだ指標を表します。9つの市の丸を押すと、その市を選べます。',
  legendTitle: '面積＝登録者数',
  emptyHead: '市を選ぶ',
  emptyBody: '地図の丸を押す',
  /** ① の見出し（すでに使っている「地図」だけ） */
  mapHead: '地図',
  /** ① の地図の横の、市の一覧の見出し（数字は core の demandOf(推し, 市).expected） */
  rankHead: '預金の支えがある熱いファン（見込み）',
  /** 「人数」のときの、市の一覧の見出し（行に出すのは登録の人数だけ。2026-11-20。N5-3） */
  rankHeadReg: '登録の人数',
  /** 一覧の見出しに添える札（地図の枠の札が一覧まで届いて見えないため。全画面の札の文は使わない） */
  rankFict: '数字は架空',
  /** 一覧の行の読み上げで、見込みの数字の前に置く語 */
  rankExpected: '見込み',
  /** 一覧の行の、登録者数の前に置く語 */
  rankReg: '登録',
  /** 見込みが登録の何 % か（M-01。割合は share.ts の shareOfReg）。一覧の行と、⑥ の需要の出どころの行に出す */
  shareOfReg: (share: string): string => `登録の ${share}`,
  /** 会場を選ぶ前の、右の列の案内（判定は会場を選ぶまで出ない。I-01） */
  pickVenue: '会場を選ぶ',
  simulator: '収支シミュレーター',
  simulatorNone: 'この会場は、収支シミュレーターにありません',
  privacy: '情報の扱い',
  resetAll: 'デモを最初に戻す',
  resetOffice: '事務所向けだけ戻す',
  resetAllDone: '最初に戻しました',
  resetOfficeDone: '事務所向けを最初に戻しました',
  close: '閉じる',
  adjust: '条件を調整',
  /** 「条件を調整」の組の見出し（シミュレーターの「経費」の「経」は、事務所向けの書体に無いので「費用」。N-13） */
  adjustCostGroup: '費用',
  adjustHopeGroup: '利益',
  /** 利益の欄の添え書き（シミュレーターと同じ意味。事務所向けの呼び方の「到達ライン」にした。N-13） */
  adjustHopeNote: '到達ラインちょうど集まったとき、全体利益がこの額になります',
  minLabel: '最低人数',
  proposal: '提案を見る',
  proposalNg: 'この条件では提案できません',
  judge1: '開催条件',
  judge2: '満たせるか',
  judge3: '熱量と資金',
  lineLabel: '到達ライン',
  /** ⑤ の 1 行目、到達ラインの金額のあと（M-07）。「650,000円で開催できます」 */
  lineCan: 'で開催できます',
  ruleLabel: '成立の条件',
  upliftLabel: '上位のコースによる上乗せ',
  hotRichLabel: '熱量が高く、資金もある',
  deadlineLabel: '募集期限',
  proposalKick: 'ご提案',
  proposalRule: '成立したら開催。成立しなければ費用は発生しません。',
  proposalClose: 'All-or-Nothing でやりましょう',
  costBreakdown: '到達ラインの内訳',
  total: '合計',
  privItems: '保存している項目（いまの内容）',
  privWhere: '保存先',
  privWhereBody:
    'この端末の中だけです。事務所向けは、何も送りません（送る仕組みもありません）。このデモは、画面を開いているあいだだけ覚えていて、再読み込みで最初の状態に戻ります。氏名・口座番号・ログイン情報・位置情報は、入力欄も保存場所もありません。',
  privReset: '最初の状態に戻す方法',
  privResetBody:
    '「デモを最初に戻す」を押すと、この端末の中の記録（選んだ内容・費用の入力値・ファン向けの記録）がすべて最初の状態に戻ります。画面を閉じたり再読み込みしたりしても、最初の状態に戻ります。',
  privResetNote:
    '「事務所向けだけ戻す」は、事務所向けの記録だけを戻します（ファン向けは変わりません）。',
  privFig: '図: 選んだ内容はこの端末の中だけに置き、外の仕組みには送らない',
  none: '（まだ選んでいません）',
  noneCost: '（会場を選ぶと入ります）',
} as const;

/** 4 象限の名前（要件 R-11。仕様 3.2 の案）。並びは、図の左上・右上・左下・右下 */
export const QUAD_ORDER = ['hotPoor', 'hotRich', 'coolPoor', 'coolRich'] as const;
/** 図の横に縦 1 列で並べるときの順（いま呼べる → 熱いが資金が足りない → 資金はあるが熱が低い → どちらも低い） */
export const QUAD_STACK = ['hotRich', 'hotPoor', 'coolRich', 'coolPoor'] as const;
export const QUAD_NAMES: Readonly<Record<(typeof QUAD_ORDER)[number], string>> = {
  hotRich: 'いま呼べる',
  hotPoor: '熱いが資金が足りない',
  coolRich: '資金はあるが熱が低い',
  coolPoor: 'どちらも低い',
};

/**
 * 4 象限の線を動かす操作（要件 R-12）。画面には、すでに使っている語だけを出す（軸の名前・「初めの位置に戻す」・「目安（デモ）」）。
 * 3 ページの書体に無い字（境・区・線・象・判・札など）を使わない（G-11・確認 5）。
 */
export const quadLineText = {
  deposit: '預金額',
  heat: '熱量',
  reset: '初めの位置に戻す',
  estimate: '目安（デモ）',
} as const;

export const depositText = (man: number): string => `${man}万円`;
export const heatText = (heat: number): string => String(heat);
const lineValueText = (what: 'deposit' | 'heat', value: number): string =>
  what === 'deposit' ? depositText(value) : heatText(value);
export const quadLineLive = (what: 'deposit' | 'heat', value: number, hotRich: number): string =>
  `${quadLineText[what]}を ${lineValueText(what, value)}にしました。${QUAD_NAMES.hotRich}: 約 ${hotRich}人（${quadLineText.estimate}）。`;
export const quadLineResetLive = '初めの位置に戻しました。';
/** 図や情報の扱いに出す、いまの線の位置（例: 預金額 25万円・熱量 3.5） */
export const quadLineValues = (deposit: number, heat: number): string =>
  `${quadLineText.deposit} ${depositText(deposit)}・${quadLineText.heat} ${heatText(heat)}`;
export const privQuadLine = (deposit: number, heat: number): string =>
  `${text.judge3}: ${quadLineValues(deposit, heat)}`;

/**
 * 変わった数字の、前の値（要件 R-14。仕様 2.2）。例: 「前 187人（−67）」「前 650,000円（+50,000）」「前 高」。
 * 増えたか減ったかは、色に頼らず、「+」「−」付きの差で示す（「▲」「▼」「減」は 3 ページの書体に無い。G-11）
 */
export function prevText(
  prev: number | string,
  now: number | string,
  unit: '' | '人' | '円',
): string {
  if (typeof prev !== 'number' || typeof now !== 'number') return `前 ${prev}`;
  const diff = now - prev;
  const sign = diff > 0 ? '+' : '−';
  return `前 ${prev.toLocaleString('ja-JP')}${unit}（${sign}${Math.abs(diff).toLocaleString('ja-JP')}）`;
}
/** 4 象限のカードに出す、短い差（例: 「−49」）。カードの幅が狭いので、前の値は読み上げにだけ入れる */
export function diffText(prev: number | string, now: number | string): string {
  if (typeof prev !== 'number' || typeof now !== 'number') return '';
  const diff = now - prev;
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('ja-JP')}`;
}

/** 変わった数字の読み上げで使う名前と単位（画面の見出しと同じ語） */
const CHANGE_LABELS: Readonly<Record<ChangeKey, readonly [string, '' | '人' | '円']>> = {
  expected: ['見込み', '人'],
  level: ['成立の見込み', ''],
  shortfall: ['足りない人数', '人'],
  line: [text.lineLabel, '円'],
  need: ['必要人数', '人'],
  price: ['通常の席の価格', '円'],
  upliftTotal: [text.upliftLabel, '円'],
  quadHotRich: [QUAD_NAMES.hotRich, '人'],
  quadHotPoor: [QUAD_NAMES.hotPoor, '人'],
  quadCoolRich: [QUAD_NAMES.coolRich, '人'],
  quadCoolPoor: [QUAD_NAMES.coolPoor, '人'],
};

/** 変わった数字の読み上げ（要件 R-14。仕様 2.2）。例: 「見込み 187人から 120人。成立の見込み 高から中。」 */
export function changeLiveText(
  keys: readonly ChangeKey[],
  prev: Snapshot | null,
  now: Snapshot | null,
): string {
  if (prev === null || now === null) return '';
  const fmt = (v: number | string, unit: string) =>
    typeof v === 'number' ? `${v.toLocaleString('ja-JP')}${unit}` : v;
  return keys
    .map((key) => {
      const [label, unit] = CHANGE_LABELS[key];
      return `${label} ${fmt(prev[key], unit)}から ${fmt(now[key], unit)}。`;
    })
    .join('');
}

export const capChip = (need: number, cap: number, unit: string): string =>
  need <= cap ? `キャパ ${cap}${unit}に収まる` : `キャパ ${cap}${unit}を超える`;

export const ruleText = (line: number, min: number) => ({
  before: '支援の合計が到達ライン（',
  line: yen(line),
  middle: '）以上、かつ、支援者が最低人数（',
  min: `${min}人`,
  after: '）以上で成立',
});

export const warnText = (gapYen: number): string =>
  `通常の席だけだと、最低人数に届いても金額が足りません（あと ${yen(gapYen)}ぶんは上位コースなどで補う必要があります）`;

export const minHelp = (need: number, cap: number, unit: string): string =>
  `事務所と相談して決める値です。初めは計算の値（到達ライン ÷ 通常の席の価格を切り上げた ${need}人）。1人以上、会場のキャパ（${cap}${unit}）以下で入れます`;

export const minResetLabel = (need: number): string => `計算の値に戻す（${need}人）`;

/** 最低人数の入力が受けられないときの理由（文言は frontend。core は理由の種類を返す） */
export function minErrorText(result: ParseResult, cap: number, unit: string): string | null {
  if (result.ok || result.reason === 'blank') return null;
  if (result.reason === 'invalid_format') {
    return `「${result.input}」は使えません。1〜${cap}の整数で入れてください（会場のキャパ ${cap}${unit}まで）`;
  }
  if (result.reason === 'out_of_range') {
    return `${result.value}人は範囲の外です。1人以上、${cap}人以下（会場のキャパ ${cap}${unit}）で入れてください`;
  }
  return `「${result.input}」は大きすぎます。1〜${cap}の整数で入れてください`;
}

/** 費用の入力が受けられないときの理由。空欄は 0 円にせず、直させる（決定 13） */
export function costErrorText(result: ParseResult, label: string): string | null {
  if (result.ok) return null;
  if (result.reason === 'blank') {
    return `${label}が空です。0以上の整数で入れてください（0円も入れられます）`;
  }
  if (result.reason === 'invalid_format') {
    return `「${result.input}」は使えません。0以上の整数で入れてください`;
  }
  if (result.reason === 'too_large') {
    return `金額が大きすぎます（${MAX_COST_YEN.toLocaleString('ja-JP')}円まで）`;
  }
  return `${label}に使えない値です`;
}

export const verdictText = (level: string): string => `成立の見込み ${level}`;
export const shortText = (need: number, shortfall: number): string =>
  `必要 ${need}人に届かない（あと ${shortfall}人）`;
export const expectedText = (n: number): string => `見込み ${n}人`;

// ③ 会場の候補の下の注記（sideNote）は、2026-11-18 に外した（docs/office/要件.md の M-04）

/** 実在と架空の見分け（要件 R-16・仕様 4.3）。③④ の実在の情報と、①⑤⑥ の架空の数字に付ける札と文言 */
export const realText = {
  /** ③④ の見出しの横の札。確認日は、出しているデータの確認日（いちばん新しい日） */
  chip: (checkedOn: string): string => `実在の公開情報（出典あり・確認日 ${checkedOn}）`,
  /** ①⑤⑥ の見出しの横の札（「デモ用の架空データ」の文は、全画面の札の 1 回だけにする。I-101） */
  fiction: '架空（デモ用）',
  /** ⑤ に添える一文（実在の会場に、架空の費用と見込みを重ねる所） */
  mixNote: '会場の名前は実在・数字は架空',
  source: '出典',
  newTab: '（新しいタブで開きます）',
  pastHead: 'これまでの公演',
  noEvents: '記録は、まだありません',
  pickVenueFirst: '会場を選ぶと出ます',
} as const;

/** 公演の日（YYYY-MM-DD）を「2026年8月8日」の形にする（「日付」の「付」は書体に無いので、見出しの語は付けない） */
export function eventDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 条件の帯（要件 R-15）。推し以外の条件（集まる人数・境目・費用と最低人数）を、1 か所にまとめる */
export const bandText = {
  /** 帯の左の札（「アーティスト」と同じ形） */
  label: '条件',
} as const;

/** ② 集まる人数（要件 R-04・R-06）。会場の候補を、キャパが人数に近い会場から出すことにだけ使う（確認 8） */
export const crowdText = {
  label: '集まる人数',
  unit: '人',
  /** よく使う値のボタン（収支シミュレーターと同じ値。仕様 1.4） */
  presets: [30, 100, 300, 500, 1000] as const,
  live: (n: number): string =>
    `集まる人数を ${n}人にしました。会場の候補を、キャパが近い会場から出しています。`,
  clearLive: '集まる人数の指定をやめました。',
  /** 規模感（キャパ ÷ 人数）。「ちょうど良い」のような判定はしない（core に基準が無いため。仕様 1.4） */
  ratio: (cap: number, crowd: number): string =>
    `キャパ ${cap} ÷ ${crowd}人 = ${(cap / crowd).toFixed(2)}`,
} as const;

/** ⑥ の凡例の下の、需要の出どころ（要件 R-03）。数字は core の値のまま（区切りだけ付ける）。
    並べると「久留米市の登録 1,380人 → 預金の支えがある熱いファン（見込み） 187人」 */
export function demandSource(
  city: string,
  reg: number,
  expected: number,
): {
  readonly lead: string;
  readonly reg: string;
  readonly mid: string;
  readonly expected: string;
} {
  const people = (n: number): string => `${n.toLocaleString('ja-JP')}人`;
  return {
    lead: `${city}の登録`,
    reg: people(reg),
    mid: `→ ${text.rankHead}`,
    expected: people(expected),
  };
}
