import { useEffect, useRef, useState } from "react";

export const mapSessionToViewState = (session) => {
  const game = session?.game;
  const shared = game?.shared || [];
  const round = game?.round ?? 0;
  const started = game?.started ?? false;

  // New drink/distribution fields (safe fallbacks for old backend payloads)
  const distributionDeadline = game?.distributionDeadline ?? null;
  const distributionActive =
    Boolean(game?.distributionActive) ||
    (distributionDeadline && !started && round >= 4);

  let phase = "waiting";
  if (distributionActive) {
    phase = "distribution";
  } else if (started) {
    const phases = ["red_black", "higher_lower", "between_outside", "suit"];
    phase = round < 4 ? phases[round] : "result";
  } else if (round > 0) {
    phase = "result";
  }

  const mapCard = (c) => (c && c.rank ? { suit: c.suit, value: c.rank } : null);

  const normalizeGuess = (g) => {
    const v = String(g || "")
      .trim()
      .toLowerCase();
    return v === "inside" ? "between" : v;
  };

  const isCorrectGuessForRound = (roundIndex, guess) => {
    const g = normalizeGuess(guess);
    const c0 = shared[0];
    const c1 = shared[1];
    const c2 = shared[2];
    const c3 = shared[3];

    if (!c0 || !c0.rank) return null;

    switch (roundIndex) {
      case 0: {
        const isRed = ["hearts", "diamonds"].includes(
          String(c0.suit).toLowerCase(),
        );
        return (g === "red" && isRed) || (g === "black" && !isRed);
      }
      case 1: {
        if (!c1 || !c1.rank) return null;
        return (
          (g === "higher" && c1.rank > c0.rank) ||
          (g === "lower" && c1.rank < c0.rank)
        );
      }
      case 2: {
        if (!c1 || !c1.rank || !c2 || !c2.rank) return null;
        const low = Math.min(c0.rank, c1.rank);
        const high = Math.max(c0.rank, c1.rank);
        const between = c2.rank > low && c2.rank < high;
        const outside = c2.rank < low || c2.rank > high;
        return (g === "between" && between) || (g === "outside" && outside);
      }
      case 3: {
        if (!c3 || !c3.rank) return null;
        return String(c3.suit).toLowerCase() === g;
      }
      default:
        return null;
    }
  };

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
  const drinkNowByPlayer = game?.drinkNowByPlayer || {};
  const giveOutRemainingByPlayer = game?.giveOutRemainingByPlayer || {};

  const players = (session?.players || [])
    .filter((p) => p.id !== session?.hostId)
    .map((p) => {
      const isSpectator = started && !activePlayers.includes(p.id);
      const guesses = (game?.guesses?.[p.id] || []).map(normalizeGuess);
      const hasGuessedThisRound =
        guesses.length > round && guesses[round] !== "";

      // Last completed round from UI perspective
      const completedRound = Math.min(round - 1, 3);
      const lastGuessRound = Math.min(guesses.length - 1, completedRound);

      const lastGuess = lastGuessRound >= 0 ? guesses[lastGuessRound] : null;
      const lastGuessCorrect =
        lastGuessRound >= 0
          ? isCorrectGuessForRound(lastGuessRound, lastGuess)
          : null;

      return {
        id: p.id,
        nickname: p.name,
        ready: hasGuessedThisRound,
        score: p.score || 0,
        lifetimeDrank: p.lifetimeDrank ?? p.score ?? 0,
        drinkNow: drinkNowByPlayer[p.id] ?? 0,
        giveOutRemaining: giveOutRemainingByPlayer[p.id] ?? 0,
        guesses, // full guess history per player
        lastGuess, // most recently resolved guess
        lastGuessRound, // 0..3
        lastGuessCorrect, // true | false | null
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
    distributionDeadline,
    lobbyStatus: session?.status ?? "active",
    shuttingDownAt: session?.shuttingDownAt ?? null,
  };
};

export default function useLobbySocket({ lobbyId, onSession }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    if (!lobbyId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
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
            onSession(data);
          }
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [lobbyId, onSession]);

  return { connected };
}
