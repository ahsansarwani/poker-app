export default function VoiceControls({ voice, botVoice }) {
  if (!voice.supported && !botVoice?.hasBots) return null;
  return (
    <div className="voice-controls">
      {voice.supported && (
        <button
          className={`btn btn--mic ${voice.micOn ? "btn--mic-on" : ""}`}
          onClick={voice.toggleMic}
          title="Microphone"
          aria-pressed={voice.micOn}
          aria-label={voice.micOn ? "Mute microphone" : "Turn on microphone"}
        >
          {voice.micOn ? "🎙️ On" : "🎙️ Off"}
        </button>
      )}
      {voice.micError && <span className="voice-error" role="status">{voice.micError}</span>}
      {botVoice?.hasBots && (
        <button
          className={`btn btn--mic ${botVoice.enabled ? "btn--mic-on" : ""}`}
          onClick={botVoice.toggle}
          title="Bot voice-over"
          aria-pressed={botVoice.enabled}
          aria-label={botVoice.enabled ? "Mute bot voice-over" : "Enable bot voice-over"}
        >
          {botVoice.enabled ? "🔊 Bots" : "🔇 Bots"}
        </button>
      )}
    </div>
  );
}
