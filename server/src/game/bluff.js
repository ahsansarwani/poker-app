import { freshDeck, shuffle, RANKS } from "./deck.js";

export const MAX_SEATS = 6;
const MIN_PLAYERS = 2;

function nextRank(rank) {
  const idx = RANKS.indexOf(rank);
  return RANKS[(idx + 1) % RANKS.length];
}

function rankOf(card) {
  return card.slice(0, -1);
}

export class BluffGame {
  constructor(id, _options = {}) {
    this.id = id;
    this.gameType = "bluff";
    this.seats = Array.from({ length: MAX_SEATS }, () => null);
    this.phase = "waiting"; // waiting | playing | roundOver
    this.pile = [];
    this.requiredRank = "2";
    this.lastPlay = null; // { seat, cards, claimedRank, count }
    this.awaitingConfirmation = null; // seat index of a player who emptied their hand, not yet confirmed
    this.actingSeat = -1;
    this.winner = null;
    this.log = [];
  }

  occupiedSeats() {
    const out = [];
    for (let i = 0; i < this.seats.length; i++) if (this.seats[i]) out.push(i);
    return out;
  }

  addPlayer(id, name, isBot = false) {
    const freeSeat = this.seats.findIndex((s) => s === null);
    if (freeSeat === -1) return null;
    this.seats[freeSeat] = { id, name, isBot, hand: [], connected: true };
    return freeSeat;
  }

  addBot(name) {
    const id = `bot-${Math.random().toString(36).slice(2, 10)}`;
    return this.addPlayer(id, name, true);
  }

  removePlayer(id) {
    const idx = this.seats.findIndex((s) => s && s.id === id);
    if (idx === -1) return;
    if (this.phase === "playing") {
      // Mid-round leave: pull their cards out of play entirely (simplest safe behavior).
      this.seats[idx] = null;
      if (this.lastPlay?.seat === idx) this.lastPlay = null;
      if (this.awaitingConfirmation === idx) this.awaitingConfirmation = null;
      if (this.actingSeat === idx) this.actingSeat = this._nextOccupiedSeat(idx);
      if (this.occupiedSeats().length < MIN_PLAYERS) this._endRound(this.occupiedSeats()[0] ?? null);
    } else {
      this.seats[idx] = null;
    }
  }

  addLog(message) {
    this.log.push(message);
    if (this.log.length > 100) this.log.shift();
  }

  canStart() {
    return this.occupiedSeats().length >= MIN_PLAYERS && this.phase !== "playing";
  }

  start() {
    const seatIdxs = this.occupiedSeats();
    for (const i of seatIdxs) this.seats[i].hand = [];
    const deck = shuffle(freshDeck());
    let s = 0;
    while (deck.length) {
      this.seats[seatIdxs[s % seatIdxs.length]].hand.push(deck.pop());
      s++;
    }
    this.pile = [];
    this.requiredRank = "2";
    this.lastPlay = null;
    this.awaitingConfirmation = null;
    this.winner = null;
    this.log = [];
    this.phase = "playing";
    this.actingSeat = seatIdxs[0];
    this.addLog("New round dealt. First to play claims a 2.");
  }

  finishRoundCleanup() {
    // Nothing persists between rounds (no chip economy) — seats stay put for a rematch.
    this.phase = "waiting";
  }

  _nextOccupiedSeat(from) {
    const n = this.seats.length;
    for (let step = 1; step <= n; step++) {
      const idx = (from + step) % n;
      if (this.seats[idx]) return idx;
    }
    return -1;
  }

  validActions(seatIndex) {
    if (this.phase !== "playing" || this.actingSeat !== seatIndex) return [];
    const actions = ["play"];
    if (this.lastPlay) actions.push("callBluff");
    return actions;
  }

  _endRound(winnerSeat) {
    this.phase = "roundOver";
    this.winner = winnerSeat;
    this.actingSeat = -1;
    if (winnerSeat !== null) {
      this.addLog(`${this.seats[winnerSeat].name} wins the round!`);
    }
  }

