// 絵の変換の一覧（設計 D-40）。元絵（assets-src/）から、表示の大きさに合わせた WebP を作る。
// width は出力の幅（元より大きくしない）。maxBytes は、変換後の上限（check-budget が検査する。D-40 の 192 幅 15 KB・768 幅 100 KB・1152 幅 180 KB）
const AVATAR = { width: 192, quality: 78, maxBytes: 15_000 };
const LOGO = { quality: 82, maxBytes: 15_000 };
const BIG = { width: 768, quality: 72, maxBytes: 100_000 };
const WIDE = { width: 1152, quality: 72, maxBytes: 180_000 };

export const IMAGES = [
  // 推しの丸い絵（5 組。表示は約 56px）
  { src: 'artist-tech0.jpg', out: 'artist-tech0.webp', ...AVATAR },
  { src: 'artist-krs48.jpg', out: 'artist-krs48.webp', ...AVATAR },
  { src: 'artist-rijicho.jpg', out: 'artist-rijicho.webp', ...AVATAR },
  { src: 'artist-terao.jpg', out: 'artist-terao.webp', ...AVATAR },
  { src: 'artist-heisei.jpg', out: 'artist-heisei.webp', ...AVATAR },
  // ロゴ（136×48 と 32×32 の、2 倍）
  { src: 'logo-wide.png', out: 'logo-wide.webp', width: 272, ...LOGO },
  { src: 'logo-mark.png', out: 'logo-mark.webp', width: 64, ...LOGO },
  // tech0 の 3 枚は、情報量が多く、品質 72 では 100 KB を超えるため、品質を 62 に下げた（D-40 の「軽くする順」①。幅は 768 のまま）
  // 推しの大きい絵（はじめの画面・ホーム・コースのカード・特典。表示は 375px まで、DPR 2 で 750px）
  { src: 'tech0-full-1.jpg', out: 'tech0-full-1-768.webp', ...BIG, quality: 62 },
  { src: 'tech0-full-2.jpg', out: 'tech0-full-2-768.webp', ...BIG, quality: 58 },
  { src: 'tech0-full-3.jpg', out: 'tech0-full-3-768.webp', ...BIG, quality: 52 },
  { src: 'krs48-full-1.jpg', out: 'krs48-full-768.webp', ...BIG },
  { src: 'rijicho-full-1.jpg', out: 'rijicho-full-768.webp', ...BIG },
  { src: 'terao-full-1.jpg', out: 'terao-full-768.webp', ...BIG },
  // 特典の絵（1 枚を切り抜いて 3 段階に見せるので、拡大に耐える大きさ。tech0 は 3 枚あるので作らない）
  { src: 'krs48-full-1.jpg', out: 'krs48-full-1152.webp', ...WIDE },
  { src: 'rijicho-full-1.jpg', out: 'rijicho-full-1152.webp', ...WIDE },
  { src: 'terao-full-1.jpg', out: 'terao-full-1152.webp', ...WIDE },
  // 平成の俺は、元絵が小さい（384×480）ので、元の大きさのまま WebP にする
  { src: 'artist-heisei.jpg', out: 'heisei-full.webp', quality: 72, maxBytes: 40_000 },
];
