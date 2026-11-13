// 推しの絵の部品。絵が読めないとき・まだ届かないときの、代わりの表示を持つ（設計 D-40）:
// 読み済みの絵 → 丸い絵（ぼかし）→ 頭文字。空白の枠・壊れた画像の印は出さない。
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { cutoutStyle, giftSources } from '../art/registry';
import type { ArtistView, CardArt, Crop } from '../art/registry';
import { needImage, useImageState } from '../adapter';
import styles from '../fan.module.css';

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
          <img className={styles.artWhole} src={src} alt={alt} onError={() => setBroken(true)} />
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
 * 届いたら、その場で差し替える（短いフェード。動きを減らす設定ではフェードなし）。
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
  const { whole, cutout } = giftSources(a, idx);
  const src = whole ?? cutout ?? a.circle.src;
  const homeSrc = a.art.imgs?.[0] ?? a.art.img ?? a.circle.src;
  useEffect(() => needImage(src), [src]);
  const state = useImageState(src);
  const homeState = useImageState(homeSrc);
  useEffect(() => needImage(homeSrc), [homeSrc]);
  if (state === 'ready') {
    if (cutout) {
      return (
        <div className={`${styles.artBox} ${styles.artSwap}`} style={{ height: '100%' }}>
          <img className={styles.artBg} src={cutout} alt="" />
          <img
            className={styles.artCut}
            src={cutout}
            alt={alt}
            style={cutoutStyle(a, idx, ratio)}
          />
        </div>
      );
    }
    return (
      <div className={`${styles.artBox} ${styles.artSwap}`} style={{ height: '100%' }}>
        <img className={styles.artBg} src={src} alt="" />
        <img className={styles.artWhole} src={src} alt={alt} />
      </div>
    );
  }
  // 代わりの表示: 読み済みの絵（ホームの絵）→ 丸い絵のぼかし → 頭文字
  if (homeState === 'ready') {
    return (
      <div className={styles.artBox} style={{ height: '100%' }}>
        <img className={styles.artBg} src={homeSrc} alt="" />
        <img className={styles.artWhole} src={homeSrc} alt={alt} />
      </div>
    );
  }
  return (
    <div className={styles.artBox} style={{ height: '100%' }} role="img" aria-label={alt}>
      <Fallback a={a} />
    </div>
  );
}
