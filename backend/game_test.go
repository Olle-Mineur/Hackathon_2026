package main

import "testing"

func TestValidGuessForRound(t *testing.T) {
    tests := []struct {
        round    int
        guess    string
        expected bool
    }{
        {0, "red", true},
        {0, "black", true},
        {0, "higher", false},
        {1, "higher", true},
        {2, "between", true},
        {2, "inside", true}, // normalized to between
        {3, "hearts", true},
        {4, "red", false},   // invalid round
    }

    for _, tt := range tests {
        normalized := normalizeGuess(tt.guess)
        result := validGuessForRound(tt.round, normalized)
        if result != tt.expected {
            t.Errorf("validGuessForRound(%d, %s): expected %v, got %v", tt.round, tt.guess, tt.expected, result)
        }
    }
}