import { useCallback, useEffect, useState } from "react";

const MAX_LEN = 240;

export function useChat(socket, roomId) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!roomId) return undefined;
    setMessages([]);
    const onMessage = (msg) => setMessages((list) => [...list.slice(-199), msg]);
    socket.on("chatMessage", onMessage);
    return () => {
      socket.off("chatMessage", onMessage);
      setMessages([]);
    };
  }, [roomId, socket]);

  const sendMessage = useCallback(
    (text) => {
      const trimmed = text.trim().slice(0, MAX_LEN);
      if (!trimmed) return;
      socket.emit("chatMessage", { text: trimmed });
    },
    [socket]
  );

  return { messages, sendMessage };
}
