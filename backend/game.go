package main
type Suit string

const (
    Hearts   Suit = "hearts"
    Diamonds Suit = "diamonds"
    Clubs    Suit = "clubs"
    Spades   Suit = "spades"
)

var Suits = []Suit{
    Hearts,
    Diamonds,
    Clubs,
    Spades,
}

type Card struct {
    Rank int  `json:"rank"` // 2..14 (A=14)
    Suit Suit `json:"suit"`
}

type GameState struct {
    Started bool                 `json:"started"`
    Round   int                  `json:"round"` // 0..3
    Shared  [4]Card              `json:"shared"`
    Guesses map[string][]string  `json:"guesses"`
}
/*
gameState = GameState{
    Started: true,
    Round: 1,
    Shared: {}
    Guesses: {}
};
func start_game() {
    gameState = GameState{
    Started: true,
    Round: 1,
    Shared: {}
    Guesses: {}
    };
    for i := 0; i < 4; i++ {
        Shared[i] = draw_card();
    }

}

func draw_card() Card {
    card_is_unique := false;
    while(!card_is_unique) {
        card_is_unique = true;
        rank := int(rand.Int31n(12) + 2);
        suit := Suits[rand.Int31n(3)];
        drawn_card := Card{
            Rank: rank,
            Suit: suit,
        }
        for i := 0; i < gameState.Guesses(arr); i++ {
            if is_card_equal(drawn_card, gameState.Guesses[i]) {
                card_is_unique = false;
            }
        }
        for i := 0; i < gameState.Guesses(arr); i++ {
            if is_card_equal(drawn_card, gameState.Guesses[i]) {
                card_is_unique = false;
            }
        }
    }

}

func is_card_equal(Card card1, Card card2) boolean {
    return (card1.Rank == card2.Rank) && (card1.Suit == card2.Suit);
}
*/

