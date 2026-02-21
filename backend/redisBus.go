package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"

	redis "github.com/redis/go-redis/v9"
)

type redisBus struct {
    rdb *redis.Client
}

func newRedisBus(ctx context.Context) (*redisBus, error) {
    addr := os.Getenv("REDIS_ADDR")
    if addr == "" {
        addr = "redis:6379"
    }

    rdb := redis.NewClient(&redis.Options{Addr: addr})
    if err := rdb.Ping(ctx).Err(); err != nil {
        return nil, err
    }
    return &redisBus{rdb: rdb}, nil
}

func lobbyChannel(code string) string {
    return "lobby:" + normalizeCode(code)
}

func (b *redisBus) PublishSession(ctx context.Context, session *Session) error {
    if b == nil || b.rdb == nil || session == nil {
        return errors.New("redis bus not initialized")
    }

    payload, err := json.Marshal(session)
    if err != nil {
        return err
    }

    return b.rdb.Publish(ctx, lobbyChannel(session.Code), payload).Err()
}

func (b *redisBus) SubscribeAndBroadcast(ctx context.Context, hub *lobbyHub) {
    if b == nil || b.rdb == nil {
        return
    }

    pubsub := b.rdb.PSubscribe(ctx, "lobby:*")
    ch := pubsub.Channel()

    go func() {
        defer pubsub.Close()
        for {
            select {
            case <-ctx.Done():
                return
            case msg, ok := <-ch:
                if !ok {
                    return
                }
                var session Session
                if err := json.Unmarshal([]byte(msg.Payload), &session); err == nil {
                    hub.broadcastSession(session.Code, &session)
                }
            }
        }
    }()
}