import { freshDeck, shuffle } from "./deck.js";
import { evaluateBestHand, compareScores as compare } from "./handEvaluator.js";

export const MAX_SEATS = 6;

function emptySeat() {
  return null;
}

export class Table {
  constructor(id, { smallBlind = 10, bigBlind = 20, startingStack = 1000 } = {}) {
    this.id = id;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.startingStack = startingStack;
    this.seats = Array.from({ length: MAX_SEATS }, emptySeat);
    this.buttonSeat = -1;
    this.deck = [];
    this.communityCards = [];
    this.street = "waiting"; // waiting | preflop | flop | turn | river | showdown
    this.currentBet = 0;
    this.minRaise = bigBlind;
    this.actingSeat = -1;
    this.toActSeats = new Set();
    this.handNumber = 0;
    this.log = [];
    this.pots = [];
    this.lastResult = null;
  }

  occupiedSeats() {
    const out = [];
    for (let i = 0; i < this.seats.length; i++) if (this.seats[i]) out.push(i);
    return out;
  }

  seatsWithChips() {
    return this.occupiedSeats().filter((i) => this.seats[i].chips > 0);
  }

  addPlayer(id, name, isBot = false) {
    const freeSeat = this.seats.findIndex((s) => s === null);
    if (freeSeat === -1) return null;
    this.seats[freeSeat] = {
      id,
      name,
      chips: this.startingStack,
      holeCards: [],
      folded: false,
      allIn: false,
      currentBetThisRound: 0,
      totalBetThisHand: 0,
      connected: true,
      sittingOut: false,
      isBot,
    };
    return freeSeat;
  }

  addBot(name) {
    const id = `bot-${Math.random().toString(36).slice(2, 10)}`;
    return this.addPlayer(id, name, true);
  }

  removePlayer(id) {
    const idx = this.seats.findIndex((s) => s && s.id === id);
    if (idx === -1) return;
    if (this.street !== "waiting" && this.street !== "showdown") {
      // Keep the seat until the hand ends: its chips are already in the pot, which is summed from seats.
      const p = this.seats[idx];
      p.left = true;
      p.connected = false;
      p.sittingOut = true;
      if (p.folded) return;
      p.folded = true;
      this.toActSeats.delete(idx);
      this.addLog(`${p.name} left the table and folds`);
      if (this._checkForEarlyWin()) return;
      if (this.actingSeat === idx) this._advanceTurn();
    } else {
      this.seats[idx] = null;
    }
  }

  addLog(message) {
    this.log.push(message);
    if (this.log.length > 100) this.log.shift();
  }

  canStartHand() {
    return this.seatsWithChips().length >= 2 && this.street === "waiting";
  }

  nextSeat(from, predicate) {
    const n = this.seats.length;
    for (let step = 1; step <= n; step++) {
      const idx = (from + step) % n;
      if (this.seats[idx] && predicate(this.seats[idx], idx)) return idx;
    }
    return -1;
  }

  startHand() {
    this.handNumber += 1;
    const active = this.seatsWithChips();
    for (const i of this.occupiedSeats()) {
      const p = this.seats[i];
      p.folded = p.chips <= 0;
      p.sittingOut = p.chips <= 0;
      p.allIn = false;
      p.currentBetThisRound = 0;
      p.totalBetThisHand = 0;
      p.holeCards = [];
    }

    this.buttonSeat =
      this.buttonSeat === -1
        ? active[0]
        : this.nextSeat(this.buttonSeat, (p) => p.chips > 0) ?? active[0];

    this.deck = shuffle(freshDeck());
    this.communityCards = [];
    this.pots = [];
    this.lastResult = null;
    this.log = [];

    const headsUp = active.length === 2;
    const sbSeat = headsUp ? this.buttonSeat : this.nextSeat(this.buttonSeat, (p) => p.chips > 0);
    const bbSeat = this.nextSeat(sbSeat, (p) => p.chips > 0);

    this._postBlind(sbSeat, this.smallBlind);
    this._postBlind(bbSeat, this.bigBlind);
    this.addLog(`${this.seats[sbSeat].name} posts small blind ${this.smallBlind}`);
    this.addLog(`${this.seats[bbSeat].name} posts big blind ${this.bigBlind}`);

    let dealSeat = this.nextSeat(bbSeat, (p) => !p.sittingOut);
    for (let round = 0; round < 2; round++) {
      let s = dealSeat;
      do {
        this.seats[s].holeCards.push(this.deck.pop());
        s = this.nextSeat(s, (p) => !p.sittingOut);
      } while (s !== dealSeat);
    }

    this.street = "preflop";
    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;

    this.actingSeat = headsUp ? sbSeat : this.nextSeat(bbSeat, (p) => !p.folded && !p.allIn);
    this.toActSeats = new Set(
      this.occupiedSeats().filter((i) => !this.seats[i].folded && !this.seats[i].allIn)
    );
  }

