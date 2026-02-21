const CardDisplay = ({ currentCard, previousCard, phase }) => {
  // If no card yet
  if (!currentCard) {
    return (
      <div className="bg-gray-800 rounded-xl p-12 text-center">
        <div className="text-6xl mb-4">🃏</div>
        <p className="text-gray-400">Waiting for next card...</p>
      </div>
    );
  }

  // Get suit symbol and color
  const getSuitSymbol = (suit) => {
    const symbols = {
      hearts: "♥",
      diamonds: "♦",
      clubs: "♣",
      spades: "♠",
    };
    return symbols[suit?.toLowerCase()] || "?";
  };

  const getSuitColor = (suit) => {
    const redSuits = ["hearts", "diamonds"];
    return redSuits.includes(suit?.toLowerCase())
      ? "text-red-500"
      : "text-black";
  };

  // Format card value
  const formatValue = (value) => {
    const values = {
      1: "A",
      11: "J",
      12: "Q",
      13: "K",
    };
    return values[value] || value;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Previous Card (if exists) */}
      {previousCard && (
        <div className="mb-4">
          <p className="text-gray-400 text-sm mb-2">Previous Card</p>
          <div className="bg-white rounded-lg p-3 inline-block">
            <span
              className={`text-2xl font-bold ${getSuitColor(previousCard.suit)}`}
            >
              {formatValue(previousCard.value)}{" "}
              {getSuitSymbol(previousCard.suit)}
            </span>
          </div>
        </div>
      )}

      {/* Current Card - Large Display */}
      <div className="relative">
        {/* Card */}
        <div className="w-50 h-75 bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-between p-4 transform hover:scale-105 transition-transform">
          {/* Top Left Value */}
          <div
            className={`self-start text-3xl font-bold ${getSuitColor(currentCard.suit)}`}
          >
            {formatValue(currentCard.value)}
          </div>

          {/* Center Suit */}
          <div className={`text-8xl ${getSuitColor(currentCard.suit)}`}>
            {getSuitSymbol(currentCard.suit)}
          </div>

          {/* Bottom Right Value (rotated) */}
          <div
            className={`self-end text-3xl font-bold rotate-180 ${getSuitColor(currentCard.suit)}`}
          >
            {formatValue(currentCard.value)}
          </div>
        </div>

        {/* Phase Overlay */}
        {phase !== "waiting" && phase !== "result" && (
          <div className="absolute -top-3 -right-3 bg-yellow-500 text-black font-bold px-3 py-1 rounded-full text-sm animate-pulse">
            {phase === "red_black" && "🎨 Choose Color"}
            {phase === "higher_lower" && "📊 Higher/Lower"}
            {phase === "between_outside" && "🎯 Between/Outside"}
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="mt-4 text-center">
        <p className="text-gray-400">
          {currentCard.value === 1 && "Ace"}
          {currentCard.value === 11 && "Jack"}
          {currentCard.value === 12 && "Queen"}
          {currentCard.value === 13 && "King"}
          {![1, 11, 12, 13].includes(currentCard.value) && currentCard.value}
          {" of "}
          {currentCard.suit}
        </p>
      </div>
    </div>
  );
};

export default CardDisplay;
