package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
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

        hostName := generateRandomHostName()

        session, host, err := store.CreateSession(hostName)
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

        // POST /api/lobbies/{code}/start
        if len(parts) == 2 && parts[1] == "start" && r.Method == http.MethodPost {
            session, err := store.StartSession(code)
            if err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }
            if bus != nil {
                _ = bus.PublishSession(ctx, session)
            } else {
                hub.broadcastSession(session.Code, session)
            }
            if session.Game.Started {
                scheduleAutoAdvance(ctx, code, session.Game.Round, store, bus, hub)
            } else if session.Game.DistributionActive && session.Game.DistributionDeadline != nil {
                scheduleDistributionFinalize(ctx, code, *session.Game.DistributionDeadline, store, bus, hub)
            }
            writeJSON(w, http.StatusOK, session)
            return
        }

        // POST /api/lobbies/{code}/choice
        if len(parts) == 2 && parts[1] == "choice" && r.Method == http.MethodPost {
            var body struct {
                PlayerID string `json:"playerId"`
                Nickname string `json:"nickname"`
                Choice   string `json:"choice"`
            }
            _ = json.NewDecoder(r.Body).Decode(&body)

            // Fallback to finding player by nickname if frontend didn't send ID
            pID := body.PlayerID
            if pID == "" {
                if s, ok := store.GetSession(code); ok {
                    for _, p := range s.Players {
                        if p.Name == body.Nickname {
                            pID = p.ID
                            break
                        }
                    }
                }
            }

            session, err := store.SubmitGuess(code, pID, body.Choice)
            if err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }

            if bus != nil {
                _ = bus.PublishSession(ctx, session)
            } else {
                hub.broadcastSession(session.Code, session)
            }

            // Auto-advance immediately if everyone has guessed
            if allGuessed(session) {
                if nextSession, err := store.AdvanceRound(code); err == nil {
                    if bus != nil {
                        _ = bus.PublishSession(ctx, nextSession)
                    } else {
                        hub.broadcastSession(nextSession.Code, nextSession)
                    }
                    if nextSession.Game.Started {
                        scheduleAutoAdvance(ctx, code, nextSession.Game.Round, store, bus, hub)
                    } else if nextSession.Game.DistributionActive && nextSession.Game.DistributionDeadline != nil {
                        scheduleDistributionFinalize(ctx, code, *nextSession.Game.DistributionDeadline, store, bus, hub)
                    }
                }
            }

            writeJSON(w, http.StatusOK, session)
            return
        }

        // POST /api/lobbies/{code}/next
        if len(parts) == 2 && parts[1] == "next" && r.Method == http.MethodPost {
            session, err := store.AdvanceRound(code)
            if err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }
            if bus != nil {
                _ = bus.PublishSession(ctx, session)
            } else {
                hub.broadcastSession(session.Code, session)
            }
            if session.Game.Started {
                scheduleAutoAdvance(ctx, code, session.Game.Round, store, bus, hub)
            } else if session.Game.DistributionActive && session.Game.DistributionDeadline != nil {
                scheduleDistributionFinalize(ctx, code, *session.Game.DistributionDeadline, store, bus, hub)
            }
            writeJSON(w, http.StatusOK, session)
            return
        }

        // POST /api/lobbies/{code}/distribute
        if len(parts) == 2 && parts[1] == "distribute" && r.Method == http.MethodPost {
            var body struct {
                PlayerID    string         `json:"playerId"`
                Nickname    string         `json:"nickname"`
                Allocations map[string]int `json:"allocations"`
            }
            _ = json.NewDecoder(r.Body).Decode(&body)

            pID := body.PlayerID
            if pID == "" {
                if s, ok := store.GetSession(code); ok {
                    for _, p := range s.Players {
                        if p.Name == body.Nickname {
                            pID = p.ID
                            break
                        }
                    }
                }
            }
            if pID == "" {
                http.Error(w, "playerId required", http.StatusBadRequest)
                return
            }

            session, err := store.DistributeDrinks(code, pID, body.Allocations)
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

        // POST /api/lobbies/{code}/tap
        if len(parts) == 2 && parts[1] == "tap" && r.Method == http.MethodPost {
            var body struct {
                PlayerID string `json:"playerId"`
                Nickname string `json:"nickname"`
            }
            _ = json.NewDecoder(r.Body).Decode(&body)

            pID := body.PlayerID
            if pID == "" {
                if s, ok := store.GetSession(code); ok {
                    for _, p := range s.Players {
                        if p.Name == body.Nickname {
                            pID = p.ID
                            break
                        }
                    }
                }
            }
            if pID == "" {
                http.Error(w, "playerId required", http.StatusBadRequest)
                return
            }

            session, err := store.TapOut(code, pID)
            if err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }

            if bus != nil {
                _ = bus.PublishSession(ctx, session)
            } else {
                hub.broadcastSession(session.Code, session)
            }

            // if everyone else already guessed, advance now
            if allGuessed(session) {
                if nextSession, err := store.AdvanceRound(code); err == nil {
                    if bus != nil {
                        _ = bus.PublishSession(ctx, nextSession)
                    } else {
                        hub.broadcastSession(nextSession.Code, nextSession)
                    }
                    if nextSession.Game.Started {
                        scheduleAutoAdvance(ctx, code, nextSession.Game.Round, store, bus, hub)
                    } else if nextSession.Game.DistributionActive && nextSession.Game.DistributionDeadline != nil {
                        scheduleDistributionFinalize(ctx, code, *nextSession.Game.DistributionDeadline, store, bus, hub)
                    }
                }
            }

            writeJSON(w, http.StatusOK, session)
            return
        }

        http.NotFound(w, r)
    })

    server := &http.Server{
        Addr:    ":3000",
        Handler: mux,
    }

    go func() {
        log.Println("backend listening on :3000")
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("listen: %s\n", err)
        }
    }()

    // Wait for interrupt signal to gracefully shutdown the server
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    log.Println("Shutting down server...")

    ctxShutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    if err := server.Shutdown(ctxShutdown); err != nil {
        log.Fatal("Server forced to shutdown:", err)
    }

    log.Println("Server exiting")
}

