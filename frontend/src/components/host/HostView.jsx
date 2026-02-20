import { useEffect, useState } from "react";
import CardDisplay from "./CardDisplay";

// Mock data for fallback
const MOCK_GAME_STATES = [
  {
    currentCard: { suit: "hearts", value: 7 },
    previousCard: null,
    players: [
      { nickname: "Alice", ready: true },
      { nickname: "Bob", ready: false },
      { nickname: "Charlie", ready: true },
      { nickname: "Diana", ready: false },
    ],
    round: 1,
    phase: "red_black",
  },
  {
    currentCard: { suit: "spades", value: 10 },
    previousCard: { suit: "hearts", value: 7 },
    players: [
      { nickname: "Alice", ready: true },
      { nickname: "Bob", ready: true },
      { nickname: "Charlie", ready: false },
      { nickname: "Diana", ready: true },
    ],
    round: 1,
    phase: "higher_lower",
  },
  {
    currentCard: { suit: "diamonds", value: 3 },
    previousCard: { suit: "spades", value: 10 },
    players: [
      { nickname: "Alice", ready: true },
      { nickname: "Bob", ready: true },
      { nickname: "Charlie", ready: true },
      { nickname: "Diana", ready: false },
    ],
    round: 2,
    phase: "between_outside",
  },
  {
    currentCard: { suit: "clubs", value: 12 }, // Queen
    previousCard: { suit: "diamonds", value: 3 },
    players: [
      { nickname: "Alice", ready: true },
      { nickname: "Bob", ready: true },
      { nickname: "Charlie", ready: true },
      { nickname: "Diana", ready: true },
    ],
    round: 2,
    phase: "result",
  },
];

const HostView = ({ lobbyId }) => {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingMock, setUsingMock] = useState(false);

  // Fetch game state from backend or use mock
  useEffect(() => {
    let mockInterval;
    let isMounted = true;

    const fetchGameState = async () => {
      try {
        const response = await fetch(`/api/lobbies/${lobbyId}/state`);

        if (!response.ok) {
          throw new Error("Backend not available");
        }

        const data = await response.json();
        if (isMounted) {
          setGameState(data);
          setUsingMock(false);
          setError("");
        }
      } catch (err) {
        // Backend failed, use mock data
        console.log("Using mock data (backend unavailable)");
        if (isMounted) {
          setUsingMock(true);
          setError("Using mock data - backend not connected");
        }
      }
    };

    const startMockCycle = () => {
      let mockIndex = 0;
      setGameState(MOCK_GAME_STATES[0]);

      // Cycle through mock states every 5 seconds
      mockInterval = setInterval(() => {
        mockIndex = (mockIndex + 1) % MOCK_GAME_STATES.length;
        if (isMounted) {
          setGameState(MOCK_GAME_STATES[mockIndex]);
        }
      }, 5000);
    };

    // Initial fetch
    fetchGameState().finally(() => {
      if (isMounted) setLoading(false);
    });

    // Set up polling for real backend (every 3 seconds)
    const pollInterval = setInterval(fetchGameState, 3000);

    // If using mock, also start the mock cycle after a delay
    setTimeout(() => {
      if (usingMock) {
        startMockCycle();
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (mockInterval) clearInterval(mockInterval);
    };
  }, [lobbyId]);

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-gray-900">
        <div class="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  return (
    <div class="container mx-auto px-4 py-8">
      {/* Mock Indicator */}
      {usingMock && (
        <div class="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm">
          🧪 Mock Mode
        </div>
      )}

      {/* Header with Lobby Info */}
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">Ride the Bus</h1>
        <div class="flex justify-center gap-4 text-gray-400">
          <span>Lobby: {lobbyId}</span>
          <span>•</span>
          <span>Round {gameState?.round || 1}/4</span>
          <span>•</span>
          <span>Players: {gameState?.players?.length || 0}</span>
        </div>
        {error && <p class="text-yellow-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Main Card Display */}
      <div class="max-w-4xl mx-auto">
        <CardDisplay
          currentCard={gameState?.currentCard}
          previousCard={gameState?.previousCard}
          phase={gameState?.phase}
        />
      </div>

      {/* Game Phase Indicator */}
      <div class="max-w-2xl mx-auto mt-8 text-center">
        <div class="bg-gray-800 rounded-lg p-4">
          <h2 class="text-2xl font-bold text-white mb-2">
            {!gameState?.phase && "Waiting for game..."}
            {gameState?.phase === "red_black" && "🔴 Red or ⚫ Black?"}
            {gameState?.phase === "higher_lower" && "📈 Higher or 📉 Lower?"}
            {gameState?.phase === "between_outside" && "↔️ Between or Outside?"}
            {gameState?.phase === "result" && "🏆 Results"}
          </h2>
        </div>
      </div>

      {/* Players List */}
      <div class="max-w-2xl mx-auto mt-8">
        <h3 class="text-lg font-semibold text-white mb-3">Players</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          {gameState?.players?.map((player, index) => (
            <div key={index} class="bg-gray-800 rounded p-2 text-center">
              <span class="text-white">{player.nickname}</span>
              {player.ready && <span class="ml-2 text-green-500">✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HostView;
