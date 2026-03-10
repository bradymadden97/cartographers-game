/**
 * Local game worker — runs the shared game engine inside a Web Worker so the
 * game logic is off the main thread even in single-player / offline mode.
 *
 * Message protocol (main thread → worker):
 *   { type: 'init';    roomId: string; playerId: string }
 *   { type: 'message'; data: string }   — JSON-serialised ClientMessage
 *
 * Message protocol (worker → main thread):
 *   { type: 'open' }                    — ready (fires after 'init')
 *   { type: 'message'; data: string }   — JSON-serialised ServerMessage
 */

import { handleMessage, createInitialEngineState } from '../shared/game-engine';
import { IDBStorageAdapter } from './lib/storage-idb';
import type { ClientMessage } from '../shared/types';

type InitMsg = { type: 'init'; roomId: string; playerId: string };
type ClientEnvelope = { type: 'message'; data: string };
type IncomingMsg = InitMsg | ClientEnvelope;

let roomId: string | null = null;
let playerId: string | null = null;
let storage: IDBStorageAdapter | null = null;

// `self` inside a module worker is DedicatedWorkerGlobalScope.
// We cast once here to keep the rest of the code clean.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<IncomingMsg>) => void) | null;
  postMessage(data: unknown): void;
};

ctx.onmessage = async (event: MessageEvent<IncomingMsg>) => {
  const msg = event.data;

  if (msg.type === 'init') {
    roomId = msg.roomId;
    playerId = msg.playerId;
    storage = new IDBStorageAdapter(roomId);
    ctx.postMessage({ type: 'open' });
    return;
  }

  if (msg.type === 'message' && roomId && playerId && storage) {
    try {
      const clientMsg: ClientMessage = JSON.parse(msg.data);
      const saved = await storage.getEngineState();
      const engineState = saved ?? createInitialEngineState(roomId);
      const { state, outgoing } = handleMessage(engineState, clientMsg, playerId);
      await storage.saveEngineState(state);

      for (const out of outgoing) {
        // In single-player every outgoing message goes to the one player,
        // regardless of whether `to` is 'all' or the specific playerId.
        ctx.postMessage({ type: 'message', data: JSON.stringify(out.message) });
      }
    } catch {
      ctx.postMessage({
        type: 'message',
        data: JSON.stringify({ type: 'error', message: 'Game engine error' }),
      });
    }
  }
};

export {}; // Ensure TypeScript treats this as a module
