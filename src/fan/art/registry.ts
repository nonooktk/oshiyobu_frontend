// 推しの絵の置き場（1 か所）。絵の部品は、ここの ArtistView を見て描く。
// 【仮】いまは元絵（`assets-src/`）をそのまま使う。縮めた版（幅 192・768・1152 の WebP）は F-3 が作る。
// 差し替えるときは、このファイルの import だけを替える（絵の部品は、読めないときの代わりの表示を自分で持つ）。
import type { ArtistId, CourseId } from '../../core';
import circleHeisei from '../../../assets-src/artist-heisei.jpg';
import circleKrs48 from '../../../assets-src/artist-krs48.jpg';
import circleRiji from '../../../assets-src/artist-rijicho.jpg';
import circleTech0 from '../../../assets-src/artist-tech0.jpg';
import circleTerao from '../../../assets-src/artist-terao.jpg';
import fullKrs48 from '../../../assets-src/krs48-full-1.jpg';
import fullRiji from '../../../assets-src/rijicho-full-1.jpg';
import fullTech01 from '../../../assets-src/tech0-full-1.jpg';
import fullTech02 from '../../../assets-src/tech0-full-2.jpg';
import fullTech03 from '../../../assets-src/tech0-full-3.jpg';
import fullTerao from '../../../assets-src/terao-full-1.jpg';

/** 切り抜き。pos＝object-position、zoom＝拡大、org＝拡大の中心。顔が切れないよう、絵ごとに決める。 */
export type Crop = { pos?: string; zoom?: number; org?: string };
export type CardArt = { src: string; crop: Crop };

/** 特典の絵の切り抜き（Tech0 以外の 4 組。1 枚の絵の切り抜きを広げる）。ar＝絵の横÷縦。c1・c2＝1・2 段目で枠の真ん中に置く場所。 */
export type Cutout = { ar: number; c1: [number, number]; c2: [number, number]; s2?: number };

export type ArtistView = {
  id: ArtistId;
  name: string;
  /** 絵が読めないときの代わりの文字（頭文字の丸）。 */
  initial: string;
  /** 丸い小さな絵。 */
  circle: CardArt;
  /** 大きな絵。imgs があれば、特典の 1・2・3 段目がその 3 枚。img だけなら、その 1 枚を切り抜いて広げる。 */
  art: { imgs?: readonly string[]; img?: string };
  cards: Record<CourseId, CardArt>;
  cut?: Cutout;
};

export const ARTISTS_VIEW: Record<ArtistId, ArtistView> = {
  tech0: {
    id: 'tech0',
    name: 'Tech0サステナアイドル',
    initial: 'サ',
    circle: { src: circleTech0, crop: { zoom: 1.5, org: '52% 0%' } },
    art: { imgs: [fullTech01, fullTech02, fullTech03] },
    cards: {
      normal: { src: fullTech01, crop: { pos: '50% 0%' } },
      front: { src: fullTech02, crop: { pos: '50% 12%' } },
      special: { src: fullTech03, crop: { pos: '50% 45%', zoom: 1.7, org: '100% 0%' } },
      top: { src: fullTech01, crop: { pos: '50% 0%', zoom: 2, org: '88% 0%' } },
    },
  },
  krs48: {
    id: 'krs48',
    name: 'KRS48',
    initial: 'K',
    circle: { src: circleKrs48, crop: { zoom: 2, org: '56% 68%' } },
    art: { img: fullKrs48 },
    cards: {
      normal: { src: fullKrs48, crop: { pos: '50% 0%' } },
      front: { src: fullKrs48, crop: { pos: '50% 100%', zoom: 2.4, org: '51% 60%' } },
      special: { src: fullKrs48, crop: { pos: '50% 30%', zoom: 2.1, org: '30% 48%' } },
      top: { src: fullKrs48, crop: { pos: '50% 100%', zoom: 1.4, org: '50% 90%' } },
    },
    cut: { ar: 1536 / 1024, c1: [0.51, 0.64], c2: [0.5, 0.62] },
  },
  riji: {
    id: 'riji',
    name: 'りじちょーといっしょだよ。',
    initial: 'り',
    circle: { src: circleRiji, crop: { zoom: 1.8, org: '18% 0%' } },
    art: { img: fullRiji },
    cards: {
      normal: { src: fullRiji, crop: { pos: '50% 3%' } },
      front: { src: fullRiji, crop: { pos: '50% 3%', zoom: 2.1, org: '36% 0%' } },
      special: { src: fullRiji, crop: { pos: '50% 3%', zoom: 2, org: '100% 0%' } },
      top: { src: fullRiji, crop: { pos: '50% 12%', zoom: 1.3, org: '100% 0%' } },
    },
    cut: { ar: 1536 / 1024, c1: [0.47, 0.29], c2: [0.56, 0.42] },
  },
  terao: {
    id: 'terao',
    name: 'てらお少年',
    initial: 'て',
    circle: { src: circleTerao, crop: { zoom: 2.2, org: '50% 13%' } },
    art: { img: fullTerao },
    cards: {
      normal: { src: fullTerao, crop: { pos: '50% 0%' } },
      front: { src: fullTerao, crop: { pos: '50% 8%', zoom: 2.2, org: '0% 22%' } },
      special: { src: fullTerao, crop: { pos: '50% 0%', zoom: 2, org: '80% 22%' } },
      top: { src: fullTerao, crop: { pos: '50% 0%', zoom: 2, org: '24% 22%' } },
    },
    cut: { ar: 1536 / 1024, c1: [0.5, 0.29], c2: [0.52, 0.42], s2: 1.45 },
  },
  heisei: {
    id: 'heisei',
    name: '平成の俺',
    initial: '平',
    circle: { src: circleHeisei, crop: { pos: '50% 14%', zoom: 1.5, org: '50% 22%' } },
    art: { img: circleHeisei },
    cards: {
      normal: { src: circleHeisei, crop: { pos: '50% 8%' } },
      front: { src: circleHeisei, crop: { pos: '50% 20%', zoom: 1.3, org: '35% 25%' } },
      special: { src: circleHeisei, crop: { pos: '88% 82%', zoom: 1.4, org: '85% 0%' } },
      top: { src: circleHeisei, crop: { pos: '50% 100%' } },
    },
    cut: { ar: 384 / 480, c1: [0.45, 0.31], c2: [0.5, 0.5] },
  },
};

