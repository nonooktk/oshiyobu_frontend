// はじめの画面（推し → 市 → コースの 3 ステップ。SP-40）。初めから選んであるので、「次へ」を 3 回押せばホームへ進む。
import { useEffect, useRef } from 'react';
import { CITY_NAMES, ARTIST_IDS, canApply, conditionOf, courseOffersOf } from '../../core';
import { ARTISTS_VIEW, artistView } from '../art/registry';
import logoMark from '../../assets/img/logo-mark.webp';
import { venueForCity } from '../domain/state';
import { courseOf } from '../domain/view';
import { yen } from '../text/format';
import styles from '../fan.module.css';
import { MyState, PayNote } from '../text/pay';
import { useFan } from '../store/FanProvider';
import { Av, WholeArt } from './Art';
import { CourseFace } from './CourseFace';
import { CITY_DOT, KyushuShape } from './KyushuMap';
import { Strip } from './Frame';
import { Wbr } from './text';

const TITLES = ['推しを選ぶ', '呼びたい市を選ぶ', '目指すコースを選ぶ'] as const;

export function Start() {
  const { state, view, actions } = useFan();
  const s = state.start;
  const heading = useRef<HTMLHeadingElement>(null);
  const step = s?.step ?? 0;
  // ステップが変わったら、見出しにフォーカスを移す（読み上げは、ストアの live が伝える）
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  if (!s) return null;

  const o = artistView(s.oshiId);
  const venueId = venueForCity(state, s.city);
  // 条件は、いま出している会場と同じなら、事務所向けと連動した条件をそのまま使う
  const c = view.cond.venueId === venueId ? view.cond : conditionOf(venueId);
  const { deposit, pay } = state.acct;

  return (
    <div className={`${styles.page} ${step === 2 ? styles.step3 : ''}`}>
      <Strip />
      <div className={styles.stBar}>
        {step === 0 ? <img src={logoMark} alt="OSHIYOBU" width={32} height={32} /> : null}
        {step > 0 ? (
          <button type="button" className={styles.stBack} onClick={actions.startBack}>
            ‹ もどる
          </button>
        ) : null}
        <span className={`${styles.stCount} ${styles.num}`} aria-hidden="true">
          {step + 1} / 3
        </span>
        <div className={styles.stDots} role="img" aria-label={`3 つのうち ${step + 1} つ目`}>
          {[0, 1, 2].map((i) => (
            <i key={i} className={i <= step ? styles.on : undefined} />
          ))}
        </div>
      </div>
      <div className={step === 2 ? `${styles.stMain} ${styles.stMainScroll}` : styles.stMain}>
        <h2
          className={step === 0 ? `${styles.stH} ${styles.oshiTitle}` : styles.stH}
          ref={heading}
          tabIndex={-1}
        >
          {TITLES[step]}
        </h2>
        {step === 0 ? (
          <>
            <section className={`${styles.hero} ${styles.stHero}`} aria-label="選んでいる推しの絵">
              <div className={styles.heroArt}>
                <WholeArt
                  src={o.art.imgs?.[0] ?? o.art.img ?? o.circle.src}
                  alt={`${o.name}の絵`}
                  a={o}
                />
              </div>
              <p className={styles.heroWho}>
                <span className={styles.nw}>{o.name}</span>
              </p>
            </section>
            <div className={styles.stArts} role="group" aria-label="推し">
              {ARTIST_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.stArt}
                  aria-pressed={id === s.oshiId}
                  aria-label={ARTISTS_VIEW[id].name}
                  onClick={() => actions.startPick('oshi', id)}
                >
                  <Av a={ARTISTS_VIEW[id]} />
                  <span className={styles.stArtCk} aria-hidden="true">
                    ✓
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <KyushuShape id="fan-ky-shape" />
            <div className={styles.stCities} role="group" aria-label="呼びたい市">
              {CITY_NAMES.map((name) => {
                const [x, y] = CITY_DOT[name];
                return (
                  <button
                    key={name}
                    type="button"
                    className={styles.stCity}
                    aria-pressed={name === s.city}
                    onClick={() => actions.startPick('city', name)}
                  >
                    <svg viewBox="0 0 460 590" aria-hidden="true">
                      <use className={styles.kyUse} href="#fan-ky-shape" />
                      <circle className={styles.kyDot} cx={x} cy={y} r={46} />
                    </svg>
                    {name}
                  </button>
                );
              })}
            </div>
            <p className={styles.stVenue}>
              会場: {c.venue.name}（{c.venue.cap}
              {c.venue.unit}）<br />
              成立は、最低人数 <span className={styles.nw}>{c.min}人</span>以上
              <wbr />
              と、目標の金額への到達
            </p>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <p className={styles.rcNote}>
              <MyState deposit={deposit} pay={pay} />
            </p>
            <p className={styles.rcNote}>
              <PayNote />
            </p>
            <div className={styles.rcList} role="group" aria-label="目指すコース">
              {courseOffersOf(venueId).map((k) => {
                const sel = k.id === s.seat;
                return (
                  <button
                    key={k.id}
                    type="button"
                    className={sel ? `${styles.rcard} ${styles.sel}` : styles.rcard}
                    aria-pressed={sel}
                    onClick={() => actions.startPick('seat', k.id)}
                  >
                    <CourseFace
                      k={courseOf(c, k.id)}
                      cond={c}
                      a={o}
                      deposit={deposit}
                      pay={pay}
                      mark={sel ? '選択中' : ''}
                      ring={!sel}
                    />
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
      <div className={styles.stFoot}>
        {step === 2 ? (
          <SelLine seat={courseOf(c, s.seat)} ok={canApply(courseOf(c, s.seat), deposit, pay)} />
        ) : null}
        <button
          type="button"
          className={`${styles.btn} ${styles.btnFull}`}
          onClick={actions.startNext}
        >
          {step < 2
            ? '次へ'
            : canApply(courseOf(c, s.seat), deposit, pay)
              ? 'この内容で申し込む'
              : 'このコースを目指して始める'}
        </button>
      </div>
    </div>
  );
}

/** 選んだコースに合わせた 1 文（下に固定した帯の、ボタンの上）。 */
function SelLine({ seat, ok }: { seat: { name: string; price: number }; ok: boolean }) {
  return (
    <p className={styles.stSel}>
      {ok ? (
        <Wbr
          parts={[
            `${seat.name} ${yen(seat.price)}は、`,
            '成立まで',
            '口座の中で',
            '確保されます。',
          ]}
        />
      ) : (
        <Wbr
          parts={[
            `${seat.name}は、`,
            'いまは申し込めません。',
            '条件がそろうと',
            '申し込めます。',
            'お金はまだ',
            '動きません。',
          ]}
        />
      )}
    </p>
  );
}
