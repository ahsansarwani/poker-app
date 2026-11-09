const SUIT_SYMBOL = { s: "♠", h: "♥", d: "♦", c: "♣" };
const SUIT_NAME = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
const RANK_LABEL = { T: "10" };

export default function Card({ code, faceDown = false, small = false }) {
  const size = small ? "card card--small" : "card";
  if (!code || code === "??" || faceDown) {
    return (
      <div className={`${size} card--back`}>
        <div className="card__back-pattern" />
      </div>
    );
  }
  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  const isRed = suit === "h" || suit === "d";
  const label = RANK_LABEL[rank] || rank;
  const symbol = SUIT_SYMBOL[suit];

  return (
    <div
      className={`${size} ${isRed ? "card--red" : "card--black"}`}
      role="img"
      aria-label={`${label} of ${SUIT_NAME[suit]}`}
    >
      <span className="card__corner card__corner--top">
        {label}
        <span aria-hidden="true" className="card__corner-suit">{symbol}</span>
      </span>
      <span aria-hidden="true" className="card__suit">{symbol}</span>
      <span className="card__corner card__corner--bottom">
        {label}
        <span aria-hidden="true" className="card__corner-suit">{symbol}</span>
      </span>
    </div>
  );
}
