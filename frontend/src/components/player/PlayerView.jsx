import { useEffect, useState } from "react";
import GameControls from "./GameControls";

// Mock data for fallback
const MOCK_PLAYER_STATES = [
  {
    currentCard: { suit: "hearts", value: 7 },
    players: [
      { nickname: "Alice", ready: true },
      { nickname: "Bob", ready: false },
      { nickname: "Charlie", ready: true },
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
    ],
    round: 2,
    phase: "between_outside",
  },
];

const PlayerView = ({ lobbyId }) => {
  const [nickname, setNickname] = useState("");
  const [gameState, setGameState] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usingMock, setUsingMock] = useState(false);

  // Get nickname from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("playerNickname");
    if (saved) {
      setNickname(saved);
      // Auto-join if we have a saved nickname
      handleAutoJoin(saved);
    }
  }, []);

  const handleAutoJoin = async (savedNickname) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: savedNickname }),
      });

      if (!response.ok) {
        throw new Error("Failed to join");
      }

      setHasJoined(true);
      startPolling();
    } catch (err) {
      // Auto-join failed, but we'll let user try manually
      console.log("Auto-join failed, will use mock");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      if (!response.ok) {
        // If backend fails, use mock mode
        setUsingMock(true);
        setHasJoined(true);
        localStorage.setItem("playerNickname", nickname);
        startMockUpdates();
        return;
      }

      localStorage.setItem("playerNickname", nickname);
      setHasJoined(true);
      startPolling();
    } catch (err) {
      // Network error - use mock mode
      setUsingMock(true);
      setHasJoined(true);
      localStorage.setItem("playerNickname", nickname);
      startMockUpdates();
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    const fetchState = async () => {
      try {
        const response = await fetch(`/api/lobbies/${lobbyId}/state`);
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setGameState(data);
        setUsingMock(false);
      } catch (err) {
        // Switch to mock if polling fails
        setUsingMock(true);
        startMockUpdates();
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  };

  const startMockUpdates = () => {
    let mockIndex = 0;
    setGameState({
      ...MOCK_PLAYER_STATES[0],
      players: [...MOCK_PLAYER_STATES[0].players, { nickname, ready: true }],
    });

    const interval = setInterval(() => {
      mockIndex = (mockIndex + 1) % MOCK_PLAYER_STATES.length;
      setGameState((prev) => ({
        ...MOCK_PLAYER_STATES[mockIndex],
        players: [
          ...MOCK_PLAYER_STATES[mockIndex].players,
          { nickname, ready: true },
        ],
      }));
    }, 5000);

    return () => clearInterval(interval);
  };

  // Join form
  if (!hasJoined) {
    return (
      <div class="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div class="w-full max-w-sm">
          <h1 class="text-2xl font-bold text-center mb-6">Join Game</h1>
          <p class="text-center text-gray-600 mb-4">Lobby: {lobbyId}</p>

          <form onSubmit={handleJoin}>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={20}
              disabled={loading}
            />

            {error && <p class="text-red-500 text-sm mb-3">{error}</p>}

            <button
              type="submit"
              disabled={loading || !nickname.trim()}
              class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? "Joining..." : "Join Game"}
            </button>

            <p class="text-xs text-gray-400 text-center mt-4">
              {usingMock
                ? "🧪 Mock mode - no backend needed"
                : "Connect to backend to play with others"}
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Game view
  return (
    <div class="container mx-auto px-4 py-6 bg-gray-50 min-h-screen">
      {/* Mock Indicator */}
      {usingMock && (
        <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-1 rounded-full text-xs inline-block mb-3">
          🧪 Mock Mode - Testing Only
        </div>
      )}

      {/* Header */}
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-xl font-bold">Ride the Bus</h1>
          <p class="text-sm text-gray-600">Lobby: {lobbyId}</p>
        </div>
        <div class="text-right">
          <p class="font-medium">{nickname}</p>
          <p class="text-sm text-gray-600">Round {gameState?.round || 1}/4</p>
        </div>
      </div>

      {/* Current Card */}
      {gameState?.currentCard && (
        <div class="mb-6">
          <p class="text-sm text-gray-600 mb-2">Current Card</p>
          <div class="bg-white rounded-lg shadow-md p-4 inline-block">
            <span
              class={`text-2xl font-bold ${getCardColor(gameState.currentCard)}`}
            >
              {formatCard(gameState.currentCard)}
            </span>
          </div>
          {gameState.previousCard && (
            <div class="mt-2 text-xs text-gray-500">
              Previous: {formatCard(gameState.previousCard)}
            </div>
          )}
        </div>
      )}

      {/* Game Controls */}
      <GameControls
        gameState={gameState}
        lobbyId={lobbyId}
        nickname={nickname}
        usingMock={usingMock}
      />

      {/* Players in lobby */}
      {gameState?.players && (
        <div class="mt-6">
          <p class="text-sm font-medium mb-2">
            Players ({gameState.players.length})
          </p>
          <div class="flex flex-wrap gap-2">
            {gameState.players.map((p, i) => (
              <div
                key={i}
                class={`rounded-full px-3 py-1 text-sm ${
                  p.nickname === nickname
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {p.nickname}
                {p.ready && <span class="ml-1 text-green-600">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
const getCardColor = (card) => {
  const redSuits = ["hearts", "diamonds"];
  return redSuits.includes(card.suit?.toLowerCase())
    ? "text-red-500"
    : "text-gray-900";
};

const formatCard = (card) => {
  if (!card) return "";

  const symbols = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };

  const values = {
    1: "A",
    11: "J",
    12: "Q",
    13: "K",
  };

  const value = values[card.value] || card.value;
  const suit = symbols[card.suit?.toLowerCase()] || "?";

  return `${value}${suit}`;
};

export default PlayerView;
