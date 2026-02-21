import { useState, useEffect } from 'react';

const useCountdown = (deadline) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [formattedTime, setFormattedTime] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!deadline) {
      setTimeLeft(null);
      setFormattedTime(null);
      setIsExpired(false);
      return;
    }

    const deadlineTime = new Date(deadline).getTime();
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = deadlineTime - now;
      
      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
        setFormattedTime('00:00');
        return;
      }
      
      setIsExpired(false);
      setTimeLeft(difference);
      
      // Format as MM:SS
      const minutes = Math.floor(difference / 60000);
      const seconds = Math.floor((difference % 60000) / 1000);
      setFormattedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  return { timeLeft, formattedTime, isExpired };
};

export default useCountdown;