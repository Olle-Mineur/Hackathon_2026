import { useEffect, useRef, useState } from "react";

export const mapSessionToViewState = (session) => {
  const game = session?.game;
  const shared = game?.shared || [];
  const round = game?.round ?? 0;
  const started = game?.started ?? false;

  let phase = "waiting";
  if (started) {
    const phases = ["red_black", "higher_lower", "between_outside", "suit"];
    phase = round < 4 ? phases[round] : "result";
  } else if (round > 0) {
    phase = "result";
  }

  const mapCard = (c) => (c && c.rank ? { suit: c.suit, value: c.rank } : null);

  let currentCard = null;
  let previousCard = null;

  if (started || round > 0) {
    if (round === 1) {
      currentCard = mapCard(shared[0]);
    } else if (round === 2) {
      currentCard = mapCard(shared[1]);
      previousCard = mapCard(shared[0]);
    } else if (round === 3) {
      currentCard = mapCard(shared[2]);
      previousCard = mapCard(shared[1]);
    } else if (round >= 4 || (!started && round > 0)) {
      currentCard = mapCard(shared[3]);
      previousCard = mapCard(shared[2]);
    }
  }

  const activePlayers = game?.activePlayers || [];

  const players = (session?.players || [])
    .filter((p) => p.id !== session?.hostId)
    .map((p) => {
      const isSpectator = started && !activePlayers.includes(p.id);
      const guesses = game?.guesses?.[p.id] || [];
      const hasGuessedThisRound = guesses.length > round && guesses[round] !== "";
      return {
        nickname: p.name,
        ready: hasGuessedThisRound,
        score: p.score || 0,
        isSpectator,
      };
    });

  return {
    players,
    round: round + 1,
    phase,
    currentCard,
    previousCard,
    deadline: game?.deadline ?? null,
    lobbyStatus: session?.status ?? "active",
    shuttingDownAt: session?.shuttingDownAt ?? null,
  };
};

export default function useLobbySocket({ lobbyId, onSession }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!lobbyId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Use the current host, which Vite proxies to the Go backend
    const wsUrl = `${protocol}//${window.location.host}/api/lobbies/${lobbyId}/ws`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "session" && data.session) {
            onSession(data.session);
          } else if (data.code) {
            // Fallback if backend just sends the raw session object
            onSession(data);
          }
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 2 seconds
        setTimeout(connect, 2000);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [lobbyId, onSession]);

  return { connected };
}