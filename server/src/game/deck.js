const SUITS = ["s", "h", "d", "c"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export function freshDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

export function shuffle(deck) {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
