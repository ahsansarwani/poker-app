import { useState } from "react";

export default function Lobby({ onCreate, onJoin, error }) {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [startingStack, setStartingStack] = useState(1000);

  return (
    <div className="lobby">
      <h1>Hold'em</h1>
      <label className="field">
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="e.g. Ahsan" />
      </label>

      <div className="lobby__panels">
        <div className="panel">
          <h2>Join a table</h2>
          <label className="field">
            Room code
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              maxLength={5}
              placeholder="ABCDE"
            />
          </label>
          <button disabled={!name || roomId.length < 5} onClick={() => onJoin({ roomId, name })}>
            Join
          </button>
        </div>

        <div className="panel">
          <h2>Create a table</h2>
          <label className="field">
            Small blind
            <input type="number" min={1} value={smallBlind} onChange={(e) => setSmallBlind(e.target.value)} />
          </label>
          <label className="field">
            Big blind
            <input type="number" min={2} value={bigBlind} onChange={(e) => setBigBlind(e.target.value)} />
          </label>
          <label className="field">
            Starting chips
            <input type="number" min={100} value={startingStack} onChange={(e) => setStartingStack(e.target.value)} />
          </label>
          <button
            disabled={!name}
            onClick={() => onCreate({ name, smallBlind, bigBlind, startingStack })}
          >
            Create table
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
