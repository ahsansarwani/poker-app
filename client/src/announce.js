import { useEffect, useRef, useState } from "react";

const ACTION_WORDS = { fold: "Fold", check: "Check", call: "Call", bet: "Bet", raise: "Raise", play: "Play", callBluff: "Call bluff" };

// Feeds a single polite live region so screen-reader users get spoken updates:
// latest log lines (folds, streets, showdowns) and "your turn" prompts.
export function useAnnouncer(state) {
  const [message, setMessage] = useState("");
  const prevLogLen = useRef(0);
  const prevTurn = useRef(null);


  useEffect(() => {
    if (!state) {
      prevLogLen.current = 0;
      prevTurn.current = null;
      return;
    }
    const log = state.log || [];
    if (log.length < prevLogLen.current) prevLogLen.current = 0; // log reset on new hand

    const fresh = log.slice(prevLogLen.current);
    prevLogLen.current = log.length;

    let msg = fresh.length ? fresh[fresh.length - 1] : "";

    const { yourSeat, actingSeat } = state;
    if (actingSeat !== null && actingSeat === yourSeat && yourSeat !== -1 && prevTurn.current !== actingSeat) {
      msg = turnPrompt(state) || msg;
    }
    prevTurn.current = actingSeat;

    if (msg) setMessage(msg);
  }, [state]);

  return message;
}

function turnPrompt(state) {
  if (state.gameType === "bluff") {
    const last = state.lastPlay;
    let prompt = `Your turn. Required rank ${state.requiredRank}.`;
    if (last) {
      const name = state.seats[last.seat]?.name || "Opponent";
      prompt = `Your turn. ${name} claims ${last.count} cards. You can play more or call bluff.`;
    }
    return prompt;
  }
  const actions = (state.validActions || []).filter((a) => a !== "fold").map((a) => ACTION_WORDS[a] || a);
  if (!actions.length) return "";
  let prompt = "Your turn.";
  if (actions.includes("Check")) prompt += " You can check.";
  else prompt += ` Call is ${state.toCall}.`;
  if (actions.includes("Bet") || actions.includes("Raise")) prompt += " Raise or go all-in if you like.";
  return prompt;
}
