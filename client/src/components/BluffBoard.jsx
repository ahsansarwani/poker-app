import { useState, useEffect } from "react";
import Card from "./Card.jsx";
import VoiceControls from "./VoiceControls.jsx";
import ChatPanel from "./ChatPanel.jsx";
import { seatPosition } from "../seatLayout.js";

const RANK_LABEL = { T: "10" };

export default function BluffBoard({ state, roomId, onStartHand, onAction, onLeave, voice, botVoice, chat }) {
  const [selected, setSelected] = useState([]);
  const you = state.seats[state.yourSeat];
  const isYourTurn = state.actingSeat === state.yourSeat && state.yourSeat !== -1;
  const canStart = state.phase === "waiting" && state.seats.filter(Boolean).length >= 2;

  useEffect(() => setSelected([]), [state.phase, you?.hand?.length]);

  const toggleCard = (idx) => {
    setSelected((sel) => (sel.includes(idx) ? sel.filter((i) => i !== idx) : [...sel, idx]));
  };

  const claimLabel = RANK_LABEL[state.requiredRank] || state.requiredRank;

  return (
    <div className="table-screen">
      <div className="table-header">
        <div>
          Room <strong>{roomId}</strong> &middot; Bluff
        </div>
        <div className="table-header__actions">
          {voice && <VoiceControls voice={voice} botVoice={botVoice} />}
          <button className="btn btn--ghost" onClick={onLeave}>
            Leave table
          </button>
        </div>
      </div>

      <div className="felt">
        <div className="community">
          <div className="pot">Pile: {state.pileCount} cards</div>
          {state.phase === "playing" && (
            <div className="bluff-claim">
              {state.lastPlay
                ? `${state.seats[state.lastPlay.seat]?.name} claims ${state.lastPlay.count}× ${RANK_LABEL[state.lastPlay.claimedRank] || state.lastPlay.claimedRank}`
                : `Next to play must claim ${claimLabel}`}
            </div>
          )}
          {state.phase === "waiting" && (
            <button className="btn btn--start" disabled={!canStart} onClick={onStartHand}>
              Start round
            </button>
          )}
          {state.phase === "roundOver" && state.winner !== null && (
            <div className="result-banner">{state.seats[state.winner]?.name} emptied their hand and wins!</div>
          )}
        </div>

        {state.seats.map((seat, i) => {
          if (!seat) return null;
          const pos = seatPosition(i, state.yourSeat);
          const isActing = state.actingSeat === i;
          const isSpeaking = voice && (seat.isYou ? voice.micOn && voice.localSpeaking : voice.remoteSpeaking.has(i));
          const isVoiceMuted = voice && !seat.isYou && voice.remoteMuted.has(i);
          return (
            <div className={`seat ${isActing ? "seat--active" : ""} ${isSpeaking ? "seat--speaking" : ""}`} style={pos} key={i}>
              <div className="seat__info">
                <div className="seat__name">
                  <span>{seat.name}</span>
                  {seat.isYou && <span className="tag tag--you">you</span>}
                  {seat.isBot && <span className="tag tag--bot">bot</span>}
                  {seat.connected === false && <span className="tag tag--away">away</span>}
                  {seat.waiting && <span className="tag tag--bot">next round</span>}
                  {isVoiceMuted && <span className="mic-icon mic-icon--muted" title="Muted">🔇</span>}
                </div>
                <div className="seat__chips">{seat.cardCount} card{seat.cardCount === 1 ? "" : "s"}</div>
              </div>
              {!seat.isYou && (
                <div className="seat__cards seat__cards--wrap">
                  {Array.from({ length: seat.cardCount }).map((_, idx) => (
                    <Card key={idx} code="??" small />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="action-bar">
        {!isYourTurn && <span className="action-bar--waiting">Waiting for other players&hellip;</span>}
        {isYourTurn && (
          <>
            {state.validActions.includes("callBluff") && (
              <button className="btn btn--fold" onClick={() => onAction("callBluff", {})}>
                Call Bluff
              </button>
            )}
            <button
              className="btn btn--primary"
              disabled={selected.length === 0}
              onClick={() => {
                onAction("play", { cardIndexes: selected });
                setSelected([]);
              }}
            >
              Play {selected.length || ""} as {claimLabel}
            </button>
          </>
        )}
      </div>

      <div className="hand hand--yours">
        {(you?.hand || []).map((code, idx) => (
          <div
            key={idx}
            className={`hand__card ${selected.includes(idx) ? "hand__card--selected" : ""}`}
            onClick={() => toggleCard(idx)}
          >
            <Card code={code} />
          </div>
        ))}
      </div>

      <div className="table-bottom">
        <div className="log">
          {state.log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        {chat && <ChatPanel chat={chat} />}
      </div>
    </div>
  );
}
