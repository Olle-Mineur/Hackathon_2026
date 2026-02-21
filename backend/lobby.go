package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

func main() {
    hub := newLobbyHub()
    mux := http.NewServeMux()
    ctx := context.Background()

    store, err := newRedisStore(ctx)
    if err != nil {
        log.Fatal(err)
    }

    bus, err := newRedisBus(ctx)
    if err != nil {
        log.Printf("redis pub/sub disabled: %v", err)
    } else {
        bus.SubscribeAndBroadcast(ctx, hub)
        log.Println("redis pub/sub enabled")
    }

    hub.ConfigureIdleClose(15*time.Minute, func(code string) {
        session, err := store.CloseSession(code, 30*time.Second)
        if err != nil {
            return
        }
        if bus != nil {
            _ = bus.PublishSession(ctx, session)
        } else {
            hub.broadcastSession(session.Code, session)
        }
        log.Printf("lobby %s auto-closed after WS inactivity", code)
    })

    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodGet {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write([]byte("ok"))
    })

    // POST /api/lobbies
    mux.HandleFunc("/api/lobbies", func(w http.ResponseWriter, r *http.Request) {
        allowCORS(w)
        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        if r.Method != http.MethodPost {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }

        var body struct {
            HostName string `json:"hostName"`
        }
        _ = json.NewDecoder(r.Body).Decode(&body)

        session, host, err := store.CreateSession(body.HostName)
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }

        if bus != nil {
            _ = bus.PublishSession(ctx, session)
        } else {
            hub.broadcastSession(session.Code, session)
        }

        writeJSON(w, http.StatusCreated, map[string]any{
            "hostId":  host.ID,
            "session": session,
        })
    })

    mux.HandleFunc("/api/lobbies/", func(w http.ResponseWriter, r *http.Request) {
        allowCORS(w)
        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }

        path := strings.TrimPrefix(r.URL.Path, "/api/lobbies/")
        parts := strings.Split(strings.Trim(path, "/"), "/")
        if len(parts) == 0 || parts[0] == "" {
            http.NotFound(w, r)
            return
        }
        code := parts[0]

        // GET /api/lobbies/{code}/ws
        if len(parts) == 2 && parts[1] == "ws" && r.Method == http.MethodGet {
            serveLobbyWS(w, r, store, hub, code)
            return
        }

        // GET /api/lobbies/{code}
        if len(parts) == 1 && r.Method == http.MethodGet {
            session, ok := store.GetSession(code)
            if !ok {
                http.Error(w, "session not found", http.StatusNotFound)
                return
            }
            writeJSON(w, http.StatusOK, session)
            return
        }

        // POST /api/lobbies/{code}/join
        if len(parts) == 2 && parts[1] == "join" && r.Method == http.MethodPost {
            var body struct {
                Name string `json:"name"`
            }
            _ = json.NewDecoder(r.Body).Decode(&body)

            player, session, err := store.JoinSession(code, body.Name)
            if err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }

            if bus != nil {
                _ = bus.PublishSession(ctx, session)
            } else {
                hub.broadcastSession(session.Code, session)
            }

            writeJSON(w, http.StatusOK, map[string]any{
                "playerId": player.ID,
                "session":  session,
            })
            return
        }

        // POST /api/lobbies/{code}/close
        if len(parts) == 2 && parts[1] == "close" && r.Method == http.MethodPost {
            session, err := store.CloseSession(code, 30*time.Second)
            if err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }
            if bus != nil {
                _ = bus.PublishSession(ctx, session)
            } else {
                hub.broadcastSession(session.Code, session)
            }
            writeJSON(w, http.StatusOK, session)
            return
        }

        http.NotFound(w, r)
    })

    log.Println("backend listening on :3000")
    log.Fatal(http.ListenAndServe(":3000", mux))
}

func allowCORS(w http.ResponseWriter) {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(v)
}