  handleAction(seatIndex, action, payload = {}) {
    if (this.actingSeat !== seatIndex) throw new Error("Not your turn");
    const seat = this.seats[seatIndex];

    if (action === "callBluff") {
      if (!this.lastPlay) throw new Error("Nothing to call bluff on");
      const { seat: playerSeatIdx, cards, claimedRank } = this.lastPlay;
      const wasTruthful = cards.every((c) => rankOf(c) === claimedRank);
      const pileCards = this.pile.splice(0, this.pile.length);
      const playerName = this.seats[playerSeatIdx].name;

      if (wasTruthful) {
        seat.hand.push(...pileCards);
        this.addLog(`${seat.name} called bluff on ${playerName} — it was TRUE. ${seat.name} picks up ${pileCards.length} cards.`);
        if (this.awaitingConfirmation === playerSeatIdx) {
          this._endRound(playerSeatIdx);
          return;
        }
      } else {
        this.seats[playerSeatIdx].hand.push(...pileCards);
        this.addLog(`${seat.name} called bluff on ${playerName} — it was a LIE! ${playerName} picks up ${pileCards.length} cards.`);
        if (this.awaitingConfirmation === playerSeatIdx) this.awaitingConfirmation = null;
      }

      this.lastPlay = null;
      this.requiredRank = nextRank(this.requiredRank);
      this.actingSeat = this._nextOccupiedSeat(seatIndex);
      return;
    }

    if (action === "play") {
      if (this.awaitingConfirmation !== null && this.awaitingConfirmation !== seatIndex) {
        // Previous player's win goes unchallenged — confirm it now, ignore this new play.
        const winnerSeat = this.awaitingConfirmation;
        this._endRound(winnerSeat);
        return;
      }

      const idxs = [...new Set(payload.cardIndexes || [])].sort((a, b) => b - a);
      if (idxs.length === 0) throw new Error("Select at least one card to play");
      if (idxs.some((i) => i < 0 || i >= seat.hand.length)) throw new Error("Invalid card selection");

      const cards = idxs.map((i) => seat.hand[i]);
      for (const i of idxs) seat.hand.splice(i, 1);

      this.pile.push(...cards);
      this.lastPlay = { seat: seatIndex, cards, claimedRank: this.requiredRank, count: cards.length };
      this.addLog(`${seat.name} plays ${cards.length} card${cards.length > 1 ? "s" : ""}, claiming ${this.requiredRank}${cards.length > 1 ? "s" : ""}.`);

      const emptied = seat.hand.length === 0;
      this.requiredRank = nextRank(this.requiredRank);
      this.actingSeat = this._nextOccupiedSeat(seatIndex);
      this.awaitingConfirmation = emptied ? seatIndex : null;
      return;
    }

    throw new Error("Unknown action");
  }

  getPublicState(viewerId) {
    const viewerSeat = this.seats.findIndex((p) => p && p.id === viewerId);
    const seats = this.seats.map((p, i) => {
      if (!p) return null;
      return {
        seat: i,
        name: p.name,
        isBot: p.isBot,
        isYou: p.id === viewerId,
        cardCount: p.hand.length,
        hand: i === viewerSeat ? p.hand : undefined,
      };
    });

    return {
      gameType: "bluff",
      tableId: this.id,
      seats,
      phase: this.phase,
      pileCount: this.pile.length,
      requiredRank: this.requiredRank,
      lastPlay: this.lastPlay
        ? { seat: this.lastPlay.seat, count: this.lastPlay.count, claimedRank: this.lastPlay.claimedRank }
        : null,
      actingSeat: this.actingSeat,
      winner: this.winner,
      log: this.log.slice(-20),
      yourSeat: viewerSeat,
      validActions: viewerSeat === -1 ? [] : this.validActions(viewerSeat),
    };
  }
}
