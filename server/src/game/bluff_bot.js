function rankOf(card) {
  return card.slice(0, -1);
}

// Returns { action, payload } for a bot seat in a Bluff game.
export function decideBluffBotAction(game, seatIndex) {
  const actions = game.validActions(seatIndex);
  if (actions.length === 0) return null;
  const seat = game.seats[seatIndex];
  const hand = seat.hand;

  if (actions.includes("callBluff")) {
    const { claimedRank, count } = game.lastPlay;
    const ownCopies = hand.filter((c) => rankOf(c) === claimedRank).length;
    const unseenCopies = 4 - ownCopies;
    if (count > unseenCopies) {
      // Mathematically impossible for the claim to be true.
      return { action: "callBluff", payload: {} };
    }
    const suspicion = Math.min(0.85, 0.12 * count + ownCopies * 0.15);
    if (Math.random() < suspicion) {
      return { action: "callBluff", payload: {} };
    }
  }

  const matching = hand
    .map((c, i) => ({ i, rank: rankOf(c) }))
    .filter((c) => c.rank === game.requiredRank);

  if (matching.length > 0) {
    const playCount = Math.min(matching.length, Math.random() < 0.7 ? 1 : matching.length);
    return { action: "play", payload: { cardIndexes: matching.slice(0, playCount).map((c) => c.i) } };
  }

  // No truthful option — bluff with junk cards.
  const bluffCount = Math.min(hand.length, 1 + (Math.random() < 0.25 ? 1 : 0));
  const indexes = hand.map((_, i) => i).slice(0, bluffCount);
  return { action: "play", payload: { cardIndexes: indexes } };
}

// Timeout fallback for an inactive human: never gamble on a bluff call, just play safely.
export function bluffAutoAction(game, seatIndex) {
  const seat = game.seats[seatIndex];
  const hand = seat.hand;
  const matching = hand.map((c, i) => ({ i, rank: rankOf(c) })).filter((c) => c.rank === game.requiredRank);
  if (matching.length > 0) return { action: "play", payload: { cardIndexes: [matching[0].i] } };
  return { action: "play", payload: { cardIndexes: [0] } };
}
