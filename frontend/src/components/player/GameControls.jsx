import { useState } from "react";

const GameControls = ({ gameState, lobbyId, nickname, usingMock }) => {
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!gameState) return null;

  const handleChoice = async (choice) => {
    setSelected(choice);
    setSubmitting(true);

    if (usingMock) {
      // Just simulate in mock mode
      setTimeout(() => {
        console.log(`Mock: ${nickname} chose ${choice}`);
        setSubmitting(false);
      }, 500);
      return;
    }

    try {
      await fetch(`/api/lobbies/${lobbyId}/choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          choice,
          phase: gameState.phase,
        }),
      });
    } catch (error) {
      console.error("Failed to submit choice:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Different controls based on game phase
  const renderControls = () => {
    switch (gameState.phase) {
      case "red_black":
        return (
          <div class="space-y-3">
            <p class="font-medium">Choose color:</p>
            <div class="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleChoice("red")}
                disabled={submitting}
                class="py-4 bg-red-600 text-white rounded-lg font-bold text-lg hover:bg-red-700 disabled:opacity-50 active:transform active:scale-95 transition-transform"
              >
                🔴 RED
              </button>
              <button
                onClick={() => handleChoice("black")}
                disabled={submitting}
                class="py-4 bg-gray-800 text-white rounded-lg font-bold text-lg hover:bg-gray-900 disabled:opacity-50 active:transform active:scale-95 transition-transform"
              >
                ⚫ BLACK
              </button>
            </div>
          </div>
        );

      case "higher_lower":
        return (
          <div class="space-y-3">
            <p class="font-medium">Next card will be:</p>
            <div class="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleChoice("higher")}
                disabled={submitting}
                class="py-4 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 active:transform active:scale-95 transition-transform"
              >
                📈 HIGHER
              </button>
              <button
                onClick={() => handleChoice("lower")}
                disabled={submitting}
                class="py-4 bg-yellow-600 text-white rounded-lg font-bold text-lg hover:bg-yellow-700 disabled:opacity-50 active:transform active:scale-95 transition-transform"
              >
                📉 LOWER
              </button>
            </div>
          </div>
        );

      case "between_outside":
        return (
          <div class="space-y-3">
            <p class="font-medium">Next card will be:</p>
            <div class="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleChoice("between")}
                disabled={submitting}
                class="py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 active:transform active:scale-95 transition-transform"
              >
                ↔️ BETWEEN
              </button>
              <button
                onClick={() => handleChoice("outside")}
                disabled={submitting}
                class="py-4 bg-purple-600 text-white rounded-lg font-bold text-lg hover:bg-purple-700 disabled:opacity-50 active:transform active:scale-95 transition-transform"
              >
                ⚡ OUTSIDE
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div class="text-center text-gray-500 py-8">
            {gameState.phase === "waiting" && "Waiting for game to start..."}
            {gameState.phase === "result" &&
              "Round complete! Next round starting soon..."}
            {!gameState.phase && "Loading game..."}
          </div>
        );
    }
  };

  return (
    <div class="bg-white rounded-lg shadow-md p-4">
      {renderControls()}

      {/* Selected indicator */}
      {selected && (
        <p class="text-sm text-gray-500 text-center mt-3">
          You chose: {selected}
          {submitting && " (sending...)"}
        </p>
      )}

      {/* Mock mode indicator in controls */}
      {usingMock && (
        <p class="text-xs text-yellow-600 text-center mt-2">
          🧪 Mock mode - choices aren't saved
        </p>
      )}
    </div>
  );
};

export default GameControls;
