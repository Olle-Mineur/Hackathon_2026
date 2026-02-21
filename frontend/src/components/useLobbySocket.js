import { useEffect, useRef, useState } from "react";

export const mapSessionToViewState = (session) => ({
  players: (session?.players || [])
    .filter((p) => p.id !== session?.hostId)
    .map((p) => ({ nickname: p.name, ready: true })),
  round: (session?.game?.round ?? 0) + 1,
  phase: "waiting",
  currentCard: null,
  previousCard: null,
  lobbyStatus: session?.status ?? "active",
  shuttingDownAt: session?.shuttingDownAt ?? null,
});

export default function useLobbySocket({ lobbyId, onSession }) {
  const wsRef = useRef(null);
  const onSessionRef = useRef(onSession);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    onSessionRef.current = onSession;
  }, [onSession]);

  useEffect(() => {
    if (!lobbyId) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${window.location.host}/api/lobbies/${lobbyId}/ws`,
    );
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "session" && msg?.session) {
          onSessionRef.current?.(msg.session);
        }
      } catch {}
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [lobbyId]);

  return { connected };
}
