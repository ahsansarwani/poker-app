import { useState } from "react";

export default function ChatPanel({ chat }) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    chat.sendMessage(text);
    setText("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-panel__messages">
        {chat.messages.length === 0 && <div className="chat-panel__empty">No messages yet.</div>}
        {chat.messages.map((m) => (
          <div key={m.id} className="chat-panel__line">
            <span className="chat-panel__name">{m.name}:</span> {m.text}
          </div>
        ))}
      </div>
      <div className="chat-panel__input-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Say something…"
          maxLength={240}
        />
        <button className="btn btn--ghost" onClick={submit} disabled={!text.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
