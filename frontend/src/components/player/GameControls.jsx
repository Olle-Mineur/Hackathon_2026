import React, { useState, useEffect } from 'react';

const GameControls = ({ gameState, lobbyId, nickname, playerId, usingMock }) => {
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset selected state when round/phase changes
  useEffect(() => {
    setSelected(null);
    setError('');
  }, [gameState?.phase, gameState?.round]);

  if (!gameState) return null;

  const handleChoice = async (choice) => {
    setSelected(choice);
    setSubmitting(true);
    setError('');
    
    if (usingMock) {
      // Simulate in mock mode
      setTimeout(() => {
        console.log(`Mock: ${nickname} chose ${choice} for round ${gameState.phase}`);
        setSubmitting(false);
      }, 500);
      return;
    }
    
    try {
      // Prepare the request body according to the API spec
      const requestBody = {
        choice: choice,
      };
      
      // Add playerId if available, otherwise fall back to nickname
      if (playerId) {
        requestBody.playerId = playerId;
      } else {
        requestBody.nickname = nickname;
      }
      
      const response = await fetch(`/api/lobbies/${lobbyId}/choice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to submit choice');
      }

      console.log(`Choice ${choice} submitted successfully`);
      
    } catch (err) {
      setError(err.message || 'Failed to submit choice');
      console.error('Choice submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Get the appropriate choices based on the current round/phase
  const getChoicesForPhase = () => {
    switch (gameState.phase) {
      case 'red_black':
        return [
          { value: 'red', label: '🔴 RED', color: 'bg-red-600 hover:bg-red-700' },
          { value: 'black', label: '⚫ BLACK', color: 'bg-gray-800 hover:bg-gray-900' }
        ];
      case 'higher_lower':
        return [
          { value: 'higher', label: '📈 HIGHER', color: 'bg-green-600 hover:bg-green-700' },
          { value: 'lower', label: '📉 LOWER', color: 'bg-yellow-600 hover:bg-yellow-700' }
        ];
      case 'between_outside':
        return [
          { value: 'between', label: '↔️ BETWEEN', color: 'bg-blue-600 hover:bg-blue-700' },
          { value: 'outside', label: '⚡ OUTSIDE', color: 'bg-purple-600 hover:bg-purple-700' }
        ];
      case 'suit':
        return [
          { value: 'hearts', label: '♥️ HEARTS', color: 'bg-red-600 hover:bg-red-700' },
          { value: 'diamonds', label: '♦️ DIAMONDS', color: 'bg-red-600 hover:bg-red-700' },
          { value: 'clubs', label: '♣️ CLUBS', color: 'bg-gray-800 hover:bg-gray-900' },
          { value: 'spades', label: '♠️ SPADES', color: 'bg-gray-800 hover:bg-gray-900' }
        ];
      default:
        return [];
    }
  };

  const choices = getChoicesForPhase();

  // Check if player has already guessed this round
  const hasGuessed = gameState?.players?.find(p => 
    p.nickname === nickname
  )?.ready || false;

  // Don't show controls if no valid choices for this phase
  if (choices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="text-center text-gray-500 py-4">
          {gameState.phase === 'waiting' && 'Waiting for game to start...'}
          {!gameState.phase && 'Loading game...'}
        </div>
      </div>
    );
  }

  // Show waiting message if already guessed
  if (hasGuessed && !selected) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="text-center text-green-600 py-4">
          <p className="font-medium">✓ You've made your choice for this round</p>
          <p className="text-sm text-gray-500 mt-1">Waiting for other players...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="space-y-3">
        <p className="font-medium text-center text-gray-700">
          {gameState.phase === 'red_black' && 'Choose Red or Black:'}
          {gameState.phase === 'higher_lower' && 'Will the next card be Higher or Lower?'}
          {gameState.phase === 'between_outside' && 'Will the next card be Between or Outside?'}
          {gameState.phase === 'suit' && 'Choose your suit:'}
        </p>
        
        {/* Choice buttons grid */}
        <div className={`grid gap-3 ${
          choices.length === 4 ? 'grid-cols-2' : 'grid-cols-2'
        }`}>
          {choices.map((choice) => (
            <button
              key={choice.value}
              onClick={() => handleChoice(choice.value)}
              disabled={submitting || selected || hasGuessed}
              className={`
                ${choice.color} text-white rounded-lg font-bold py-4 px-2
                transition-all transform hover:scale-105 
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                ${selected === choice.value ? 'ring-4 ring-yellow-400 scale-105' : ''}
              `}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Selected indicator */}
      {selected && !error && (
        <p className="text-sm text-green-600 text-center mt-3">
          ✓ You chose: {selected}
          {submitting && ' (sending...)'}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 text-center mt-3">
          ⚠️ {error}
        </p>
      )}

      {/* Mock mode indicator */}
      {usingMock && (
        <p className="text-xs text-yellow-600 text-center mt-2">
          🧪 Mock mode - choices aren't sent to backend
        </p>
      )}
    </div>
  );
};

export default GameControls;