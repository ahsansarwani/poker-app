import { useState } from "react";

const GAMES = [
  { id: "holdem", name: "Texas Hold'em", blurb: "Classic no-limit poker.", icon: "♠️", ready: true },
  { id: "bluff", name: "Bluff", blurb: "Play it straight or lie through your teeth.", icon: "🃏", ready: true },
  { id: "rummy10", name: "10 Card Rummy", blurb: "Coming soon.", icon: "🎴", ready: false },
  { id: "teenpatti4", name: "4 Patti", blurb: "Coming soon.", icon: "🎰", ready: false },
  { id: "thulla", name: "Thulla", blurb: "Coming soon.", icon: "♦️", ready: false },
];

export default function Lobby({ onCreate, onJoin, onCreateBotRoom, error, connected }) {
  const [gameId, setGameId] = useState(null);
  const [mode, setMode] = useState("friends"); // "friends" | "bots"
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [startingStack, setStartingStack] = useState(1000);
  const [botCount, setBotCount] = useState(3);

  const game = GAMES.find((g) => g.id === gameId);
  const buildOptions = () => (gameId === "holdem" ? { smallBlind, bigBlind, startingStack } : {});

  return (
    <div className="lobby">
      <div className="lobby__brand">
        <div className="lobby__chip" aria-hidden="true" />
        <h1>Hold&rsquo;em House</h1>
        <p className="lobby__tagline">Pick your table. The house is always open.</p>
      </div>

      {!connected && (
        <p className="connection-banner">Connecting to the game server&hellip; if this doesn't clear up, refresh the page.</p>
      )}

      {!game ? (
        <div className="game-grid">
          {GAMES.map((g) => (
            <button
              key={g.id}
              className={`game-tile ${g.ready ? "" : "game-tile--soon"}`}
              disabled={!g.ready}
              onClick={() => setGameId(g.id)}
            >
              <span className="game-tile__icon">{g.icon}</span>
              <span className="game-tile__name">{g.name}</span>
              <span className="game-tile__blurb">{g.blurb}</span>
              {!g.ready && <span className="game-tile__badge">Coming soon</span>}
            </button>
          ))}
        </div>
      ) : (
        <>
          <button className="lobby__back" onClick={() => setGameId(null)}>
            &larr; All games
          </button>

          <label className="field field--name">
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="e.g. Ahsan" />
          </label>
          {!name && <p className="panel__hint">Enter your name above to unlock the buttons below.</p>}

          <div className="mode-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "friends"}
              className={`mode-tab ${mode === "friends" ? "mode-tab--active" : ""}`}
              onClick={() => setMode("friends")}
            >
              Play with friends
            </button>
            <button
              role="tab"
              aria-selected={mode === "bots"}
              className={`mode-tab ${mode === "bots" ? "mode-tab--active" : ""}`}
              onClick={() => setMode("bots")}
            >
              Play vs bots
            </button>
          </div>

          {mode === "friends" ? (
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
                <button className="btn btn--primary" disabled={!name || roomId.length < 5} onClick={() => onJoin({ roomId, name })}>
                  Join table
                </button>
              </div>

              <div className="panel">
                <h2>Create a table</h2>
                {gameId === "holdem" && (
                  <>
                    <div className="field-row">
                      <label className="field">
                        Small blind
                        <input type="number" min={1} value={smallBlind} onChange={(e) => setSmallBlind(Number(e.target.value) || 0)} />
                      </label>
                      <label className="field">
                        Big blind
                        <input type="number" min={2} value={bigBlind} onChange={(e) => setBigBlind(Number(e.target.value) || 0)} />
                      </label>
                    </div>
                    <label className="field">
                      Starting chips
                      <input type="number" min={100} value={startingStack} onChange={(e) => setStartingStack(Number(e.target.value) || 0)} />
                    </label>
                  </>
                )}
                <button
                  className="btn btn--primary"
                  disabled={!name}
                  onClick={() => onCreate({ gameType: gameId, name, options: buildOptions() })}
                >
                  Create table
                </button>
              </div>
            </div>
          ) : (
            <div className="lobby__panels lobby__panels--single">
              <div className="panel">
                <h2>Practice vs bots</h2>
                <p className="panel__hint">Jump straight into a round against computer opponents. No waiting on friends.</p>
                <label className="field">
                  Number of bots
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={botCount}
                    onChange={(e) => setBotCount(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                  />
                </label>
                {gameId === "holdem" && (
                  <>
                    <div className="field-row">
                      <label className="field">
                        Small blind
                        <input type="number" min={1} value={smallBlind} onChange={(e) => setSmallBlind(Number(e.target.value) || 0)} />
                      </label>
                      <label className="field">
                        Big blind
                        <input type="number" min={2} value={bigBlind} onChange={(e) => setBigBlind(Number(e.target.value) || 0)} />
                      </label>
                    </div>
                    <label className="field">
                      Starting chips
                      <input type="number" min={100} value={startingStack} onChange={(e) => setStartingStack(Number(e.target.value) || 0)} />
                    </label>
                  </>
                )}
                <button
                  className="btn btn--primary"
                  disabled={!name}
                  onClick={() => onCreateBotRoom({ gameType: gameId, name, options: buildOptions(), botCount })}
                >
                  Play vs {botCount} bot{botCount > 1 ? "s" : ""}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
