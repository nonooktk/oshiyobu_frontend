import type { ArtistId } from '../../core';
import heisei from '../../assets/img/artist-heisei.webp';
import krs48 from '../../assets/img/artist-krs48.webp';
import rijicho from '../../assets/img/artist-rijicho.webp';
import tech0 from '../../assets/img/artist-tech0.webp';
import terao from '../../assets/img/artist-terao.webp';

// 5 組の名前・頭文字・タイプの説明・丸い絵（出典: モックの DEMO.artists。数値は core が持つ。設計 D-06）。
// 丸い絵の切り抜きは、絵ごとに position（object-position）・zoom・origin（拡大の中心）で決める
export interface ArtistText {
  readonly name: string;
  readonly initial: string;
  readonly type: string;
  readonly img: string;
  readonly crop: { readonly pos?: string; readonly zoom: number; readonly org: string };
}

export const ARTIST_TEXT: Readonly<Record<ArtistId, ArtistText>> = {
  tech0: {
    name: 'Tech0サステナアイドル',
    initial: 'サ',
    type: '熱量も資金も高い',
    img: tech0,
    crop: { zoom: 1.5, org: '52% 0%' },
  },
  krs48: {
    name: 'KRS48',
    initial: 'K',
    type: '人数は多いが熱量が低め',
    img: krs48,
    crop: { zoom: 2, org: '56% 68%' },
  },
  riji: {
    name: 'りじちょーといっしょだよ。',
    initial: 'り',
    type: '人数は少ないが資金がある',
    img: rijicho,
    crop: { zoom: 1.8, org: '18% 0%' },
  },
  terao: {
    name: 'てらお少年',
    initial: 'て',
    type: '熱量は高いが資金が少ない',
    img: terao,
    crop: { zoom: 2.2, org: '50% 13%' },
  },
  heisei: {
    name: '平成の俺',
    initial: '平',
    type: '少人数だが熱量が最高',
    img: heisei,
    crop: { pos: '50% 14%', zoom: 1.5, org: '50% 22%' },
  },
};
