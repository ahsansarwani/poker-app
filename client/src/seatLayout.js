export const SEAT_POSITIONS = [
  { bottom: "2%", left: "50%", transform: "translateX(-50%)" },
  { bottom: "20%", left: "5%" },
  { top: "20%", left: "10%" },
  { top: "2%", left: "50%", transform: "translateX(-50%)" },
  { top: "20%", right: "10%" },
  { bottom: "20%", right: "5%" },
];

// Rotates the absolute seat index so the viewer always renders at position 0
// (bottom-center), with everyone else laid out relative to them in turn order —
// otherwise each player sees a differently-arranged table and "the seat next to
// you" means something different depending who's looking.
export function seatPosition(seatIndex, yourSeat) {
  const total = SEAT_POSITIONS.length;
  const base = yourSeat >= 0 ? yourSeat : 0;
  const relative = ((seatIndex - base) % total + total) % total;
  return SEAT_POSITIONS[relative];
}
