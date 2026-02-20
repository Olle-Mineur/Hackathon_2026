import useLobbySocket, {
  mapSessionToViewState,
} from "@components/useLobbySocket";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const mockIntervalRef = useRef(null);

  const startMockCycle = () => {
    if (mockIntervalRef.current) return;

    let mockIndex = 0;
    setGameState((prev) => prev ?? MOCK_GAME_STATES[0]);

    mockIntervalRef.current = setInterval(() => {
      mockIndex = (mockIndex + 1) % MOCK_GAME_STATES.length;
      setGameState(MOCK_GAME_STATES[mockIndex]);
    }, 5000);
  };

  const stopMockCycle = () => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
  };

  const handleSession = useCallback((session) => {
    stopMockCycle();
    setGameState(mapSessionToViewState(session));
    setUsingMock(false);
    setError("");
    setLoading(false);
  }, []);

  const { connected } = useLobbySocket({
    lobbyId,
    onSession: handleSession,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!connected && !gameState) {
        setUsingMock(true);
        setError("Using mock data - backend websocket not connected");
        setLoading(false);
        startMockCycle();
      }
    }, 1500);

    if (connected) {
      stopMockCycle();
      setUsingMock(false);
      setError("");
      setLoading(false);
    }

    return () => clearTimeout(timer);
  }, [connected, gameState]);

  useEffect(() => {
    return () => stopMockCycle();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {usingMock ? (
        <div className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm">
          🧪 Mock Mode
        </div>
      ) : (
        <div className="flex justify-center gap-2 mt-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              connected ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {connected ? "WS Connected" : "WS Disconnected"}
          </span>
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Ride the Bus</h1>
        <div className="flex justify-center gap-4 text-gray-400">
          <span>Lobby: {lobbyId}</span>
          <span>•</span>
          <span>Round {gameState?.round || 1}/4</span>
          <span>•</span>
          <span>Players: {gameState?.players?.length || 0}</span>
        </div>
        {error && <p className="text-yellow-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="max-w-4xl mx-auto">
        <CardDisplay
          currentCard={gameState?.currentCard}
          previousCard={gameState?.previousCard}
          phase={gameState?.phase}
        />
      </div>

      <div className="max-w-2xl mx-auto mt-8 text-center">
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-2xl font-bold text-white mb-2">
            {!gameState?.phase && "Waiting for game..."}
            {gameState?.phase === "red_black" && "🔴 Red or ⚫ Black?"}
            {gameState?.phase === "higher_lower" && "📈 Higher or 📉 Lower?"}
            {gameState?.phase === "between_outside" && "↔️ Between or Outside?"}
            {gameState?.phase === "result" && "🏆 Results"}
          </h2>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mt-8">
        <h3 className="text-lg font-semibold text-white mb-3">Players</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {gameState?.players?.map((player, index) => (
            <div key={index} className="bg-gray-800 rounded p-2 text-center">
              <span className="text-white">{player.nickname}</span>
              {player.ready && <span className="ml-2 text-green-500">✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HostView;
