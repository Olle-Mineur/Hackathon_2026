package main

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type lobbyHub struct {
    mu      sync.RWMutex
    clients map[string]map[*websocket.Conn]struct{}

    idleAfter  time.Duration
    onIdle     func(code string)
    idleTimers map[string]*time.Timer
}

type sessionGetter interface {
    GetSession(code string) (*Session, bool)
}

func newLobbyHub() *lobbyHub {
    return &lobbyHub{
        clients:    map[string]map[*websocket.Conn]struct{}{},
        idleTimers: map[string]*time.Timer{},
    }
}

func (h *lobbyHub) ConfigureIdleClose(idleAfter time.Duration, onIdle func(code string)) {
    h.mu.Lock()
    defer h.mu.Unlock()
    h.idleAfter = idleAfter
    h.onIdle = onIdle
}

func (h *lobbyHub) add(code string, conn *websocket.Conn) {
    h.mu.Lock()
    defer h.mu.Unlock()

    code = normalizeCode(code)
    if h.clients[code] == nil {
        h.clients[code] = map[*websocket.Conn]struct{}{}
    }
    h.clients[code][conn] = struct{}{}

    // Any connection is activity: cancel pending idle-close timer.
    if t, ok := h.idleTimers[code]; ok {
        t.Stop()
        delete(h.idleTimers, code)
    }
}

func (h *lobbyHub) remove(code string, conn *websocket.Conn) {
    h.mu.Lock()
    defer h.mu.Unlock()

    code = normalizeCode(code)
    if h.clients[code] == nil {
        return
    }
    delete(h.clients[code], conn)
    if len(h.clients[code]) == 0 {
        delete(h.clients, code)

        // Schedule auto-close if still empty after idle timeout.
        if h.idleAfter > 0 && h.onIdle != nil {
            if old, ok := h.idleTimers[code]; ok {
                old.Stop()
            }
            h.idleTimers[code] = time.AfterFunc(h.idleAfter, func() {
                h.mu.RLock()
                _, hasClients := h.clients[code]
                onIdle := h.onIdle
                h.mu.RUnlock()

                if !hasClients && onIdle != nil {
                    onIdle(code)
                }

                h.mu.Lock()
                delete(h.idleTimers, code)
                h.mu.Unlock()
            })
        }
    }
}

func (h *lobbyHub) broadcastSession(code string, session *Session) {
    payload, err := json.Marshal(map[string]any{
        "type":    "session",
        "session": session,
    })
    if err != nil {
        return
    }

    h.mu.RLock()
    code = normalizeCode(code)
    room := h.clients[code]
    conns := make([]*websocket.Conn, 0, len(room))
    for c := range room {
        conns = append(conns, c)
    }
    h.mu.RUnlock()

    for _, c := range conns {
        if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
            _ = c.Close()
            h.remove(code, c)
        }
    }
}

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

func serveLobbyWS(w http.ResponseWriter, r *http.Request, store sessionGetter, hub *lobbyHub, code string) {
    code = normalizeCode(code)

    session, ok := store.GetSession(code)
    if !ok {
        http.Error(w, "session not found", http.StatusNotFound)
        return
    }

    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        return
    }

    hub.add(code, conn)
    defer func() {
        hub.remove(code, conn)
        _ = conn.Close()
    }()

    hub.broadcastSession(code, session)

    for {
        if _, _, err := conn.ReadMessage(); err != nil {
            return
        }
    }
}