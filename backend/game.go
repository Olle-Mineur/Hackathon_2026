package main

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"
)

type Suit string

const (
    Hearts   Suit = "hearts"
    Diamonds Suit = "diamonds"
    Clubs    Suit = "clubs"
    Spades   Suit = "spades"
)

const RoundDuration = 15 * time.Second
const DistributionDuration = 20 * time.Second

var Suits = []Suit{Hearts, Diamonds, Clubs, Spades}

type Card struct {
    Rank int  `json:"rank"` // 2..14 (A=14)
    Suit Suit `json:"suit"`
}

type GameState struct {
    Started                  bool                `json:"started"`
    Round                    int                 `json:"round"` // 0..3 during guesses, 4+ after
    Shared                   [4]Card             `json:"shared"`
    Guesses                  map[string][]string `json:"guesses"`
    Deadline                 *time.Time          `json:"deadline,omitempty"`
    ActivePlayers            []string            `json:"activePlayers"`

    DistributionActive       bool                `json:"distributionActive"`
    DistributionDeadline     *time.Time          `json:"distributionDeadline,omitempty"`
    DrinkNowByPlayer         map[string]int      `json:"drinkNowByPlayer"`
    GiveOutRemainingByPlayer map[string]int      `json:"giveOutRemainingByPlayer"`
    PendingTapOutByPlayer    map[string]bool     `json:"pendingTapOutByPlayer"`
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

    deadline := time.Now().UTC().Add(RoundDuration)

    var active []string
    for _, p := range s.Players {
        if p.ID != s.HostID {
            active = append(active, p.ID)
        }
    }

    s.Game = GameState{
        Started:                  true,
        Round:                    0,
        Shared:                   [4]Card{cards[0], cards[1], cards[2], cards[3]},
        Guesses:                  map[string][]string{},
        Deadline:                 &deadline,
        ActivePlayers:            active,
        DistributionActive:       false,
        DistributionDeadline:     nil,
        DrinkNowByPlayer:         map[string]int{},
        GiveOutRemainingByPlayer: map[string]int{},
        PendingTapOutByPlayer:    map[string]bool{},
    }
    return nil
}

func stakeForRound(round int) int {
    switch round {
    case 0:
        return 2
    case 1:
        return 4
    case 2:
        return 8
    case 3:
        return 16
    default:
        return 0
    }
}

func TapOut(s *Session, playerID string) error {
    if s == nil {
        return errors.New("session required")
    }
    if !s.Game.Started {
        return errors.New("game not started")
    }
    if !hasPlayer(s, playerID) {
        return errors.New("player not in session")
    }

    // must be active
    isActive := false
    for _, pid := range s.Game.ActivePlayers {
        if pid == playerID {
            isActive = true
            break
        }
    }
    if !isActive {
        return errors.New("player already tapped out")
    }

    // allow tap-out request anytime during current round
    if s.Game.PendingTapOutByPlayer == nil {
        s.Game.PendingTapOutByPlayer = map[string]bool{}
    }
    if s.Game.PendingTapOutByPlayer[playerID] {
        return errors.New("tap out already requested")
    }

    s.Game.PendingTapOutByPlayer[playerID] = true
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
    stake := stakeForRound(round)

    activeMap := make(map[string]bool)
    for _, pid := range s.Game.ActivePlayers {
        activeMap[pid] = true
    }

    if s.Game.DrinkNowByPlayer == nil {
        s.Game.DrinkNowByPlayer = map[string]int{}
    }
    if s.Game.GiveOutRemainingByPlayer == nil {
        s.Game.GiveOutRemainingByPlayer = map[string]int{}
    }
    if s.Game.PendingTapOutByPlayer == nil {
        s.Game.PendingTapOutByPlayer = map[string]bool{}
    }

    // track who survives to next round (correct guess)
    correctByPlayer := make(map[string]bool)

    for i := range s.Players {
        p := &s.Players[i]
        if !activeMap[p.ID] {
            continue
        }

        guesses := s.Game.Guesses[p.ID]
        correct := false
        if len(guesses) > round {
            correct = isCorrectGuess(s.Game.Shared, round, guesses[round])
        }

        if correct {
            s.Game.GiveOutRemainingByPlayer[p.ID] += stake
            correctByPlayer[p.ID] = true
        } else {
            s.Game.DrinkNowByPlayer[p.ID] += stake
            p.Score += stake
            p.LifetimeDrank += stake
            correctByPlayer[p.ID] = false
        }
    }

    // keep only correct players who did not request tap-out
    nextActive := make([]string, 0, len(s.Game.ActivePlayers))
    for _, pid := range s.Game.ActivePlayers {
        if !correctByPlayer[pid] {
            continue
        }
        if s.Game.PendingTapOutByPlayer[pid] {
            continue
        }
        nextActive = append(nextActive, pid)
    }
    s.Game.ActivePlayers = nextActive
    s.Game.PendingTapOutByPlayer = map[string]bool{}

    s.Game.Round++
    if s.Game.Round > 3 {
        deadline := time.Now().UTC().Add(DistributionDuration)
        s.Game.Started = false
        s.Game.Deadline = nil
        s.Game.DistributionActive = true
        s.Game.DistributionDeadline = &deadline
        return nil
    }

    next := time.Now().UTC().Add(RoundDuration)
    s.Game.Deadline = &next
    return nil
}

