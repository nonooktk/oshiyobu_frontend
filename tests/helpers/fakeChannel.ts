// BroadcastChannel の代わり（同じ名前の、別の接続だけに届く。自分には届かない）
export class FakeChannel {
  static instances: FakeChannel[] = [];
  private listeners: ((event: { data: unknown }) => void)[] = [];
  private closed = false;

  constructor(readonly name: string) {
    FakeChannel.instances.push(this);
  }

  static reset(): void {
    FakeChannel.instances = [];
  }

  postMessage(data: unknown): void {
    const copy = structuredClone(data);
    for (const other of FakeChannel.instances) {
      if (other !== this && !other.closed && other.name === this.name) {
        other.listeners.forEach((listener) => listener({ data: copy }));
      }
    }
  }

  addEventListener(_type: string, listener: (event: { data: unknown }) => void): void {
    this.listeners.push(listener);
  }

  close(): void {
    this.closed = true;
  }
}

export const asBroadcastChannel = FakeChannel as unknown as typeof BroadcastChannel;
