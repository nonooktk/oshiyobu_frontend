// ファン向け（/fan/。QR の行き先）。人物（端末の番号から決まる 15 通り）の初めの値で、はじめの画面から始める。
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { requestMeterFetch } from '../shared/meter';
import { ChunkBoundary, startPrefetch } from '../shared/prefetch';
import { Home } from './components/Home';
import { DetailPage, LiveRegion, SheetShell, Toast } from './components/Frame';
import { AchLayer, FxLayer, GiftLayer, ShareSheet, ThanksLayer } from './components/Layers';
import { NextAction } from './components/NextAction';
import { Start } from './components/Start';
import type { LayersModule, PagesModule } from './prefetch';
import { setupFanPrefetch } from './prefetch';
import { PAGE_TITLES } from './text/ui';
import styles from './fan.module.css';
import { FanProvider, getAppStore, useFan } from './store/FanProvider';

// 先読みする絵と、遅れて読む塊（メニュー配下の画面・やめる確認・引き継ぎ）を、共有の部品に登録する
setupFanPrefetch();

export function App() {
  return (
    <FanProvider store={getAppStore()}>
      <Screen />
    </FanProvider>
  );
}

/** 層の枠が出ているあいだ、中身が来るまで出す「戻る」（操作を残す。白い画面にしない）。 */
function BackOnly({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className={styles.sheetBtns}>
      <button type="button" className={`${styles.btn} ${styles.btnFull}`} onClick={onClick}>
        {label}
      </button>
    </div>
  );
}

function Screen() {
  const { state, actions } = useFan();
  const { layers, ach, page } = state;

  // ファン向けを開いた直後に、共有メーターの人数を 1 回取りに行く（取得の契機①。設計 D-18）
  useEffect(() => {
    requestMeterFetch('open');
  }, []);

  // 押せる状態になった印（速さの測定が読む）と、その 1 秒後の先読み（設計 D-40）
  const oshiId = state.oshiId;
  useEffect(() => {
    performance.mark('oshiyobu:ready');
  }, []);
  useEffect(() => {
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

  const sheet = (
    title: string,
    inert: boolean,
    onClose: () => void,
    back: string,
    body: ReactNode,
  ): ReactNode => (
    <SheetShell title={title} inert={inert} onClose={onClose}>
      {body ?? <BackOnly label={back} onClick={onClose} />}
    </SheetShell>
  );

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
          <ChunkBoundary<PagesModule>
            name="fan-pages"
            frame={<DetailPage title={PAGE_TITLES[page]} />}
          >
            {(m) => (
              <DetailPage title={PAGE_TITLES[page]}>
                <m.default page={page} />
              </DetailPage>
            )}
          </ChunkBoundary>
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
              <ChunkBoundary<LayersModule>
                key="cancel"
                name="fan-layers"
                frame={sheet('申し込みをやめますか？', inert, actions.closeCancel, '戻る', null)}
              >
                {(m) =>
                  sheet(
                    '申し込みをやめますか？',
                    inert,
                    actions.closeCancel,
                    '戻る',
                    <m.CancelBody />,
                  )
                }
              </ChunkBoundary>
            );
          case 'deposit':
            return (
              <ChunkBoundary<LayersModule>
                key="deposit"
                name="fan-layers"
                frame={sheet('預金を積み増す', inert, actions.closeDeposit, '閉じる', null)}
              >
                {(m) =>
                  sheet('預金を積み増す', inert, actions.closeDeposit, '閉じる', <m.DepositBody />)
                }
              </ChunkBoundary>
            );
          case 'carry':
            return (
              <ChunkBoundary<LayersModule>
                key="carry"
                name="fan-layers"
                frame={sheet('引き継いだもの', inert, actions.closeCarry, 'ホームへ', null)}
              >
                {(m) =>
                  sheet('引き継いだもの', inert, actions.closeCarry, 'ホームへ', <m.CarryBody />)
                }
              </ChunkBoundary>
            );
        }
      })}
      {ach ? <AchLayer key={ach.id} ach={ach} /> : null}
      <Toast />
      <LiveRegion />
    </div>
  );
}
