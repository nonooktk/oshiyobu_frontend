// ファン向け（/fan/。QR の行き先）。人物（端末の番号から決まる 15 通り）の初めの値で、はじめの画面から始める。
import { useEffect, useState } from 'react';
import { startPrefetch } from './adapter';
import { Home } from './components/Home';
import { DetailPage, LiveRegion, Toast } from './components/Frame';
import { AchLayer, FxLayer, GiftLayer, ShareSheet, ThanksLayer } from './components/Layers';
import { NextAction } from './components/NextAction';
import { Start } from './components/Start';
import styles from './fan.module.css';
import { FanProvider, personaNoFromLocation, useFan } from './store/FanProvider';

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
    const t = setTimeout(() => startPrefetch(oshiId), 1000);
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
          <DetailPage title="メニュー">
            <p>この画面は、これから作ります。</p>
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
          default:
            return null;
        }
      })}
      {ach ? <AchLayer key={ach.id} ach={ach} /> : null}
      <Toast />
      <LiveRegion />
    </div>
  );
}