export const artistView = (id: ArtistId): ArtistView => ARTISTS_VIEW[id];

/** 特典の絵（idx＝開いた特典の数 − 1）の元の絵。大きい絵が 3 枚の組は、その idx 枚目。 */
export function giftSources(
  a: ArtistView,
  idx: number,
): { whole: string | null; cutout: string | null } {
  if (a.art.imgs) {
    const imgs = a.art.imgs;
    return { whole: imgs[Math.min(idx, imgs.length - 1)] ?? null, cutout: null };
  }
  if (idx >= 2) return { whole: a.art.img ?? null, cutout: null };
  return { whole: null, cutout: a.art.img ?? null };
}

/** 1 枚の絵の切り抜きを、枠の縦横比 q に合わせて広げる（1 段目は顔まわり、2 段目は 2 人分）。 */
export function cutoutStyle(
  a: ArtistView,
  idx: number,
  q: number,
): { width: string; transform: string } {
  const cut = a.cut ?? {
    ar: 1.5,
    c1: [0.5, 0.4] as [number, number],
    c2: [0.5, 0.5] as [number, number],
  };
  const cover = Math.max(1, cut.ar / q);
  const contain = Math.min(1, cut.ar / q);
  const s = idx <= 0 ? Math.max(2.4, cover) : Math.max(cut.s2 ?? 1.6, (cover + contain) / 2);
  const [cx, cy] = idx <= 0 ? cut.c1 : cut.c2;
  return {
    width: `${(s * 100).toFixed(1)}%`,
    transform: `translate(${(-cx * 100).toFixed(1)}%,${(-cy * 100).toFixed(1)}%)`,
  };
}

/** 全体を見せたいところ（応援コースの上の絵）の段。大きい絵が 3 枚の組は 1 枚目、1 枚の組は全体（3 段目）。 */
export const publicIdx = (a: ArtistView): number => (a.art.imgs ? 0 : 2);

/** 先読みの絵の登録（共有の部品 `configurePrefetch` に渡す）。絵の ID は、絵のファイルの URL そのもの。 */
export const PREFETCH_IMAGES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(ARTISTS_VIEW)
    .flatMap((a) => [a.circle.src, ...(a.art.imgs ?? []), ...(a.art.img ? [a.art.img] : [])])
    .map((url) => [url, url]),
);

/**
 * 推しごとの先読みの順（必要になる順。設計 D-40）。最初の画面で読む絵は含めない。
 * 【仮】いまは元絵 1 枚ずつ。縮めた版（幅 1152 など）が入ったら（F-3）、ここに足す。
 */
export const PREFETCH_PLAN: Readonly<Partial<Record<ArtistId, readonly string[]>>> = {
  tech0: (ARTISTS_VIEW.tech0.art.imgs ?? []).slice(1),
};
