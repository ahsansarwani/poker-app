import { evaluateBestHand } from "./handEvaluator.js";

const RANK_VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

function preflopStrength(holeCards) {
  const [a, b] = holeCards;
  const r1 = RANK_VALUE[a[0]];
  const r2 = RANK_VALUE[b[0]];
  const suited = a[1] === b[1];
  const pair = r1 === r2;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const gap = high - low;

  let score = high + low;
  if (pair) score += 20;
  if (suited) score += 5;
  if (gap <= 1) score += 3;
  else if (gap <= 3) score += 1;
  return Math.min(1, score / 48);
}

function handStrength(table, seatIndex) {
  const p = table.seats[seatIndex];
  if (table.communityCards.length === 0) return preflopStrength(p.holeCards);
  const result = evaluateBestHand([...p.holeCards, ...table.communityCards]);
  return Math.min(1, result.score[0] / 8);
}

function raiseAmount(table, seatIndex, strength) {
  const p = table.seats[seatIndex];
  const target = table.minRaise * (1 + Math.round(strength * 3));
  const wanted = table.currentBet + target - p.currentBetThisRound;
  return Math.max(1, Math.min(p.chips, wanted));
}

// Returns { action, amount } for a bot seat, or null if it has no legal move.
export function decideBotAction(table, seatIndex) {
  const actions = table.validActions(seatIndex);
  if (actions.length === 0) return null;

  const p = table.seats[seatIndex];
  const toCall = table.currentBet - p.currentBetThisRound;
  const strength = handStrength(table, seatIndex);
  const canRaise = actions.includes("bet") || actions.includes("raise");
  const roll = Math.random();

  if (actions.includes("check")) {
    if (strength > 0.65 && canRaise && roll < 0.45) {
      return { action: actions.includes("bet") ? "bet" : "raise", amount: raiseAmount(table, seatIndex, strength) };
    }
    return { action: "check" };
  }

  const cheapCall = toCall <= table.bigBlind * 2;
  if (strength > 0.8 && canRaise && roll < 0.5) {
    return { action: "raise", amount: raiseAmount(table, seatIndex, strength) };
  }
  if (strength > 0.45 || cheapCall || roll < 0.12) {
    return { action: "call" };
  }
  return { action: "fold" };
}