func allGuessed(s *Session) bool {
    if !s.Game.Started {
        return false
    }
    expected := len(s.Game.ActivePlayers)
    if expected <= 0 {
        return false
    }
    actual := 0
    for _, pid := range s.Game.ActivePlayers {
        guesses := s.Game.Guesses[pid]
        if len(guesses) > s.Game.Round && guesses[s.Game.Round] != "" {
            actual++
        }
    }
    return actual >= expected
}

func scheduleAutoAdvance(ctx context.Context, code string, round int, store *RedisStore, bus *redisBus, hub *lobbyHub) {
    time.AfterFunc(RoundDuration, func() {
        session, ok := store.GetSession(code)
        // If game ended or round already advanced, do nothing
        if !ok || !session.Game.Started || session.Game.Round != round {
            return
        }

        if nextSession, err := store.AdvanceRound(code); err == nil {
            if bus != nil {
                _ = bus.PublishSession(ctx, nextSession)
            } else {
                hub.broadcastSession(nextSession.Code, nextSession)
            }

            if nextSession.Game.Started {
                scheduleAutoAdvance(ctx, code, nextSession.Game.Round, store, bus, hub)
            } else if nextSession.Game.DistributionActive && nextSession.Game.DistributionDeadline != nil {
                scheduleDistributionFinalize(ctx, code, *nextSession.Game.DistributionDeadline, store, bus, hub)
            }
        }
    })
}

func scheduleDistributionFinalize(ctx context.Context, code string, expectedDeadline time.Time, store *RedisStore, bus *redisBus, hub *lobbyHub) {
    wait := time.Until(expectedDeadline)
    if wait < 0 {
        wait = 0
    }
    time.AfterFunc(wait, func() {
        session, ok := store.GetSession(code)
        if !ok || !session.Game.DistributionActive || session.Game.DistributionDeadline == nil {
            return
        }
        if !session.Game.DistributionDeadline.Equal(expectedDeadline) {
            return // stale timer
        }

        nextSession, err := store.FinalizeDistribution(code)
        if err != nil {
            return
        }
        if bus != nil {
            _ = bus.PublishSession(ctx, nextSession)
        } else {
            hub.broadcastSession(nextSession.Code, nextSession)
        }
    })
}

func allowCORS(w http.ResponseWriter) {
    allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
    if allowedOrigin == "" {
        allowedOrigin = "*" // Dev mode fallback
    }
    w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
    w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(v)
}

func generateRandomHostName() string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const length = 16
    
    rand.Seed(time.Now().UnixNano())
    b := make([]byte, length)
    for i := range b {
        b[i] = charset[rand.Intn(len(charset))]
    }
    return "Host_" + string(b)
}