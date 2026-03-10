import { useState } from 'react';

interface Props {
  initialName: string;
  initialRoomCode: string;
  onJoin: (roomId: string, playerName: string) => void;
  onSolo: (roomId: string, playerName: string) => void;
}

export function Landing({ initialName, initialRoomCode, onJoin, onSolo }: Props) {
  const [name, setName] = useState(initialName);
  const [roomCode, setRoomCode] = useState(initialRoomCode);

  function generateId() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function handleSolo() {
    if (!name.trim()) return;
    onSolo(generateId(), name.trim());
  }

  function handleCreate() {
    if (!name.trim()) return;
    onJoin(generateId(), name.trim());
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
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          maxLength={20}
          autoComplete="off"
        />
        <button onClick={handleSolo} disabled={!name.trim()}>
          Play Solo
        </button>
        <button onClick={handleCreate} disabled={!name.trim()}>
          Create Room
        </button>
        <div className="divider">or join existing</div>
        <input
          type="text"
          placeholder="Room code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
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
