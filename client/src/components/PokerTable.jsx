import Card from "./Card.jsx";
import ActionBar from "./ActionBar.jsx";
import VoiceControls from "./VoiceControls.jsx";
import ChatPanel from "./ChatPanel.jsx";
import { seatPosition } from "../seatLayout.js";

export default function PokerTable({ state, roomId, onStartHand, onAction, onLeave, voice, botVoice, chat }) {
  const you = state.seats[state.yourSeat] || { chips: 0, currentBetThisRound: 0, seat: -1 };
  const canStart = state.street === "waiting" && state.seats.filter(Boolean).length >= 2;

  return (
    <div className="table-screen">
      <div className="table-header">
        <div>
          Room <strong>{roomId}</strong> · Blinds {state.smallBlind}/{state.bigBlind}
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
          <div className="pot">Pot: {state.pot}</div>
          <div className="community__cards">
            {state.communityCards.map((c, i) => (
              <Card key={i} code={c} />
            ))}
          </div>
          {state.street === "waiting" && (
            <button className="btn btn--start" disabled={!canStart} onClick={onStartHand}>
              Start hand
            </button>
          )}
          {state.lastResult && (
            <div className="result-banner">
              {state.lastResult.pots.map((p, i) => (
                <div key={i}>
                  {p.winners.map((w) => state.seats[w]?.name).join(", ")} won {p.amount}
                  {p.handName ? ` with ${p.handName}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>

        {state.seats.map((seat, i) => {
          if (!seat) return null;
          const pos = seatPosition(i, state.yourSeat);
          const isButton = state.buttonSeat === i;
          const isActing = state.actingSeat === i;
          const isSpeaking = voice && (seat.isYou ? voice.micOn && voice.localSpeaking : voice.remoteSpeaking.has(i));
          const isVoiceMuted = voice && !seat.isYou && voice.remoteMuted.has(i);
          return (
            <div className={`seat ${isActing ? "seat--active" : ""} ${isSpeaking ? "seat--speaking" : ""}`} style={pos} key={i}>
              {isButton && <div className="dealer-chip" aria-hidden="true">D</div>}
              <div className={`seat__info ${seat.folded ? "seat__info--folded" : ""}`}>
                <div className="seat__name">
                  <span>{seat.name}</span>
                  {seat.isYou && <span className="tag tag--you">you</span>}
                  {seat.isBot && <span className="tag tag--bot">bot</span>}
                  {seat.connected === false && <span className="tag tag--away">away</span>}
                  {seat.waiting && <span className="tag tag--bot">next hand</span>}
                  {isVoiceMuted && <span className="mic-icon mic-icon--muted" role="img" aria-label="Muted">🔇</span>}
                </div>
                <div className="seat__chips">{seat.chips}</div>
                {seat.currentBetThisRound > 0 && <div className="seat__bet">bet {seat.currentBetThisRound}</div>}
              </div>
              <div className="seat__cards">
                {seat.holeCards.map((c, idx) => (
                  <Card key={idx} code={c} small />
                ))}
              </div>
              {seat.allIn && <div className="tag tag--allin">ALL IN</div>}
            </div>
          );
        })}
      </div>

      <ActionBar state={state} you={{ ...you, seat: state.yourSeat }} onAction={onAction} />

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
