import { useEffect, useState, useCallback, useMemo } from "react";
import { socket } from "./socket.js";
import { useVoiceChat } from "./voiceChat.js";
import { useChat } from "./chat.js";
import { useBotVoiceOver } from "./botVoice.js";
import Lobby from "./components/Lobby.jsx";
import PokerTable from "./components/PokerTable.jsx";
import BluffBoard from "./components/BluffBoard.jsx";

const BOARDS = {
  holdem: PokerTable,
  bluff: BluffBoard,
};

export default function App() {
  const [roomId, setRoomId] = useState(null);
  const [tableState, setTableState] = useState(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(socket.connected);
  const [botVoiceOn, setBotVoiceOn] = useState(true);
  const voice = useVoiceChat(socket, roomId);
  const chat = useChat(socket, roomId);
  const hasBots = !!tableState?.seats?.some((s) => s?.isBot);
  useBotVoiceOver(tableState, botVoiceOn && hasBots);
  const botVoice = useMemo(
    () => ({ enabled: botVoiceOn, hasBots, toggle: () => setBotVoiceOn((v) => !v) }),
    [botVoiceOn, hasBots]
  );

  useEffect(() => {
    socket.connect();
    socket.on("connect", () => {
      setConnected(true);
      setError("");
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("state", setTableState);
    socket.on("actionError", ({ message }) => setError(message));
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("state", setTableState);
      socket.off("actionError");
      socket.disconnect();
    };
  }, []);

  const handleCreate = useCallback(({ gameType, name, options }) => {
    if (!socket.connected) return setError("Not connected to the game server — check your connection and try again.");
    setError("");
    socket.emit("createGameRoom", { gameType, name, options }, (res) => {
      if (!res.ok) return setError(res.error || "Could not create table");
      setRoomId(res.roomId);
    });
  }, []);

  const handleCreateBotRoom = useCallback(({ gameType, name, options, botCount }) => {
    if (!socket.connected) return setError("Not connected to the game server — check your connection and try again.");
    setError("");
    socket.emit("createGameBotRoom", { gameType, name, options, botCount }, (res) => {
      if (!res.ok) return setError(res.error || "Could not start a bot table");
      setRoomId(res.roomId);
    });
  }, []);

  const handleJoin = useCallback(({ roomId, name }) => {
    if (!socket.connected) return setError("Not connected to the game server — check your connection and try again.");
    setError("");
    socket.emit("joinGameRoom", { roomId, name }, (res) => {
      if (!res.ok) return setError(res.error || "Could not join table");
      setRoomId(res.roomId);
    });
  }, []);

  const handleLeave = useCallback(() => {
    socket.emit("leaveRoom");
    setRoomId(null);
    setTableState(null);
  }, []);

  // Hold'em's ActionBar calls onAction(action, amount); other boards call onAction(action, payload).
  const handleAction = useCallback((action, amountOrPayload) => {
    setError("");
    const payload =
      typeof amountOrPayload === "object" && amountOrPayload !== null ? amountOrPayload : { amount: amountOrPayload || 0 };
    socket.emit("gameAction", { action, payload });
  }, []);

  const handleStartGame = useCallback(() => socket.emit("startGame"), []);

  if (!roomId || !tableState) {
    return (
      <Lobby
        onCreate={handleCreate}
        onJoin={handleJoin}
        onCreateBotRoom={handleCreateBotRoom}
        error={error}
        connected={connected}
      />
    );
  }

  const Board = BOARDS[tableState.gameType] || PokerTable;

  return (
    <>
      <Board
        state={tableState}
        roomId={roomId}
        onStartHand={handleStartGame}
        onAction={handleAction}
        onLeave={handleLeave}
        voice={voice}
        botVoice={botVoice}
        chat={chat}
      />
      {error && <div className="toast">{error}</div>}
      <div style={{ display: "none" }}>
        {voice.remoteAudios.map((a) => (
          <audio
            key={a.peerId}
            autoPlay
            playsInline
            ref={(el) => {
              if (el && el.srcObject !== a.stream) el.srcObject = a.stream;
            }}
          />
        ))}
      </div>
    </>
  );
}
