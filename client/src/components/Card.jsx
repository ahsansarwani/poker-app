const SUIT_SYMBOL = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RANK_LABEL = { T: "10" };

export default function Card({ code, faceDown = false, small = false }) {
  const size = small ? "card card--small" : "card";
  if (!code || code === "??" || faceDown) {
    return <div className={`${size} card--back`} />;
  }
  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  const isRed = suit === "h" || suit === "d";
  return (
    <div className={`${size} ${isRed ? "card--red" : "card--black"}`}>
      <span>{RANK_LABEL[rank] || rank}</span>
      <span className="card__suit">{SUIT_SYMBOL[suit]}</span>
    </div>
  );
}
