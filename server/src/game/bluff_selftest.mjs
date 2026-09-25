import { BluffGame } from "./bluff.js";
import { decideBluffBotAction } from "./bluff_bot.js";

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok -", msg);
}

function totalCards(game) {
  const inHands = game.occupiedSeats().reduce((s, i) => s + game.seats[i].hand.length, 0);
  return inHands + game.pile.length;
}

const g = new BluffGame("BLUFFTEST");
g.addPlayer("p1", "Alice");
g.addBot("Bob");
g.addBot("Carol");
g.addBot("Dave");

for (let round = 0; round < 5 && g.canStart(); round++) {
  g.start();
  assert(g.phase === "playing", `round ${round + 1} starts playing`);
  assert(totalCards(g) === 52, `round ${round + 1}: 52 cards dealt`);

  let guard = 0;
  while (g.phase === "playing" && guard < 2000) {
    guard++;
    const seatIdx = g.actingSeat;
    if (seatIdx === -1) break;
    const decision = decideBluffBotAction(g, seatIdx);
    assert(decision !== null, `round ${round + 1}, turn ${guard}: bot has a legal action`);
    assert(g.validActions(seatIdx).includes(decision.action), `round ${round + 1}, turn ${guard}: bot chose legal action (${decision.action})`);
    g.handleAction(seatIdx, decision.action, decision.payload);
    assert(totalCards(g) === 52, `round ${round + 1}, turn ${guard}: card conservation (52 total)`);
  }
  assert(guard < 2000, `round ${round + 1} terminated without hanging (${guard} turns)`);
  assert(g.phase === "roundOver", `round ${round + 1} reached roundOver`);
  assert(g.winner !== null, `round ${round + 1} has a winner: seat ${g.winner}`);
  g.finishRoundCleanup();
}

console.log("ALL BLUFF TESTS PASSED");
