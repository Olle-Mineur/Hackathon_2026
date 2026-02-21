package main

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
)

type Suit string

const (
    Hearts   Suit = "hearts"
    Diamonds Suit = "diamonds"
    Clubs    Suit = "clubs"
    Spades   Suit = "spades"
)

var Suits = []Suit{Hearts, Diamonds, Clubs, Spades}

type Card struct {
    Rank int  `json:"rank"` // 2..14 (A=14)
    Suit Suit `json:"suit"`
}

type GameState struct {
    Started bool                `json:"started"`
    Round   int                 `json:"round"` // 0..3
    Shared  [4]Card             `json:"shared"`
    Guesses map[string][]string `json:"guesses"` // playerID -> guesses by round index
}

func StartGame(s *Session) error {
    if s == nil {
        return errors.New("session required")
    }
    if s.Game.Started {
        return errors.New("game already started")
    }

    cards, err := drawUniqueCards(4)
    if err != nil {
        return err
    }

    s.Game = GameState{
        Started: true,
        Round:   0,
        Shared:  [4]Card{cards[0], cards[1], cards[2], cards[3]},
        Guesses: map[string][]string{},
    }
    return nil
}

func SubmitGuess(s *Session, playerID, guess string) error {
    if s == nil {
        return errors.New("session required")
    }
    if !s.Game.Started {
        return errors.New("game not started")
    }
    if s.Game.Round < 0 || s.Game.Round > 3 {
        return errors.New("invalid round")
    }
    if !hasPlayer(s, playerID) {
        return errors.New("player not in session")
    }

    guess = normalizeGuess(guess)
    if !validGuessForRound(s.Game.Round, guess) {
        return errors.New("invalid guess for round")
    }

    arr := s.Game.Guesses[playerID]
    if len(arr) > s.Game.Round {
        return errors.New("guess already submitted for this round")
    }
    for len(arr) < s.Game.Round {
        arr = append(arr, "")
    }
    arr = append(arr, guess)
    s.Game.Guesses[playerID] = arr
    return nil
}

func AdvanceRound(s *Session) error {
    if s == nil {
        return errors.New("session required")
    }
    if !s.Game.Started {
        return errors.New("game not started")
    }
    if s.Game.Round > 3 {
        return errors.New("game already finished")
    }

    round := s.Game.Round
    for i := range s.Players {
        p := &s.Players[i]
        guesses := s.Game.Guesses[p.ID]
        if len(guesses) <= round {
            continue // no guess submitted
        }
        if !isCorrectGuess(s.Game.Shared, round, guesses[round]) {
            p.Score++
        }
    }

    s.Game.Round++
    if s.Game.Round > 3 {
        s.Game.Started = false
    }
    return nil
}

func validGuessForRound(round int, guess string) bool {
    switch round {
    case 0:
        return guess == "red" || guess == "black"
    case 1:
        return guess == "higher" || guess == "lower"
    case 2:
        return guess == "between" || guess == "outside" || guess == "inside"
    case 3:
        return guess == "hearts" || guess == "diamonds" || guess == "clubs" || guess == "spades"
    default:
        return false
    }
}

func normalizeGuess(g string) string {
    g = strings.ToLower(strings.TrimSpace(g))
    if g == "inside" {
        return "between"
    }
    return g
}

func isCorrectGuess(shared [4]Card, round int, guess string) bool {
    switch round {
    case 0:
        isRed := shared[0].Suit == Hearts || shared[0].Suit == Diamonds
        return (guess == "red" && isRed) || (guess == "black" && !isRed)
    case 1:
        return (guess == "higher" && shared[1].Rank > shared[0].Rank) ||
            (guess == "lower" && shared[1].Rank < shared[0].Rank)
    case 2:
        low, high := shared[0].Rank, shared[1].Rank
        if low > high {
            low, high = high, low
        }
        between := shared[2].Rank > low && shared[2].Rank < high
        outside := shared[2].Rank < low || shared[2].Rank > high
        return (guess == "between" && between) || (guess == "outside" && outside)
    case 3:
        return string(shared[3].Suit) == guess
    default:
        return false
    }
}

func hasPlayer(s *Session, playerID string) bool {
    for _, p := range s.Players {
        if p.ID == playerID {
            return true
        }
    }
    return false
}

func drawUniqueCards(n int) ([]Card, error) {
    deck := newDeck()
    if n > len(deck) {
        return nil, errors.New("requested more cards than deck size")
    }

    // Fisher-Yates shuffle using crypto randomness.
    for i := len(deck) - 1; i > 0; i-- {
        j, err := cryptoInt(i + 1)
        if err != nil {
            return nil, err
        }
        deck[i], deck[j] = deck[j], deck[i]
    }
    return deck[:n], nil
}

func newDeck() []Card {
    deck := make([]Card, 0, 52)
    for _, s := range Suits {
        for r := 2; r <= 14; r++ {
            deck = append(deck, Card{Rank: r, Suit: s})
        }
    }
    return deck
}

func cryptoInt(max int) (int, error) {
    if max <= 0 {
        return 0, errors.New("max must be > 0")
    }
    n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
    if err != nil {
        return 0, err
    }
    return int(n.Int64()), nil
}