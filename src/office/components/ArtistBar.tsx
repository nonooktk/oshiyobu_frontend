import type { CSSProperties } from 'react';
import { ARTIST_IDS } from '../../core';
import styles from '../office.module.css';
import { useOffice } from '../store';
import { ARTIST_TEXT } from '../text/artists';
import type { ArtistText } from '../text/artists';
import { text } from '../text/labels';

/** 丸い絵（頭文字の丸の上に、絵を重ねる。絵が読めなくても、頭文字が残る） */
export function Avatar({ artist }: { readonly artist: ArtistText }) {
  const { pos, zoom, org } = artist.crop;
  const style = { '--pos': pos ?? '50% 50%', '--zoom': zoom, '--org': org } as CSSProperties;
  return (
    <span className={styles.av} aria-hidden="true">
      {artist.initial}
      <img src={artist.img} alt="" style={style} />
    </span>
  );
}

export function ArtistBar() {
  const artistId = useOffice((s) => s.artistId);
  const setArtist = useOffice((s) => s.setArtist);
  return (
    <div className={styles.artistBar}>
      <span className={styles.artistLabel} id="artist-label">
        {text.artistLabel}
      </span>
      <div className={styles.artists} role="group" aria-labelledby="artist-label">
        {ARTIST_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.pill}
            aria-pressed={id === artistId}
            onClick={() => setArtist(id)}
          >
            <Avatar artist={ARTIST_TEXT[id]} />
            {ARTIST_TEXT[id].name}
          </button>
        ))}
      </div>
    </div>
  );
}
