import { useEffect, useState, useCallback } from "react";
import { socket } from "./socket.js";
import Lobby from "./components/Lobby.jsx";
import PokerTable from "./components/PokerTable.jsx";

export default function App() {
  const [roomId, setRoomId] = useState(null);
  const [tableState, setTableState] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.connect();
    socket.on("state", setTableState);
    socket.on("actionError", ({ message }) => setError(message));
    return () => {
      socket.off("state", setTableState);
      socket.off("actionError");
      socket.disconnect();
    };
  }, []);

  const handleCreate = useCallback(({ name, smallBlind, bigBlind, startingStack }) => {
    setError("");
    socket.emit("createRoom", { name, smallBlind, bigBlind, startingStack }, (res) => {
      if (!res.ok) return setError(res.error || "Could not create room");
      setRoomId(res.roomId);
    });
  }, []);

  const handleJoin = useCallback(({ roomId, name }) => {
    setError("");
    socket.emit("joinRoom", { roomId, name }, (res) => {
      if (!res.ok) return setError(res.error || "Could not join room");
      setRoomId(res.roomId);
    });
  }, []);

  const handleLeave = useCallback(() => {
    socket.emit("leaveRoom");
    setRoomId(null);
    setTableState(null);
  }, []);

  const handleAction = useCallback((action, amount) => {
    setError("");
    socket.emit("action", { action, amount });
  }, []);

  const handleStartHand = useCallback(() => socket.emit("startHand"), []);

  if (!roomId || !tableState) {
    return <Lobby onCreate={handleCreate} onJoin={handleJoin} error={error} />;
  }

  return (
    <>
      <PokerTable
        state={tableState}
        roomId={roomId}
        onStartHand={handleStartHand}
        onAction={handleAction}
        onLeave={handleLeave}
      />
      {error && <div className="toast">{error}</div>}
    </>
  );
}
