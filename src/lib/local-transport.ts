import type { GameTransport } from '../../shared/transport';

type WorkerOutgoing =
  | { type: 'open' }
  | { type: 'message'; data: string }
  | { type: 'close' };

/**
 * A WebSocket-compatible transport backed by a dedicated Web Worker that
 * runs the full game engine locally.
 *
 * Drop-in replacement for `new WebSocket(url)` in single-player mode:
 * the hook (useGameSocket) doesn't know or care which transport it has.
 */
export class FakeWebSocket implements GameTransport {
  readyState = 0; // CONNECTING
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  private worker: Worker;

  constructor(roomId: string, playerId: string) {
    // Vite bundles this worker as a separate chunk at build time.
    this.worker = new Worker(
      new URL('../local-game-worker.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (e: MessageEvent<WorkerOutgoing>) => {
      const msg = e.data;
      if (msg.type === 'open') {
        this.readyState = 1; // OPEN
        this.onopen?.(new Event('open'));
      } else if (msg.type === 'message') {
        this.onmessage?.(new MessageEvent('message', { data: msg.data }));
      } else if (msg.type === 'close') {
        this.readyState = 3; // CLOSED
        this.onclose?.(new CloseEvent('close'));
      }
    };

    this.worker.onerror = () => {
      this.readyState = 3;
      this.onerror?.(new Event('error'));
      this.onclose?.(new CloseEvent('close'));
    };

    this.worker.postMessage({ type: 'init', roomId, playerId });
  }

  send(data: string): void {
    if (this.readyState !== 1) return;
    this.worker.postMessage({ type: 'message', data });
  }

  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.worker.terminate();
    this.onclose?.(new CloseEvent('close'));
  }
}
