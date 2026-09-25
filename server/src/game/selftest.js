import { evaluateBestHand, compareScores } from "./handEvaluator.js";
import { Table } from "./table.js";

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok -", msg);
}

// Hand evaluator checks
const royal = evaluateBestHand(["As", "Ks", "Qs", "Js", "Ts", "2h", "3d"]);
assert(royal.name === "Straight Flush", "royal flush detected as straight flush");

const quad = evaluateBestHand(["7s", "7h", "7d", "7c", "2h", "3d", "4s"]);
assert(quad.name === "Four of a Kind", "quads detected");

const wheel = evaluateBestHand(["As", "2h", "3d", "4c", "5s", "9h", "Kd"]);
assert(wheel.name === "Straight" && wheel.score[1] === 5, "wheel straight (A-2-3-4-5) high card 5");

const fh = evaluateBestHand(["Ks", "Kh", "Kd", "2c", "2h", "9s", "3d"]);
assert(fh.name === "Full House", "full house detected");

const better = evaluateBestHand(["As", "Ah", "Ad", "Kh", "Kd", "2s", "3c"]);
const worse = evaluateBestHand(["Qs", "Qh", "Qd", "Jh", "Jd", "2s", "3c"]);
assert(compareScores(better.score, worse.score) > 0, "AAAKK beats QQQJJ");

// Full hand simulation: 3 players, run several hands to completion
const t = new Table("TEST", { smallBlind: 10, bigBlind: 20, startingStack: 500 });
t.addPlayer("p1", "Alice");
t.addPlayer("p2", "Bob");
t.addPlayer("p3", "Carol");

for (let hand = 0; hand < 20 && t.canStartHand(); hand++) {
  t.startHand();
  assert(t.street === "preflop", `hand ${hand + 1} starts preflop`);
  let guard = 0;
  while (t.street !== "showdown" && guard < 200) {
    guard++;
    const seatIdx = t.actingSeat;
    if (seatIdx === -1) break;
    const actions = t.validActions(seatIdx);
    assert(actions.length > 0, "acting seat has valid actions");
    // simple bot: check/call most of the time, occasionally fold
    let action = actions.includes("check") ? "check" : "call";
    if (Math.random() < 0.08 && actions.includes("fold")) action = "fold";
    t.handleAction(seatIdx, action);
  }
  assert(guard < 200, `hand ${hand + 1} terminated (no infinite loop)`);
  const totalChips = t.seats.reduce((s, p) => s + (p ? p.chips : 0), 0);
  assert(totalChips === 1500, `chip conservation after hand ${hand + 1}: ${totalChips}`);
  t.finishHandCleanup();
}

console.log("ALL TESTS PASSED");
