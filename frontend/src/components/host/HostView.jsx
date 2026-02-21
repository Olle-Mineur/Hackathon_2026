import useLobbySocket, {
  mapSessionToViewState,
} from "@components/useLobbySocket";
import { useCallback, useEffect, useRef, useState } from "react";
import CardDisplay from "./CardDisplay";
import useCountdown from '../useCountdown';

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
  const [startingGame, setStartingGame] = useState(false);
  const [restartingGame, setRestartingGame] = useState(false);
  const { formattedTime, isExpired } = useCountdown(gameState?.deadline);

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

  const handleStartGame = async () => {
    setStartingGame(true);
    setError('');

    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to start game');
      }

      console.log('Game started successfully');
      
    } catch (err) {
      setError(err.message || 'Failed to start game');
    } finally {
      setStartingGame(false);
    }
  };

const handleRestartGame = async () => {
  setRestartingGame(true);
  setError('');

  try {
    const response = await fetch(`/api/lobbies/${lobbyId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to restart game');
    }

    console.log('Game restarted successfully');
    
  } catch (err) {
    setError(err.message || 'Failed to restart game');
  } finally {
    setRestartingGame(false);
  }
};

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
          <span>Round {(gameState?.round) || 1}/5</span>
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
          
          {gameState?.deadline && gameState?.phase !== 'waiting' && gameState?.phase !== 'result' && (
          <div className="mt-2 mb-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-gray-400 text-sm">⏱️ Time left:</span>
              <span className={`font-mono text-xl font-bold ${
                isExpired ? 'text-red-500' : 
                (formattedTime && formattedTime < '00:10') ? 'text-yellow-500 animate-pulse' : 
                'text-white'
              }`}>
                {formattedTime || '--:--'}
              </span>
            </div>
          </div>
          )}

          {gameState?.phase === 'result' && (
            <div className="mt-4">
              <button
                onClick={handleRestartGame}
                disabled={restartingGame}
                className={`
                  px-8 py-4 rounded-lg font-bold text-xl transition-all
                  ${restartingGame
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
                  }
                `}
              >
                {restartingGame ? 'Restarting...' : 'RESTART GAME'}
              </button>
              
              <p className="text-gray-400 text-sm mt-2">
                Start a new game with the same players
              </p>
            </div>
          )}
          {gameState?.phase === 'waiting' && (
            <div className="mt-4">
              <button
                onClick={handleStartGame}
                disabled={startingGame || gameState?.players?.length < 1}
                className={`
                  px-8 py-4 rounded-lg font-bold text-xl transition-all
                  ${startingGame || gameState?.players?.length < 1
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                  }
                `}
              >
                {startingGame ? 'Starting...' : 'START GAME'}
              </button>
              
              {gameState?.players?.length < 1 && (
                <p className="text-yellow-500 text-sm mt-2">
                  Need at least 1 player to start
                </p>
              )}
            </div>
          )}
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
