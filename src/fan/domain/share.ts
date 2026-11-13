// 投稿文と共有の URL（SP-31）。ページの URL と個人の情報（人物の番号・預金額・口座）は入れない。
import type { FanView } from './view';
import { artistView } from '../art/registry';

/**
 * 本番の公開 URL（人物の番号を付けない。決定 18）。定数 1 か所。
 * 【仮】公開 URL は 11/18 の承認のあとに決まる（SP-84）。決まるまでは、この値を差し替える。
 */
export const PUBLIC_URL = 'https://oshiyobu.example.test/fan/';

export function buildPostText(v: FanView): string {
  const s = v.status;
  const tail = s.established
    ? 'ライブの開催が決まりました！'
    : s.gathered
      ? '人数は集まりました。あと少しで開催が決まります。'
      : `ライブ開催まであと${s.left}人です。`;
  const name = artistView(v.fan.oshiId).name;
  return `${name}を${v.cond.city}に呼びたい！ いま${s.pct}%まで来ています。${tail}いっしょに応援してください！ #OSHIYOBU\n${PUBLIC_URL}`;
}

export const shareUrlX = (text: string): string =>
  `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

export const shareUrlFacebook = (text: string): string =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PUBLIC_URL)}&quote=${encodeURIComponent(text)}`;
