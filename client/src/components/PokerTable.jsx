import Card from "./Card.jsx";
import ActionBar from "./ActionBar.jsx";

const SEAT_POSITIONS = [
  { bottom: "2%", left: "50%", transform: "translateX(-50%)" },
  { bottom: "20%", left: "5%" },
  { top: "20%", left: "10%" },
  { top: "2%", left: "50%", transform: "translateX(-50%)" },
  { top: "20%", right: "10%" },
  { bottom: "20%", right: "5%" },
];

export default function PokerTable({ state, roomId, onStartHand, onAction, onLeave }) {
  const you = state.seats[state.yourSeat] || { chips: 0, currentBetThisRound: 0, seat: -1 };
  const canStart = state.street === "waiting" && state.seats.filter(Boolean).length >= 2;

  return (
    <div className="table-screen">
      <div className="table-header">
        <div>
          Room <strong>{roomId}</strong> · Blinds {state.smallBlind}/{state.bigBlind}
        </div>
        <button className="btn btn--ghost" onClick={onLeave}>
          Leave table
        </button>
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
          const pos = SEAT_POSITIONS[i % SEAT_POSITIONS.length];
          const isButton = state.buttonSeat === i;
          const isActing = state.actingSeat === i;
          return (
            <div className={`seat ${isActing ? "seat--active" : ""}`} style={pos} key={i}>
              {isButton && <div className="dealer-chip">D</div>}
              <div className={`seat__info ${seat.folded ? "seat__info--folded" : ""}`}>
                <div className="seat__name">
                  {seat.name} {seat.isYou ? "(you)" : ""}
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

      <div className="log">
        {state.log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
