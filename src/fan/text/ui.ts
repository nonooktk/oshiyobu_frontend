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
