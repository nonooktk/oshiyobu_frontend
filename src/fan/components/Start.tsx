// はじめの画面（推し → コースの 2 ステップ。SP-40）。初めから選んであるので、「次へ」と「このコースを目指して始める」で、ホームへ進む。
// 呼ぶ市は、どの推しでも久留米市に固定（市を選ぶ画面は無い）。会場の説明は、コースを選ぶ画面に置く。
import { useEffect, useRef } from 'react';
import { ARTIST_IDS, canApply, courseOffersOf } from '../../core';
import { ARTISTS_VIEW, artistView } from '../art/registry';
import logoMark from '../../assets/img/logo-mark.webp';
import { courseOf } from '../domain/view';
import { yen } from '../text/format';
import styles from '../fan.module.css';
import { MyState, PayNote } from '../text/pay';
import { useFan } from '../store/FanProvider';
import { Av, WholeArt } from './Art';
import { CourseFace } from './CourseFace';
import { Strip } from './Frame';
import { Wbr } from './text';

const TITLES = ['推しを選ぶ', '目指すコースを選ぶ'] as const;

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
  const c = view.cond; // 会場は、久留米の既定の会場に固定
  const { deposit, pay } = state.acct;

  return (
    <div className={`${styles.page} ${step === 1 ? styles.step3 : ''}`}>
      <Strip />
      <div className={styles.stBar}>
        {step === 0 ? <img src={logoMark} alt="OSHIYOBU" width={32} height={32} /> : null}
        {step > 0 ? (
          <button type="button" className={styles.stBack} onClick={actions.startBack}>
            ‹ もどる
          </button>
        ) : null}
        <span className={`${styles.stCount} ${styles.num}`} aria-hidden="true">
          {step + 1} / 2
        </span>
        <div className={styles.stDots} role="img" aria-label={`2 つのうち ${step + 1} つ目`}>
          {[0, 1].map((i) => (
            <i key={i} className={i <= step ? styles.on : undefined} />
          ))}
        </div>
      </div>
      <div className={step === 1 ? `${styles.stMain} ${styles.stMainScroll}` : styles.stMain}>
        <h2 className={styles.stH} ref={heading} tabIndex={-1}>
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
            <p className={styles.stVenue}>
              会場: {c.venue.name}（{c.venue.cap}
              {c.venue.unit}）<br />
              熱量が満ちると、開催が決まります
            </p>
            <p className={styles.rcNote}>
              <MyState deposit={deposit} pay={pay} />
            </p>
            <p className={styles.rcNote}>
              <PayNote />
            </p>
            <div className={styles.rcList} role="group" aria-label="目指すコース">
              {courseOffersOf(c.venueId).map((k) => {
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
        {step === 1 ? (
          <SelLine seat={courseOf(c, s.seat)} ok={canApply(courseOf(c, s.seat), deposit, pay)} />
        ) : null}
        <button
          type="button"
          className={`${styles.btn} ${styles.btnFull}`}
          onClick={actions.startNext}
        >
          {step < 1
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
