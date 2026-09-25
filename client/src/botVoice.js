import { useEffect, useRef } from "react";

// Bots can't join the real WebRTC voice chat (no mic, no browser), so we announce
// their actions with speech synthesis instead — reading new log lines that were
// authored by a bot seat, using the existing game log as the source of truth
// rather than adding a parallel event stream.
export function useBotVoiceOver(state, enabled) {
  const lastLenRef = useRef(0);

  useEffect(() => {
    if (!state) return;
    const log = state.log || [];
    if (log.length < lastLenRef.current) lastLenRef.current = 0;

    if (!enabled || typeof window === "undefined" || !window.speechSynthesis) {
      lastLenRef.current = log.length;
      return;
    }

    const botNames = state.seats.filter((s) => s && s.isBot).map((s) => s.name);
    const newLines = log.slice(lastLenRef.current);
    lastLenRef.current = log.length;

    for (const line of newLines) {
      const speaker = botNames.find((name) => line.startsWith(`${name} `));
      if (!speaker) continue;
      const utter = new SpeechSynthesisUtterance(line);
      utter.rate = 1.05;
      utter.pitch = 0.9;
      utter.volume = 0.9;
      window.speechSynthesis.speak(utter);
    }
  }, [state, enabled]);
}
