// 画面のテストで使う、AudioContext の偽物。本物の音は出さず、作られた音（オシレーター）の数だけを記録する。
// 使い方: beforeEach で audioLog.oscillators = 0 にして、vi.stubGlobal('AudioContext', FakeAudioContext) を渡す。
export const audioLog = { oscillators: 0 };

export class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
        cancelScheduledValues: () => undefined,
      },
      connect: () => undefined,
      disconnect: () => undefined,
    };
  }
  createOscillator() {
    audioLog.oscillators += 1;
    return {
      type: '',
      frequency: { value: 0 },
      connect: () => undefined,
      disconnect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
    };
  }
}
