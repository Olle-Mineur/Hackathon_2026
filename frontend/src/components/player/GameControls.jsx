import { useEffect, useMemo, useState } from "react";
import DistributionPanel from "./DistributionPanel";

const GameControls = ({ gameState, lobbyId, nickname, playerId, usingMock }) => {
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [allocations, setAllocations] = useState({});

  useEffect(() => {
    setSelected(null);
    setError("");
    if (gameState?.phase !== "distribution") setAllocations({});
  }, [gameState?.phase, gameState?.round]);

  const me = useMemo(() => {
    const players = gameState?.players || [];
    const byId = playerId ? players.find((p) => p.id === playerId) : null;
    const byName = nickname
      ? players.find((p) => p.nickname === nickname)
      : null;

    if (byId && byName && byId.nickname !== byName.nickname) return byName;
    return byId || byName || null;
  }, [gameState?.players, playerId, nickname]);

  if (!gameState) return null;

  const giveOutRemaining = me?.giveOutRemaining ?? 0;
  const totalAllocated = Object.values(allocations).reduce((a, b) => a + b, 0);
  const leftToAllocate = Math.max(0, giveOutRemaining - totalAllocated);

  const handleChoice = async (choice) => {
    setSelected(choice);
    setSubmitting(true);
    setError("");

    if (usingMock) {
      setTimeout(() => setSubmitting(false), 500);
      return;
    }

    try {
      const requestBody = { choice };
      if (me?.id) requestBody.playerId = me.id;
      else requestBody.nickname = nickname;

      const response = await fetch(`/api/lobbies/${lobbyId}/choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || "Failed to submit choice");
      }
    } catch (err) {
      setError(err.message || "Failed to submit choice");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDistribution = async () => {
    if (leftToAllocate !== 0 || submitting) return;
    setSubmitting(true);
    setError("");

    if (usingMock) {
      setTimeout(() => setSubmitting(false), 500);
      return;
    }

    try {
      const body = { allocations };
      if (me?.id) body.playerId = me.id;
      else body.nickname = nickname;

      const response = await fetch(`/api/lobbies/${lobbyId}/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || "Failed to distribute drinks");
      }
    } catch (err) {
      setError(err.message || "Failed to distribute drinks");
    } finally {
      setSubmitting(false);
    }
  };

  const inc = (targetId) => {
    if (leftToAllocate <= 0) return;
    setAllocations((prev) => ({
      ...prev,
      [targetId]: (prev[targetId] || 0) + 1,
    }));
  };

  const dec = (targetId) => {
    setAllocations((prev) => {
      const next = {
        ...prev,
        [targetId]: Math.max(0, (prev[targetId] || 0) - 1),
      };
      if (next[targetId] === 0) delete next[targetId];
      return next;
    });
  };

  const getChoicesForPhase = () => {
    switch (gameState.phase) {
      case "red_black":
        return [
          { value: "red", label: "🔴 RED", color: "bg-red-600 hover:bg-red-700" },
          { value: "black", label: "⚫ BLACK", color: "bg-gray-800 hover:bg-gray-900" },
        ];
      case "higher_lower":
        return [
          { value: "higher", label: "📈 HIGHER", color: "bg-green-600 hover:bg-green-700" },
          { value: "lower", label: "📉 LOWER", color: "bg-yellow-600 hover:bg-yellow-700" },
        ];
      case "between_outside":
        return [
          { value: "between", label: "↔️ BETWEEN", color: "bg-blue-600 hover:bg-blue-700" },
          { value: "outside", label: "⚡ OUTSIDE", color: "bg-purple-600 hover:bg-purple-700" },
        ];
      case "suit":
        return [
          { value: "hearts", label: "♥️ HEARTS", color: "bg-red-600 hover:bg-red-700" },
          { value: "diamonds", label: "♦️ DIAMONDS", color: "bg-red-600 hover:bg-red-700" },
          { value: "clubs", label: "♣️ CLUBS", color: "bg-gray-800 hover:bg-gray-900" },
          { value: "spades", label: "♠️ SPADES", color: "bg-gray-800 hover:bg-gray-900" },
        ];
      default:
        return [];
    }
  };

  const choices = getChoicesForPhase();
  const hasGuessed = me?.ready || false;
  const isTapOutPending = !!me?.pendingTapOut;

  // 1. Distribution Phase
  if (gameState.phase === "distribution") {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <DistributionPanel
          players={gameState.players || []}
          meId={me?.id}
          giveOutRemaining={giveOutRemaining}
          allocations={allocations}
          onInc={inc}
          onDec={dec}
          onSubmit={submitDistribution}
          submitting={submitting}
        />
        {error && <p className="text-sm text-red-600 text-center mt-3">⚠️ {error}</p>}
      </div>
    );
  }

  // 2. Game Over / Results Phase
  if (gameState.phase === "result") {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-800">
          <p className="text-2xl font-bold mb-2">🏆 Game Over!</p>
          <p className="text-gray-600">Check the host screen for final results.</p>
        </div>
      </div>
    );
  }

  // 3. Waiting for Host to Start
  if (gameState.phase === "waiting") {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">
          Waiting for game to start...
        </div>
      </div>
    );
  }

  // 4. Player is Eliminated (Spectating)
  if (me?.isSpectator) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <p className="text-xl font-bold text-red-600 mb-2">❌ You are out!</p>
          <p className="text-gray-600">You are now spectating. Wait for the next game.</p>
        </div>
      </div>
    );
  }

  // 5. Player has submitted choice for current round
  if (hasGuessed) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-green-600">
          <p className="text-xl font-bold mb-2">✓ Choice submitted</p>
          <p className="text-sm text-gray-500">Waiting for other players...</p>
        </div>
      </div>
    );
  }

  // 6. Main Game Controls (Needs to Guess)
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="space-y-3">
        <p className="font-medium text-center text-gray-700">
          {gameState.phase === "red_black" && "Choose Red or Black:"}
          {gameState.phase === "higher_lower" &&
            "Will the next card be Higher or Lower?"}
          {gameState.phase === "between_outside" &&
            "Will the next card be Between or Outside?"}
          {gameState.phase === "suit" && "Choose your suit:"}
        </p>

        <div className="grid gap-3 grid-cols-2">
          {choices.map((choice) => (
            <button
              key={choice.value}
              onClick={() => handleChoice(choice.value)}
              disabled={submitting || selected || hasGuessed}
              className={`${choice.color} text-white rounded-lg font-bold py-4 px-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${selected === choice.value ? "ring-4 ring-yellow-400 scale-105" : ""}`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      {isTapOutPending && !hasGuessed && (
        <p className="text-sm text-orange-600 font-medium text-center mt-3">
          Tap out requested! Make your choice for this final round.
        </p>
      )}

      {selected && !error && (
        <p className="text-sm text-green-600 text-center mt-3">
          ✓ You chose: {selected}
          {submitting && " (sending...)"}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center mt-3">⚠️ {error}</p>
      )}

      {usingMock && (
        <p className="text-xs text-yellow-600 text-center mt-2">
          🧪 Mock mode - choices aren't sent to backend
        </p>
      )}
    </div>
  );
};

export default GameControls;