// 投稿文（SP-31）。人物の番号・預金額・口座は入れない。URL も入れない（実際には投稿しないデモで、仮の URL を見せないため）。
import type { FanView } from './view';
import { artistView } from '../art/registry';

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
