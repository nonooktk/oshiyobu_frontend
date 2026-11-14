// 共有のボタンと投稿文（SP-31）。人物の番号・預金額・口座は入れない。URL も入れない（実際には投稿しないデモで、仮の URL を見せないため）。
import type { FanView } from './view';
import { artistView } from '../art/registry';

/** 共有のボタンの名前。押すと、外へ出ず、その名前で「投稿した」ことになる。 */
export const SHARE_NAMES = { x: 'X', ig: 'Instagram', fb: 'Facebook' } as const;
export type ShareChannel = keyof typeof SHARE_NAMES;
/** シートに並べる順。 */
export const SHARE_ORDER: readonly ShareChannel[] = ['x', 'ig', 'fb'];

/** 押した直後に出す文（トーストと読み上げ）。デモなので、実際には投稿しない。 */
export const postedText = (ch: ShareChannel): string =>
  `${SHARE_NAMES[ch]}に投稿しました（デモ・未投稿）`;

export function buildPostText(v: FanView): string {
  const s = v.status;
  const tail = s.established
    ? 'ライブの開催が決まりました！'
    : s.gathered
      ? '人数は集まりました。あと少しで開催が決まります。'
      : `ライブ開催まであと${s.left}人です。`;
  const name = artistView(v.fan.oshiId).name;
  return `${name}を${v.cond.city}に呼びたい！ いま${s.pct}%まで来ています。${tail}いっしょに応援してください！ #OSHIYOBU`;
}
