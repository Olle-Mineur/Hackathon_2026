import { useEffect, useMemo, useState } from "react";

const GameControls = ({
  gameState,
  lobbyId,
  nickname,
  playerId,
  usingMock,
}) => {
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
      if (me?.id)
        requestBody.playerId = me.id; // use resolved player
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

  // Get player's last result
  const currentPlayer = gameState?.players?.find(
    (p) => p.nickname === nickname,
  );
  const lastResult = me?.lastGuessCorrect ?? null;
  const drinkNow = me?.drinkNow || 0;
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
          {
            value: "red",
            label: "🔴 RED",
            color: "bg-red-600 hover:bg-red-700",
          },
          {
            value: "black",
            label: "⚫ BLACK",
            color: "bg-gray-800 hover:bg-gray-900",
          },
        ];
      case "higher_lower":
        return [
          {
            value: "higher",
            label: "📈 HIGHER",
            color: "bg-green-600 hover:bg-green-700",
          },
          {
            value: "lower",
            label: "📉 LOWER",
            color: "bg-yellow-600 hover:bg-yellow-700",
          },
        ];
      case "between_outside":
        return [
          {
            value: "between",
            label: "↔️ BETWEEN",
            color: "bg-blue-600 hover:bg-blue-700",
          },
          {
            value: "outside",
            label: "⚡ OUTSIDE",
            color: "bg-purple-600 hover:bg-purple-700",
          },
        ];
      case "suit":
        return [
          {
            value: "hearts",
            label: "♥️ HEARTS",
            color: "bg-red-600 hover:bg-red-700",
          },
          {
            value: "diamonds",
            label: "♦️ DIAMONDS",
            color: "bg-red-600 hover:bg-red-700",
          },
          {
            value: "clubs",
            label: "♣️ CLUBS",
            color: "bg-gray-800 hover:bg-gray-900",
          },
          {
            value: "spades",
            label: "♠️ SPADES",
            color: "bg-gray-800 hover:bg-gray-900",
          },
        ];
      case "distribution":
        return []; // No choices during distribution phase
      default:
        return [];
    }
  };

  const choices = getChoicesForPhase();
  // Check if player has already guessed this round
  const hasGuessed =
    (gameState?.players || []).find(
      (p) => (playerId && p.id === playerId) || p.nickname === nickname,
    )?.ready || false;

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
        {error && (
          <p className="text-sm text-red-600 text-center mt-3">⚠️ {error}</p>
        )}
      </div>
    );
  }

  // Show result from previous round
  if (
    lastResult !== null &&
    gameState.phase !== "waiting" &&
    gameState.phase !== "distribution"
  ) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div
            className={`text-2xl font-bold mb-2 ${
              lastResult ? "text-green-600" : "text-red-600"
            }`}
          >
            {lastResult ? "✅ CORRECT!" : "❌ WRONG!"}
          </div>

          {drinkNow > 0 && (
            <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 mb-3">
              <p className="font-semibold text-orange-700">
                Drink {drinkNow} {drinkNow === 1 ? "sip" : "sips"}!
              </p>
            </div>
          )}

          <p className="text-gray-500 text-sm">
            {gameState.phase === "red_black" &&
              "Get ready for the next round..."}
            {gameState.phase === "higher_lower" && "New card coming..."}
            {gameState.phase === "between_outside" && "Next round starting..."}
            {gameState.phase === "suit" && "Choose your suit..."}
          </p>
        </div>
      </div>
    );
  }

  // No choices for this phase
  const isTapOutPending = !!me?.pendingTapOut;

  if (choices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="text-center text-gray-500 py-4">
          {gameState.phase === "waiting" && "Waiting for game to start..."}
          {!gameState.phase && "Loading game..."}
        </div>
      </div>
    );
  }

  if (hasGuessed && !selected) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="text-center text-green-600 py-4">
          <p className="font-medium">
            ✓ You've made your choice for this round
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Waiting for other players...
          </p>
        </div>
      </div>
    );
  }

  // Main game controls
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

        <div
          className={`grid gap-3 ${
            choices.length === 4 ? "grid-cols-2" : "grid-cols-2"
          }`}
        >
          {choices.map((choice) => (
            <button
              key={choice.value}
              onClick={() => handleChoice(choice.value)}
              disabled={submitting || selected || hasGuessed || isTapOutPending}
              className={`${choice.color} text-white rounded-lg font-bold py-4 px-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${selected === choice.value ? "ring-4 ring-yellow-400 scale-105" : ""}`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      {isTapOutPending && (
        <p className="text-sm text-gray-600 text-center mt-3">
          You tapped out. Guessing is disabled for this round.
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
