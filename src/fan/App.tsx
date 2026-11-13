// ファン向け（/fan/。QR の行き先）。人物（端末の番号から決まる 15 通り）の初めの値で、はじめの画面から始める。
import { useEffect, useState } from 'react';
import { startPrefetch } from './adapter';
import { Home } from './components/Home';
import { DetailPage, LiveRegion, SheetShell, Toast } from './components/Frame';
import { LazyBody } from './components/Lazy';
import { AchLayer, FxLayer, GiftLayer, ShareSheet, ThanksLayer } from './components/Layers';
import { NextAction } from './components/NextAction';
import { Start } from './components/Start';
import { PAGE_TITLES } from './text/ui';
import styles from './fan.module.css';
import { FanProvider, personaNoFromLocation, useFan } from './store/FanProvider';

// あとから読む塊（設計 D-40 の fan-pages・fan-layers）。押されたとき、読めていなければ、枠を先に出して、中身を埋める
const loadPages = () => import('./pages/Pages');
const loadCancel = () => import('./layers/Sheets').then((m) => ({ default: m.CancelBody }));
const loadCarry = () => import('./layers/Sheets').then((m) => ({ default: m.CarryBody }));

export function App() {
  const [personaNo] = useState(() => personaNoFromLocation(window.location.search));
  return (
    <FanProvider personaNo={personaNo}>
      <Screen />
    </FanProvider>
  );
}

function Screen() {
  const { state, actions } = useFan();
  const { layers, ach, page } = state;

  // 押せる状態になった印（速さの測定が読む）と、その 1 秒後の先読み（設計 D-40）
  const oshiId = state.oshiId;
  useEffect(() => {
    performance.mark('oshiyobu:ready');
    const t = setTimeout(() => {
      startPrefetch(oshiId);
      // メニュー配下の画面 → やめる確認・引き継ぎの順に、静かに先読みする
      void loadPages()
        .then(() => loadCancel())
        .then(() => loadCarry())
        .catch(() => undefined);
    }, 1000);
    return () => clearTimeout(t);
  }, [oshiId]);

  // Esc でいちばん上の層を閉じる。押す・キーを押すと、条件の達成のエフェクトは、すぐ消える
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') actions.escape();
      actions.clearAch();
    };
    const onPointer = (): void => actions.clearAch();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [actions]);

  return (
    <div className={styles.shell} data-page={page}>
      <h1 className={styles.srOnly}>OSHIYOBU</h1>
      <div className={styles.pageHost} inert={layers.length > 0}>
        {page === 'start' ? (
          <Start />
        ) : page === 'home' ? (
          <Home />
        ) : page === 'next' ? (
          <NextAction />
        ) : (
          <DetailPage title={PAGE_TITLES[page]}>
            <LazyBody load={loadPages} props={{ page }} name="pages" />
          </DetailPage>
        )}
      </div>
      {layers.map((layer, i) => {
        const inert = i < layers.length - 1;
        switch (layer.kind) {
          case 'fx':
            return <FxLayer key={layer.fx.id} fx={layer.fx} inert={inert} />;
          case 'gift':
            return <GiftLayer key={`gift-${i}`} replay={layer.replay} inert={inert} />;
          case 'thanks':
            return <ThanksLayer key="thanks" inert={inert} />;
          case 'share':
            return <ShareSheet key="share" mode={layer.mode} inert={inert} />;
          case 'cancel':
            return (
              <SheetShell
                key="cancel"
                title="申し込みをやめますか？"
                inert={inert}
                onClose={actions.closeCancel}
              >
                <LazyBody
                  load={loadCancel}
                  props={{}}
                  name="cancel"
                  fallback={
                    <div className={styles.sheetBtns}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnFull}`}
                        onClick={actions.closeCancel}
                      >
                        戻る
                      </button>
                    </div>
                  }
                />
              </SheetShell>
            );
          case 'carry':
            return (
              <SheetShell
                key="carry"
                title="引き継いだもの"
                inert={inert}
                onClose={actions.closeCarry}
              >
                <LazyBody
                  load={loadCarry}
                  props={{}}
                  name="carry"
                  fallback={
                    <div className={styles.sheetBtns}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnFull}`}
                        onClick={actions.closeCarry}
                      >
                        ホームへ
                      </button>
                    </div>
                  }
                />
              </SheetShell>
            );
        }
      })}
      {ach ? <AchLayer key={ach.id} ach={ach} /> : null}
      <Toast />
      <LiveRegion />
    </div>
  );
}