  _postBlind(seatIndex, amount) {
    const p = this.seats[seatIndex];
    const pay = Math.min(amount, p.chips);
    p.chips -= pay;
    p.currentBetThisRound += pay;
    p.totalBetThisHand += pay;
    if (p.chips === 0) p.allIn = true;
  }

  validActions(seatIndex) {
    const p = this.seats[seatIndex];
    if (!p || p.folded || p.allIn || this.actingSeat !== seatIndex) return [];
    const toCall = this.currentBet - p.currentBetThisRound;
    const actions = ["fold"];
    if (toCall <= 0) actions.push("check");
    else actions.push("call");
    if (p.chips > toCall) actions.push(this.currentBet === 0 ? "bet" : "raise");
    return actions;
  }

  handleAction(seatIndex, action, amount = 0) {
    if (this.actingSeat !== seatIndex) throw new Error("Not your turn");
    const p = this.seats[seatIndex];
    const toCall = this.currentBet - p.currentBetThisRound;

    if (action === "fold") {
      p.folded = true;
      this.toActSeats.delete(seatIndex);
      this.addLog(`${p.name} folds`);
    } else if (action === "check") {
      if (toCall > 0) throw new Error("Cannot check, must call or fold");
      this.toActSeats.delete(seatIndex);
      this.addLog(`${p.name} checks`);
    } else if (action === "call") {
      const pay = Math.min(toCall, p.chips);
      p.chips -= pay;
      p.currentBetThisRound += pay;
      p.totalBetThisHand += pay;
      if (p.chips === 0) p.allIn = true;
      this.toActSeats.delete(seatIndex);
      this.addLog(`${p.name} calls ${pay}`);
    } else if (action === "bet" || action === "raise") {
      const targetTotal = p.currentBetThisRound + amount;
      const raiseSize = targetTotal - this.currentBet;
      const isAllIn = amount >= p.chips;
      if (!isAllIn && raiseSize < this.minRaise) {
        throw new Error(`Raise must be at least ${this.minRaise}`);
      }
      const pay = Math.min(amount, p.chips);
      p.chips -= pay;
      p.currentBetThisRound += pay;
      p.totalBetThisHand += pay;
      if (p.chips === 0) p.allIn = true;
      if (p.currentBetThisRound > this.currentBet) {
        this.minRaise = Math.max(this.minRaise, p.currentBetThisRound - this.currentBet);
        this.currentBet = p.currentBetThisRound;
        this.toActSeats = new Set(
          this.occupiedSeats().filter(
            (i) => i !== seatIndex && !this.seats[i].folded && !this.seats[i].allIn
          )
        );
      } else {
        this.toActSeats.delete(seatIndex);
      }
      this.addLog(`${p.name} ${action}s to ${p.currentBetThisRound}`);
    } else {
      throw new Error("Unknown action");
    }

    if (this._checkForEarlyWin()) return;
    this._advanceTurn();
  }

  _checkForEarlyWin() {
    const remaining = this.occupiedSeats().filter((i) => !this.seats[i].folded);
    if (remaining.length === 1) {
      this._awardPotsUncontested(remaining[0]);
      return true;
    }
    return false;
  }

  _awardPotsUncontested(winnerSeat) {
    const potTotal = this.occupiedSeats().reduce((s, i) => s + this.seats[i].totalBetThisHand, 0);
    this.seats[winnerSeat].chips += potTotal;
    this.lastResult = {
      pots: [{ amount: potTotal, winners: [winnerSeat], handName: null }],
      revealed: {},
    };
    this.addLog(`${this.seats[winnerSeat].name} wins ${potTotal} (all others folded)`);
    this.street = "showdown";
    this.actingSeat = -1;
    this.toActSeats.clear();
  }

  _advanceTurn() {
    if (this.toActSeats.size === 0) {
      this._advanceStreet();
      return;
    }
    const next = this.nextSeat(
      this.actingSeat,
      (p, i) => this.toActSeats.has(i) && !p.folded && !p.allIn
    );
    this.actingSeat = next;
  }

