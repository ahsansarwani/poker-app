import { useState, useEffect } from "react";

export default function ActionBar({ state, you, onAction }) {
  const isYourTurn = state.actingSeat === you.seat && you.seat !== -1;
  const minRaiseTotal = state.currentBet + state.minRaise;
  const maxBet = you.chips + you.currentBetThisRound;
  const [amount, setAmount] = useState(minRaiseTotal);

  useEffect(() => {
    setAmount(Math.min(minRaiseTotal, maxBet));
  }, [state.currentBet, state.minRaise]);

  if (!isYourTurn) {
    return <div className="action-bar action-bar--waiting">Waiting for other players…</div>;
  }

  const actions = state.validActions;
  const canRaise = actions.includes("bet") || actions.includes("raise");

  return (
    <div className="action-bar">
      {actions.includes("fold") && (
        <button className="btn btn--fold" onClick={() => onAction("fold")}>
          Fold
        </button>
      )}
      {actions.includes("check") && (
        <button className="btn" onClick={() => onAction("check")}>
          Check
        </button>
      )}
      {actions.includes("call") && (
        <button className="btn btn--call" onClick={() => onAction("call")}>
          Call {state.toCall}
        </button>
      )}
      {canRaise && (
        <div className="raise-controls">
          <input
            type="range"
            min={minRaiseTotal}
            max={maxBet}
            value={Math.min(amount, maxBet)}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label="Raise amount"
          />
          <input
            type="number"
            min={minRaiseTotal}
            max={maxBet}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label="Raise amount"
          />
          <button
            className="btn btn--raise"
            onClick={() => onAction(actions.includes("bet") ? "bet" : "raise", amount - you.currentBetThisRound)}
          >
            {actions.includes("bet") ? "Bet" : "Raise to"} {amount}
          </button>
          <button className="btn btn--allin" onClick={() => onAction(actions.includes("bet") ? "bet" : "raise", you.chips)}>
            All-in
          </button>
        </div>
      )}
    </div>
  );
}
