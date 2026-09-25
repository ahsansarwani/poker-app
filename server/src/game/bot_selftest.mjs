import { Table } from "./table.js";
import { decideBotAction } from "./bot.js";

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok -", msg);
}

const t = new Table("BOTTEST", { smallBlind: 10, bigBlind: 20, startingStack: 500 });
t.addPlayer("human", "You");
t.addBot("Bot1");
t.addBot("Bot2");
t.addBot("Bot3");

for (let hand = 0; hand < 30 && t.canStartHand(); hand++) {
  t.startHand();
  let guard = 0;
  while (t.street !== "showdown" && guard < 200) {
    guard++;
    const seatIdx = t.actingSeat;
    if (seatIdx === -1) break;
    const decision = decideBotAction(t, seatIdx) || { action: "fold" };
    assert(t.validActions(seatIdx).includes(decision.action), `hand ${hand + 1}: bot chose a legal action (${decision.action})`);
    t.handleAction(seatIdx, decision.action, decision.amount || 0);
  }
  assert(guard < 200, `hand ${hand + 1} terminated without hanging`);
  const totalChips = t.seats.reduce((s, p) => s + (p ? p.chips : 0), 0);
  assert(totalChips === 2000, `chip conservation after hand ${hand + 1}: ${totalChips}`);
  t.finishHandCleanup();
}

console.log("ALL BOT TESTS PASSED");
