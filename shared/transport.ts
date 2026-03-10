/**
 * Minimal WebSocket-compatible interface used throughout the client.
 *
 * The native `WebSocket` class satisfies this interface structurally.
 * `FakeWebSocket` (src/lib/local-transport.ts) implements it for
 * offline single-player mode backed by a Web Worker.
 */
export interface GameTransport {
  readonly readyState: number;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  send(data: string): void;
  close(): void;
}
