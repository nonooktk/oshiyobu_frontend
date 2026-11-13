// 推しの絵の部品。絵が読めないとき・まだ届かないときの、代わりの表示を持つ（設計 D-40）:
// 読み済みの絵 → 丸い絵（ぼかし）→ 頭文字。空白の枠・壊れた画像の印は出さない。
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { cutoutStyle, giftSources } from '../art/registry';
import type { ArtistView, CardArt, Crop } from '../art/registry';
import { needImage, useImageState } from '../../shared/prefetch';
import styles from '../fan.module.css';

/** 画面に出して、読み終えた絵（最初の画面・ホームの絵）。特典の絵が届くまでの、代わりの表示に使う。 */
const shown = new Set<string>();
const shownListeners = new Set<() => void>();
function markLoaded(url: string): void {
  if (shown.has(url)) return;
  shown.add(url);
  shownListeners.forEach((listener) => listener());
}
function useShown(url: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      shownListeners.add(listener);
      return () => {
        shownListeners.delete(listener);
      };
    },
    () => shown.has(url),
  );
}

const cropStyle = (c: Crop): CSSProperties =>
  ({
    '--pos': c.pos ?? '50% 50%',
    '--zoom': c.zoom ?? 1,
    '--org': c.org ?? '50% 50%',
  }) as CSSProperties;

/** 絵の丸。頭文字を下に敷き、絵（装飾なので alt は空）を上に重ねる。絵が読めないときは頭文字が見える。 */
export function Av({ a, className }: { a: ArtistView; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={className ? `${styles.av} ${className}` : styles.av} aria-hidden="true">
      {a.initial}
      {broken ? null : (
        <img
          src={a.circle.src}
          alt=""
          style={cropStyle(a.circle.crop)}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}

/** コースのカードの絵（枠いっぱいの切り抜き）。 */
export function CardPic({ art }: { art: CardArt }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className={styles.rcPic} aria-hidden="true" />;
  return (
    <span className={styles.rcPic} aria-hidden="true">
      <img
        className={styles.cropImg}
        src={art.src}
        alt=""
        style={cropStyle(art.crop)}
        onError={() => setBroken(true)}
      />
    </span>
  );
}

/** 全体を切らずに見せる絵（縦横比が違う分は、同じ絵のぼかしが埋める）。 */
export function WholeArt({ src, alt, a }: { src: string; alt: string; a: ArtistView }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={styles.artBox}>
      {broken ? (
        <Fallback a={a} />
      ) : (
        <>
          <img className={styles.artBg} src={src} alt="" onError={() => setBroken(true)} />
          <img
            className={styles.artWhole}
            src={src}
            alt={alt}
            onLoad={() => markLoaded(src)}
            onError={() => setBroken(true)}
          />
        </>
      )}
    </div>
  );
}

function Fallback({ a }: { a: ArtistView }) {
  return (
    <div className={styles.artFallback} aria-hidden="true">
      <img src={a.circle.src} alt="" />
      <span>{a.initial}</span>
    </div>
  );
}

/**
 * 特典の絵（idx＝開いた特典の数 − 1）。本来の絵を高い優先度で読み、届くまでは代わりの表示を出す。
 * 代わりの表示の順（設計 D-40）: 読み済みの幅 768 の絵（切り抜きの段のまま。ぼやける）→ 丸い絵のぼかし → 頭文字。
 * 空白の枠・壊れた画像の印は出さない。届いたら、その場で差し替える（短いフェード。動きを減らす設定ではフェードなし）。
 */
export function GiftArt({
  a,
  idx,
  ratio,
  alt,
}: {
  a: ArtistView;
  idx: number;
  ratio: number;
  alt: string;
}) {
  const { whole, cutout, base } = giftSources(a, idx);
  const src = whole ?? cutout ?? a.circle.src;
  const baseSrc = base ?? a.circle.src;
  useEffect(() => needImage(src, 'high'), [src]);
  const state = useImageState(src);
  const baseShown = useShown(baseSrc);
  const box = { height: '100%' } as const;
  // 切り抜きの段では、絵を枠いっぱいに広げて見せる（1 段目は顔まわり、2 段目は 2 人分）
  const draw = (url: string, fade: boolean) =>
    cutout ? (
      <div className={fade ? `${styles.artBox} ${styles.artSwap}` : styles.artBox} style={box}>
        <img className={styles.artBg} src={url} alt="" />
        <img className={styles.artCut} src={url} alt={alt} style={cutoutStyle(a, idx, ratio)} />
      </div>
    ) : (
      <div className={fade ? `${styles.artBox} ${styles.artSwap}` : styles.artBox} style={box}>
        <img className={styles.artBg} src={url} alt="" />
        <img className={styles.artWhole} src={url} alt={alt} />
      </div>
    );
  if (state === 'ready') return draw(src, true);
  if (baseShown && base) return draw(base, false);
  return (
    <div className={styles.artBox} style={box} role="img" aria-label={alt}>
      <Fallback a={a} />
    </div>
  );
}
