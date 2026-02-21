import { useState } from "react";

const TapOutControl = ({
  gameState,
  lobbyId,
  playerId,
  nickname,
  me,
  usingMock,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const phase = gameState?.phase;
  const isGuessPhase =
    phase === "red_black" ||
    phase === "higher_lower" ||
    phase === "between_outside" ||
    phase === "suit";

  if (!isGuessPhase || !me || me.isSpectator) return null;

  const canTap = !me.pendingTapOut;

  const onTapOut = async () => {
    if (!canTap || submitting) return;
    setSubmitting(true);
    setError("");

    if (usingMock) {
      setSubmitting(false);
      return;
    }

    try {
      const body = playerId ? { playerId } : { nickname };
      const res = await fetch(`/api/lobbies/${lobbyId}/tap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to tap out");
    } catch (e) {
      setError(e.message || "Failed to tap out");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={onTapOut}
        disabled={!canTap || submitting}
        className="w-full py-2 rounded-lg font-medium bg-gray-800 text-white disabled:opacity-50"
      >
        {me.pendingTapOut
          ? "Tap out requested (next round)"
          : "Tap out after this round"}
      </button>

      {me.pendingTapOut && (
        <p className="text-sm text-gray-600 mt-2">
          You will tap out after this round.
        </p>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
};

export default TapOutControl;