func DistributeDrinks(s *Session, fromPlayerID string, allocations map[string]int) error {
    if s == nil {
        return errors.New("session required")
    }
    if !s.Game.DistributionActive {
        return errors.New("distribution not active")
    }
    if fromPlayerID == "" {
        return errors.New("player required")
    }

    remaining := s.Game.GiveOutRemainingByPlayer[fromPlayerID]
    if remaining <= 0 {
        return errors.New("no drinks left to give")
    }

    validTarget := map[string]bool{}
    for _, pid := range s.Game.ActivePlayers {
        validTarget[pid] = true
    }

    used := 0
    for targetID, amount := range allocations {
        if amount <= 0 {
            continue
        }
        if targetID == fromPlayerID {
            return errors.New("cannot give drinks to yourself")
        }
        if !validTarget[targetID] {
            return errors.New("invalid target player")
        }
        used += amount
    }
    if used <= 0 {
        return errors.New("no allocation provided")
    }
    if used > remaining {
        return errors.New("allocated more than available")
    }

    for targetID, amount := range allocations {
        if amount <= 0 {
            continue
        }
        s.Game.DrinkNowByPlayer[targetID] += amount
        for i := range s.Players {
            if s.Players[i].ID == targetID {
                s.Players[i].Score += amount
                s.Players[i].LifetimeDrank += amount
                break
            }
        }
    }

    s.Game.GiveOutRemainingByPlayer[fromPlayerID] -= used
    for i := range s.Players {
        if s.Players[i].ID == fromPlayerID {
            s.Players[i].GivenOut += used
            break
        }
    }

    if allDistributed(s) {
        return FinalizeDistribution(s)
    }
    return nil
}

func FinalizeDistribution(s *Session) error {
    if s == nil {
        return errors.New("session required")
    }
    if !s.Game.DistributionActive {
        return nil
    }

    targets := append([]string{}, s.Game.ActivePlayers...)
    for giverID, left := range s.Game.GiveOutRemainingByPlayer {
        for left > 0 {
            pool := make([]string, 0, len(targets))
            for _, t := range targets {
                if t != giverID {
                    pool = append(pool, t)
                }
            }
            if len(pool) == 0 {
                break
            }
            j, err := cryptoInt(len(pool))
            if err != nil {
                return err
            }
            targetID := pool[j]
            s.Game.DrinkNowByPlayer[targetID]++
            for i := range s.Players {
                if s.Players[i].ID == targetID {
                    s.Players[i].Score++
                    s.Players[i].LifetimeDrank++
                    break
                }
            }
            s.Game.GiveOutRemainingByPlayer[giverID]--
            left--
        }
    }

    s.Game.DistributionActive = false
    s.Game.DistributionDeadline = nil
    s.Game.Deadline = nil
    return nil
}

func allDistributed(s *Session) bool {
    if s == nil {
        return false
    }
    for _, pid := range s.Game.ActivePlayers {
        if s.Game.GiveOutRemainingByPlayer[pid] > 0 {
            return false
        }
    }
    return true
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