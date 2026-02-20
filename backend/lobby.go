package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

func main() {
    store := newStore()
    hub := newLobbyHub()
    mux := http.NewServeMux()

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

        hub.broadcastSession(session.Code, session)

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

            hub.broadcastSession(session.Code, session)

            writeJSON(w, http.StatusOK, map[string]any{
                "playerId": player.ID,
                "session":  session,
            })
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