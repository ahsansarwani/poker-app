const RANK_VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

function parseCard(card) {
  return { rank: RANK_VALUE[card[0]], suit: card[1] };
}

function combinations(arr, k) {
  const results = [];
  const combo = [];
  function go(start) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      go(i + 1);
      combo.pop();
    }
  }
  go(0);
  return results;
}

// Returns a comparable array: [category, tiebreak...]. Higher is better.
function evaluate5(cards) {
  const parsed = cards.map(parseCard);
  const ranks = parsed.map((c) => c.rank).sort((a, b) => b - a);
  const suits = parsed.map((c) => c.suit);

  const rankCounts = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
  const groups = Object.entries(rankCounts)
    .map(([rank, count]) => ({ rank: Number(rank), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const isFlush = suits.every((s) => s === suits[0]);

  const uniqueRanksDesc = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = null;
  if (uniqueRanksDesc.length === 5) {
    if (uniqueRanksDesc[0] - uniqueRanksDesc[4] === 4) {
      straightHigh = uniqueRanksDesc[0];
    } else if (uniqueRanksDesc.join(",") === "14,5,4,3,2") {
      straightHigh = 5; // wheel: A-2-3-4-5
    }
  }

  if (straightHigh && isFlush) return [8, straightHigh];
  if (groups[0].count === 4) {
    const kicker = groups.find((g) => g.count === 1).rank;
    return [7, groups[0].rank, kicker];
  }
  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return [6, groups[0].rank, groups[1].rank];
  }
  if (isFlush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].count === 3) {
    const kickers = groups.filter((g) => g.count === 1).map((g) => g.rank);
    return [3, groups[0].rank, ...kickers];
  }
  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const pairRanks = [groups[0].rank, groups[1].rank].sort((a, b) => b - a);
    const kicker = groups.find((g) => g.count === 1).rank;
    return [2, ...pairRanks, kicker];
  }
  if (groups[0].count === 2) {
    const kickers = groups.filter((g) => g.count === 1).map((g) => g.rank);
    return [1, groups[0].rank, ...kickers];
  }
  return [0, ...ranks];
}

export function compareScores(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

const CATEGORY_NAMES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

// cards: array of 5-7 card strings. Returns { score, best5, name }
export function evaluateBestHand(cards) {
  const fives = cards.length <= 5 ? [cards] : combinations(cards, 5);
  let best = null;
  for (const five of fives) {
    const score = evaluate5(five);
    if (!best || compareScores(score, best.score) > 0) {
      best = { score, best5: five };
    }
  }
  return { ...best, name: CATEGORY_NAMES[best.score[0]] };
}

export function compareHands(cardsA, cardsB) {
  const a = evaluateBestHand(cardsA);
  const b = evaluateBestHand(cardsB);
  return compareScores(a.score, b.score);
}