  _advanceStreet() {
    for (const i of this.occupiedSeats()) this.seats[i].currentBetThisRound = 0;
    this.currentBet = 0;
    this.minRaise = this.bigBlind;

    const contestants = this.occupiedSeats().filter((i) => !this.seats[i].folded);
    const canAct = contestants.filter((i) => !this.seats[i].allIn);

    if (this.street === "preflop") {
      this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      this.street = "flop";
    } else if (this.street === "flop") {
      this.communityCards.push(this.deck.pop());
      this.street = "turn";
    } else if (this.street === "turn") {
      this.communityCards.push(this.deck.pop());
      this.street = "river";
    } else if (this.street === "river") {
      this._showdown();
      return;
    }
    this.addLog(`-- ${this.street} --`);

    if (canAct.length < 2) {
      // everyone left is all-in (or only one can act): run out remaining streets
      this.actingSeat = -1;
      this.toActSeats.clear();
      this._advanceStreet();
      return;
    }

    this.actingSeat = this.nextSeat(this.buttonSeat, (p, i) => canAct.includes(i));
    this.toActSeats = new Set(canAct);
  }

  _showdown() {
    this.street = "showdown";
    const contestants = this.occupiedSeats().filter((i) => !this.seats[i].folded);
    const contributors = this.occupiedSeats().map((i) => ({
      seat: i,
      total: this.seats[i].totalBetThisHand,
      folded: this.seats[i].folded,
    }));

    const levels = [...new Set(contributors.filter((c) => !c.folded).map((c) => c.total))].sort(
      (a, b) => a - b
    );
    const pots = [];
    let prev = 0;
    for (const level of levels) {
      const amount = contributors.reduce(
        (sum, c) => sum + (Math.min(c.total, level) - Math.min(c.total, prev)),
        0
      );
      const eligible = contributors.filter((c) => !c.folded && c.total >= level).map((c) => c.seat);
      if (amount > 0) pots.push({ amount, eligible });
      prev = level;
    }

    const hands = {};
    for (const i of contestants) {
      hands[i] = evaluateBestHand([...this.seats[i].holeCards, ...this.communityCards]);
    }

    const results = [];
    for (const pot of pots) {
      let winners = [pot.eligible[0]];
      for (const seat of pot.eligible.slice(1)) {
        const cmp = compare(hands[seat].score, hands[winners[0]].score);
        if (cmp > 0) winners = [seat];
        else if (cmp === 0) winners.push(seat);
      }
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      for (const w of winners) {
        this.seats[w].chips += share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
      }
      results.push({ amount: pot.amount, winners, handName: hands[winners[0]].name });
      for (const w of winners) {
        this.addLog(`${this.seats[w].name} wins ${share} with ${hands[winners[0]].name}`);
      }
    }

    const revealed = {};
    for (const i of contestants) revealed[i] = this.seats[i].holeCards;

    this.lastResult = { pots: results, revealed };
    this.actingSeat = -1;
    this.toActSeats.clear();
  }

  finishHandCleanup() {
    for (const i of this.occupiedSeats()) {
      if (this.seats[i].chips <= 0 || this.seats[i].left) {
        this.seats[i] = null;
      }
    }
    this.street = "waiting";
  }

  getPublicState(viewerId) {
    const seats = this.seats.map((p, i) => {
      if (!p) return null;
      const showCards =
        p.id === viewerId ||
        this.street === "showdown" ||
        (this.lastResult && this.lastResult.revealed && this.lastResult.revealed[i]);
      return {
        seat: i,
        name: p.name,
        chips: p.chips,
        folded: p.folded,
        allIn: p.allIn,
        currentBetThisRound: p.currentBetThisRound,
        connected: p.connected,
        isYou: p.id === viewerId,
        isBot: p.isBot,
        holeCards: showCards ? p.holeCards : p.holeCards.map(() => "??"),
      };
    });

    return {
      gameType: "holdem",
      tableId: this.id,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      seats,
      buttonSeat: this.buttonSeat,
      communityCards: this.communityCards,
      street: this.street,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      actingSeat: this.actingSeat,
      pot: this.occupiedSeats().reduce((s, i) => s + this.seats[i].totalBetThisHand, 0),
      log: this.log.slice(-20),
      lastResult: this.lastResult,
      yourSeat: this.seats.findIndex((p) => p && p.id === viewerId),
      validActions: (() => {
        const idx = this.seats.findIndex((p) => p && p.id === viewerId);
        return idx === -1 ? [] : this.validActions(idx);
      })(),
      toCall: (() => {
        const idx = this.seats.findIndex((p) => p && p.id === viewerId);
        if (idx === -1) return 0;
        return Math.max(0, this.currentBet - this.seats[idx].currentBetThisRound);
      })(),
    };
  }
}
