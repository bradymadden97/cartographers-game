import { useState } from 'react';

interface Props {
  onJoin: (roomId: string, playerName: string) => void;
}

export function Lobby({ onJoin }: Props) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  function handleCreate() {
    if (!name.trim()) return;
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    onJoin(id, name.trim());
  }

  function handleJoin() {
    if (!name.trim() || !roomCode.trim()) return;
    onJoin(roomCode.trim().toUpperCase(), name.trim());
  }

  return (
    <div className="lobby">
      <h1>Cartographers</h1>
      <div className="card">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="off"
        />
        <button onClick={handleCreate} disabled={!name.trim()}>
          Create Room
        </button>
        <div className="divider">or join existing</div>
        <input
          type="text"
          placeholder="Room code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
          autoComplete="off"
        />
        <button onClick={handleJoin} disabled={!name.trim() || !roomCode.trim()}>
          Join Room
        </button>
      </div>
    </div>
  );
}
