import useLobbySocket, {
  mapSessionToViewState,
} from "@components/useLobbySocket";
import { useCallback, useEffect, useRef, useState } from "react";
import GameControls from "./GameControls";
import useCountdown from "../useCountdown";
import TapOutControl from "./TapOutControl";

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
  const [playerId, setPlayerId] = useState("");
  const [gameState, setGameState] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usingMock, setUsingMock] = useState(false);
  const { formattedTime, isExpired } = useCountdown(gameState?.deadline);

  const mockIntervalRef = useRef(null);
  const playerIdStorageKey = `playerId:${lobbyId}`;
  const nicknameStorageKey = `playerNickname:${lobbyId}`;

  const stopMockUpdates = () => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
  };

  const startMockUpdates = () => {
    if (mockIntervalRef.current) return;
    let mockIndex = 0;

    setGameState({
      ...MOCK_PLAYER_STATES[0],
      players: [...MOCK_PLAYER_STATES[0].players, { nickname, ready: true }],
    });

    mockIntervalRef.current = setInterval(() => {
      mockIndex = (mockIndex + 1) % MOCK_PLAYER_STATES.length;
      setGameState({
        ...MOCK_PLAYER_STATES[mockIndex],
        players: [
          ...MOCK_PLAYER_STATES[mockIndex].players,
          { nickname, ready: true },
        ],
      });
    }, 5000);
  };

  const handleSession = useCallback((session) => {
    stopMockUpdates();
    setGameState(mapSessionToViewState(session));
    setUsingMock(false);
    setError("");
  }, []);

  const { connected } = useLobbySocket({
    lobbyId: hasJoined ? lobbyId : "",
    onSession: handleSession,
  });

  // Get nickname + restore player membership on reload
  useEffect(() => {
    const initialize = async () => {
      const savedNickname = localStorage.getItem(nicknameStorageKey);
      const savedPlayerId = localStorage.getItem(playerIdStorageKey);

      if (savedNickname) setNickname(savedNickname);
      if (savedPlayerId) setPlayerId(savedPlayerId);

      // Validate saved playerId belongs to saved nickname in this lobby
      if (savedPlayerId) {
        try {
          const res = await fetch(`/api/lobbies/${lobbyId}`);
          if (res.ok) {
            const session = await res.json();
            const p = (session?.players || []).find(
              (x) => x.id === savedPlayerId,
            );
            if (!p || (savedNickname && p.name !== savedNickname)) {
              localStorage.removeItem(playerIdStorageKey);
              setPlayerId("");
            } else {
              setHasJoined(true);
            }
          }
        } catch {
          // ignore
        }
      }

      if (savedNickname && !savedPlayerId) {
        handleAutoJoin(savedNickname);
      }
    };

    initialize();
  }, [lobbyId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasJoined && !connected && !gameState) {
        setUsingMock(true);
        setError("Using mock data - backend websocket not connected");
        startMockUpdates();
      }
    }, 1500);

    if (connected) {
      stopMockUpdates();
      setUsingMock(false);
      setError("");
    }

    return () => clearTimeout(timer);
  }, [hasJoined, connected, gameState]);

  {gameState?.phase !== 'waiting' && gameState?.players && (
  <div className="mb-4">
    {gameState.players
      .filter(p => p.nickname === nickname)
      .map(player => {
        if (player.lastGuessCorrect === null || player.lastGuessRound === undefined) return null;
        
        const roundNames = ['Red/Black', 'Higher/Lower', 'Between/Outside', 'Suit'];
        const roundName = roundNames[player.lastGuessRound] || 'Round';
        
        return (
          <div 
            key={player.id}
            className={`p-3 rounded-lg text-center ${
              player.lastGuessCorrect 
                ? 'bg-green-100 border border-green-300' 
                : 'bg-red-100 border border-red-300'
            }`}
          >
            <p className={`font-bold ${
              player.lastGuessCorrect ? 'text-green-700' : 'text-red-700'
            }`}>
              {player.lastGuessCorrect ? 'CORRECT!' : 'WRONG!'}
            </p>
            <p className="text-sm text-gray-600">
              {roundName}: You chose "{player.lastGuess}"
            </p>
            {player.drinkNow > 0 && (
              <p className="text-sm font-semibold text-orange-600 mt-1">
                Drink {player.drinkNow} {player.drinkNow === 1 ? 'sip' : 'sips'}
              </p>
            )}
          </div>
        );
      })}
  </div>
)}

  useEffect(() => () => stopMockUpdates(), []);

  const handleAutoJoin = async (savedNickname) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: savedNickname }),
      });

      if (!response.ok) throw new Error("Failed to join");
      const data = await response.json();
      if (data?.playerId) {
        localStorage.setItem(playerIdStorageKey, data.playerId);
        setPlayerId(data.playerId);
      }
      setHasJoined(true);
    } catch {
      // allow manual join
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
      localStorage.removeItem(playerIdStorageKey);
      setPlayerId("");

      const response = await fetch(`/api/lobbies/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nickname.trim() }),
      });

      if (!response.ok) throw new Error("Failed to join");

      const data = await response.json();
      if (data?.playerId) {
        localStorage.setItem(playerIdStorageKey, data.playerId);
        setPlayerId(data.playerId);
      }

      localStorage.setItem(nicknameStorageKey, nickname.trim());
      setHasJoined(true);
    } catch {
      setUsingMock(true);
      setHasJoined(true);
      localStorage.setItem("playerNickname", nickname.trim());
      startMockUpdates();
    } finally {
      setLoading(false);
    }
  };

  const me = (gameState?.players || []).find(
    (p) => (playerId && p.id === playerId) || p.nickname === nickname,
  );

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-6">Join Game</h1>
          <p className="text-center text-gray-600 mb-4">Lobby: {lobbyId}</p>

          <form onSubmit={handleJoin}>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={20}
              disabled={loading}
            />

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              type="submit"
              disabled={loading || !nickname.trim()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? "Joining..." : "Join Game"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 bg-gray-50 min-h-screen">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            connected ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {connected ? "WS Connected" : "WS Disconnected"}
        </span>
        {usingMock && (
          <span className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-2 py-1 rounded-full text-xs">
            🧪 Mock Mode
          </span>
        )}
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">Ride the Bus</h1>
          <p className="text-sm text-gray-600">Lobby: {lobbyId}</p>
        </div>
        <div className="text-right">
          <p className="font-medium">{nickname}</p>
          <p className="text-sm text-gray-600">
            Round {gameState?.round || 1}/5
          </p>
        </div>
      </div>

      {gameState?.currentCard && (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">Current Card</p>
          <div className="bg-white rounded-lg shadow-md p-4 inline-block">
            <span
              className={`text-2xl font-bold ${getCardColor(gameState.currentCard)}`}
            >
              {formatCard(gameState.currentCard)}
            </span>
          </div>
          {gameState.previousCard && (
            <div className="mt-2 text-xs text-gray-500">
              Previous: {formatCard(gameState.previousCard)}
            </div>
          )}
        </div>
      )}

      <GameControls
        gameState={gameState}
        lobbyId={lobbyId}
        nickname={nickname}
        playerId={playerId}
        usingMock={usingMock}
      />

      <TapOutControl
        gameState={gameState}
        lobbyId={lobbyId}
        playerId={playerId}
        nickname={nickname}
        me={me}
        usingMock={usingMock}
      />
      {gameState?.deadline &&
        gameState?.phase !== "waiting" &&
        gameState?.phase !== "result" && (
          <div className="pt-4 mb-4 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
              <span className="text-gray-600">⏱️</span>
              <span
                className={`font-mono font-bold ${
                  isExpired
                    ? "text-red-500"
                    : formattedTime && formattedTime < "00:10"
                      ? "text-orange-500 animate-pulse"
                      : "text-gray-800"
                }`}
              >
                {formattedTime || "--:--"}
              </span>
            </div>
          </div>
        )}

      {gameState?.players && (
        <div className="mt-6">
          <p className="text-sm font-medium mb-2">
            Players ({gameState.players.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {gameState.players.map((p, i) => (
              <div
                key={i}
                className={`rounded-full px-3 py-1 text-sm ${
                  p.nickname === nickname
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {p.nickname}
                {p.ready && <span className="ml-1 text-green-600">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-yellow-600 text-sm mt-4">{error}</p>}
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
  const symbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
  const values = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  const value = values[card.value] || card.value;
  const suit = symbols[card.suit?.toLowerCase()] || "?";
  return `${value}${suit}`;
};

export default PlayerView;
