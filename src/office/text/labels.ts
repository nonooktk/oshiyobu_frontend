import { MAX_COST_YEN } from '../../core';
import type { CostItemId, ParseResult } from '../../core';

// 事務所向けの画面の文言（出典: モック index.html と 文言の校正.md。決まった言い方は仕様の「文言」）。
// 決まった言い方・使わない語は、仕様 SP-81。ここを直すときは、tests/unit/forbidden-words.test.ts の語を使わない

export const COST_LABELS: Readonly<Record<CostItemId, string>> = {
  venue: '会場費',
  prod: '制作費',
  fee: '出演料',
  travel: '移動・宿泊',
  profit: 'アーティストの利益',
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
  simulator: '収支シミュレーター',
  simulatorNone: 'この会場は、収支シミュレーターにありません',
  privacy: '情報の扱い',
  resetAll: 'デモを最初に戻す',
  resetOffice: '事務所向けだけ戻す',
  resetAllDone: '最初に戻しました',
  resetOfficeDone: '事務所向けを最初に戻しました',
  close: '閉じる',
  adjust: '条件を調整',
  adjustHint: '費用は仮の金額です。会場の公開料金とは別です。',
  minLabel: '最低人数',
  proposal: '提案を見る',
  proposalNg: 'この条件では提案できません',
  judge1: '開催条件',
  judge2: '満たせるか',
  judge3: '熱量と資金',
  lineLabel: '到達ライン',
  ruleLabel: '成立の条件',
  minNote:
    '最低人数は、事務所と相談して決める値です。上位コースの金額は、金額の条件に数えます（人数は 1 人ぶん）。',
  upliftLabel: '上位のコースによる上乗せ',
  legendExpected: '払える熱いファン',
  legendNeed: '必要',
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
export const needText = (n: number): string => `必要 ${n}人`;

export function sideNote(isHome: boolean, reach: boolean): readonly [string, string] {
  return [
    isHome
      ? '空き日は架空です。料金は公式サイトの公開情報にもとづく目安です（2026-11-12 確認）。'
      : '空き日は架空です。会場名・キャパは会場データ（実在・公演の記録あり）にもとづきます。',
    reach
      ? '候補は最大3件です。Tech0サステナアイドルの見込みが必要人数に届く会場だけを出しています。'
      : 'この市には、見込みが必要人数に届く会場がありません。必要人数が見込みに最も近い1件だけを出しています。',
  ];
}
