// 共有メーターを、実ブラウザで試すための小さな画面（Vite の開発サーバーだけが配る。ビルドには入らない）。
// ファン向けの画面が共有メーターにつながる前でも、取得・申し込み・reset の検知を、実ブラウザで確かめられる
import { createRoot } from 'react-dom/client';
import type { PerformanceId } from '../../src/core';
import {
  isMeterBusy,
  joinPerformance,
  onMeterReset,
  requestMeterFetch,
  useSharedMeter,
} from '../../src/shared/meter';

const params = new URLSearchParams(location.search);
const pid = (params.get('pid') ?? 'tech0:cbox') as PerformanceId;
const polling = params.get('poll') !== '0';
let resets = 0;
onMeterReset(() => {
  resets += 1;
});

function Harness() {
  const meter = useSharedMeter(pid, { poll: polling });
  return (
    <main>
      <pre data-testid="state">{JSON.stringify({ ...meter, resets, busy: isMeterBusy() })}</pre>
      <button type="button" onClick={() => joinPerformance(pid)}>
        申し込む
      </button>
      <button type="button" onClick={() => requestMeterFetch('open')}>
        取得（open）
      </button>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
