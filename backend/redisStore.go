package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"time"

	redis "github.com/redis/go-redis/v9"
)

type sessionStore interface {
    CreateSession(hostName string) (*Session, Player, error)
    JoinSession(code, name string) (Player, *Session, error)
    GetSession(code string) (*Session, bool)
    CloseSession(code string, grace time.Duration) (*Session, error)
    StartSession(code string) (*Session, error)
    SubmitGuess(code, playerID, guess string) (*Session, error)
    AdvanceRound(code string) (*Session, error)
}

type RedisStore struct {
    ctx context.Context
    rdb *redis.Client
    ttl time.Duration
}

func newRedisStore(ctx context.Context) (*RedisStore, error) {
    addr := os.Getenv("REDIS_ADDR")
    if addr == "" {
        addr = "redis:6379"
    }
    rdb := redis.NewClient(&redis.Options{Addr: addr})
    if err := rdb.Ping(ctx).Err(); err != nil {
        return nil, err
    }
    return &RedisStore{ctx: ctx, rdb: rdb, ttl: 2 * time.Hour}, nil
}

func sessionKey(code string) string { return "session:" + normalizeCode(code) }

func (s *RedisStore) CreateSession(hostName string) (*Session, Player, error) {
    hostName = strings.TrimSpace(hostName)
    if hostName == "" {
        hostName = "Host"
    }
    host := Player{ID: newID("host_"), Name: hostName}

    for i := 0; i < maxCodeGenerationAttempts; i++ {
        code, err := generateLobbyCode()
        if err != nil {
            return nil, Player{}, err
        }
        session := &Session{
            HostID:    host.ID,
            Code:      code,
            Players:   []Player{host},
            CreatedAt: time.Now().UTC(),
            Game:      GameState{},
            Status:    "active",
        }
        b, _ := json.Marshal(session)
        ok, err := s.rdb.SetNX(s.ctx, sessionKey(code), b, s.ttl).Result()
        if err != nil {
            return nil, Player{}, err
        }
        if ok {
            return session, host, nil
        }
    }
    return nil, Player{}, errors.New("unable to generate unique lobby code")
}

func (s *RedisStore) GetSession(code string) (*Session, bool) {
    raw, err := s.rdb.Get(s.ctx, sessionKey(code)).Result()
    if err != nil {
        return nil, false
    }
    var session Session
    if err := json.Unmarshal([]byte(raw), &session); err != nil {
        return nil, false
    }
    return &session, true
}

func (s *RedisStore) JoinSession(code, name string) (Player, *Session, error) {
    session, ok := s.GetSession(code)
    if !ok {
        return Player{}, nil, errors.New("session not found")
    }
    if session.Status != "active" {
        return Player{}, nil, errors.New("session is closing")
    }
    name = strings.TrimSpace(name)
    if name == "" {
        return Player{}, nil, errors.New("name required")
    }

    player := Player{ID: newID("player_"), Name: name}
    session.Players = append(session.Players, player)

    b, _ := json.Marshal(session)
    if err := s.rdb.Set(s.ctx, sessionKey(code), b, s.ttl).Err(); err != nil {
        return Player{}, nil, err
    }
    return player, session, nil
}

func (s *RedisStore) CloseSession(code string, grace time.Duration) (*Session, error) {
    session, ok := s.GetSession(code)
    if !ok {
        return nil, errors.New("session not found")
    }
    t := time.Now().UTC().Add(grace)
    session.Status = "closing"
    session.ShuttingDownAt = &t

    b, _ := json.Marshal(session)
    if err := s.rdb.Set(s.ctx, sessionKey(code), b, grace).Err(); err != nil {
        return nil, err
    }
    return session, nil
}

func (s *RedisStore) StartSession(code string) (*Session, error) {
    session, ok := s.GetSession(code)
    if !ok {
        return nil, errors.New("session not found")
    }
    if err := StartGame(session); err != nil {
        return nil, err
    }
    b, _ := json.Marshal(session)
    if err := s.rdb.Set(s.ctx, sessionKey(code), b, s.ttl).Err(); err != nil {
        return nil, err
    }
    return session, nil
}

func (s *RedisStore) SubmitGuess(code, playerID, guess string) (*Session, error) {
    session, ok := s.GetSession(code)
    if !ok {
        return nil, errors.New("session not found")
    }
    if err := SubmitGuess(session, playerID, guess); err != nil {
        return nil, err
    }
    b, _ := json.Marshal(session)
    if err := s.rdb.Set(s.ctx, sessionKey(code), b, s.ttl).Err(); err != nil {
        return nil, err
    }
    return session, nil
}

func (s *RedisStore) AdvanceRound(code string) (*Session, error) {
    session, ok := s.GetSession(code)
    if !ok {
        return nil, errors.New("session not found")
    }
    if err := AdvanceRound(session); err != nil {
        return nil, err
    }
    b, _ := json.Marshal(session)
    if err := s.rdb.Set(s.ctx, sessionKey(code), b, s.ttl).Err(); err != nil {
        return nil, err
    }
    return session, nil
}