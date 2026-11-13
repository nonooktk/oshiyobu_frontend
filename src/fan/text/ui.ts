// 画面の言葉（決まった言い方。仕様「文言」・SP-45）。使わない語は書かない（文言ガードが検査する）。
import type { ActId } from '../domain/state';

/** 達成した行動 6 つの名前。 */
export const ACT_NAMES: Record<ActId, string> = {
  join: '申し込んだ',
  share: 'SNSで広めた',
  friend: '仲間が申し込んだ',
  main: 'メイン口座にした',
  deposit: '預金を積み増した',
  teiki: '推し活定期をはじめた',
};

/** メニュー配下の画面の見出し。 */
export const PAGE_TITLES = {
  more: 'メニュー',
  menu: '応援コース',
  acct: '口座と預金',
  contrib: '貢献',
  area: '支援の状況',
  how: 'しくみ',
  opt: '推し・条件の変更',
  priv: '情報の扱い',
  next: '次のアクション',
} as const;

/** 特典を開く 3 つの行動の札（貢献の画面）。 */
export const GIFT_LABELS = ['申し込む', 'SNSで広める', '仲間が申し込む'] as const;
