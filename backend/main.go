package main

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"sync"
	"time"
)

const maxCodeGenerationAttempts = 256

type Player struct {
    ID    string `json:"id"`
    Name  string `json:"name"`
    Score int    `json:"score"`
}

type Session struct {
    HostID    string    `json:"hostId"`
    Code      string    `json:"code"`
    Players   []Player  `json:"players"`
    CreatedAt time.Time `json:"createdAt"`
    Game      GameState `json:"game"`
}

type Store struct {
    mu       sync.RWMutex
    sessions map[string]*Session
}

func newStore() *Store {
    return &Store{sessions: map[string]*Session{}}
}

func normalizeCode(code string) string {
    return strings.ToUpper(strings.TrimSpace(code))
}

func (s *Store) CreateSession(hostName string) (*Session, Player, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    var code string
    for i := 0; i < maxCodeGenerationAttempts; i++ {
        candidate, err := generateLobbyCode()
        if err != nil {
            return nil, Player{}, err
        }
        if _, exists := s.sessions[candidate]; exists {
            continue
        }
        code = candidate
        break
    }
    if code == "" {
        return nil, Player{}, errors.New("unable to generate unique lobby code")
    }

    hostName = strings.TrimSpace(hostName)
    if hostName == "" {
        hostName = "Host"
    }

    host := Player{ID: newID(), Name: hostName}
    session := &Session{
        HostID:    host.ID,
        Code:      code,
        Players:   []Player{host},
        CreatedAt: time.Now().UTC(),
        Game:      GameState{},
    }
    s.sessions[code] = session
    return session, host, nil
}

func (s *Store) JoinSession(code, name string) (Player, *Session, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    session, ok := s.sessions[normalizeCode(code)]
    if !ok {
        return Player{}, nil, errors.New("session not found")
    }

    name = strings.TrimSpace(name)
    if name == "" {
        return Player{}, nil, errors.New("name required")
    }

    player := Player{
        ID:   newID(),
        Name: name,
    }
    session.Players = append(session.Players, player)

    return player, session, nil
}

func (s *Store) GetSession(code string) (*Session, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    session, ok := s.sessions[normalizeCode(code)]
    return session, ok
}

//func (s *Store) StartSession(code string) (*Session, error) {
//    s.mu.Lock()
//    defer s.mu.Unlock()
//
//    session, ok := s.sessions[normalizeCode(code)]
//    if !ok {
//        return nil, errors.New("session not found")
//    }
//
//    if err := StartGame(session); err != nil {
//        return nil, err
//    }
//
//    return session, nil
//}

var adjectives = []string{"brave", "happy", "rapid", "silent", "mighty", "wild"}
var animals = []string{"otter", "panda", "falcon", "tiger", "rabbit", "wolf", "jocke"}
var verbs = []string{"jumps", "dances", "drifts", "runs", "spins", "glows", "drinks", "smokes"}

func generateLobbyCode() (string, error) {
    a, err := pickWord(adjectives)
    if err != nil {
        return "", err
    }
    b, err := pickWord(animals)
    if err != nil {
        return "", err
    }
    c, err := pickWord(verbs)
    if err != nil {
        return "", err
    }
    return strings.ToUpper(a + "-" + b + "-" + c), nil
}

func pickWord(words []string) (string, error) {
    i, err := cryptoIndex(len(words))
    if err != nil {
        return "", err
    }
    return words[i], nil
}

func cryptoIndex(max int) (int, error) {
    if max <= 0 {
        return 0, errors.New("max must be > 0")
    }
    n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
    if err != nil {
        return 0, err
    }
    return int(n.Int64()), nil
}

func newID() string {
    id, err := generateLobbyCode()
    if err != nil {
        return "fallback-id"
    }
    return id
}