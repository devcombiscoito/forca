import React from 'react';

interface HangmanFigureProps {
  livesLeft: number;
  maxLives: number;
}

export const HangmanFigure: React.FC<HangmanFigureProps> = ({ livesLeft, maxLives }) => {
  const mistakes = maxLives - livesLeft;
  
  const parts = [
    // Base structure
    <g key="gallows">
      <line x1="40" y1="280" x2="260" y2="280" className="stroke-theme-border" strokeWidth="2" />
      <line x1="100" y1="280" x2="100" y2="40" className="stroke-theme-border" strokeWidth="2" />
      <line x1="100" y1="40" x2="200" y2="40" className="stroke-theme-border" strokeWidth="2" />
      <line x1="200" y1="40" x2="200" y2="80" className="stroke-neon-error" strokeWidth="2" />
    </g>,
    // Head
    <circle key="head" cx="200" cy="100" r="20" className="stroke-theme-text fill-transparent animate-slide-up" strokeWidth="2" />,
    // Body
    <line key="body" x1="200" y1="120" x2="200" y2="200" className="stroke-theme-text animate-slide-up" strokeWidth="2" />,
    // Left Arm
    <line key="l-arm" x1="200" y1="140" x2="160" y2="180" className="stroke-theme-text animate-slide-up" strokeWidth="2" />,
    // Right Arm
    <line key="r-arm" x1="200" y1="140" x2="240" y2="180" className="stroke-theme-text animate-slide-up" strokeWidth="2" />,
    // Left Leg
    <line key="l-leg" x1="200" y1="200" x2="170" y2="250" className="stroke-theme-text animate-slide-up" strokeWidth="2" />,
    // Right Leg
    <line key="r-leg" x1="200" y1="200" x2="230" y2="250" className="stroke-theme-text animate-slide-up" strokeWidth="2" />,
  ];

  const renderParts = () => {
      const visible = [parts[0]]; // Base sempre visível
      
      if (mistakes === 0) return visible;

      const steps = 6; // Partes do corpo padrão
      const progress = mistakes / maxLives; 
      const partsToShow = Math.ceil(progress * steps);

      for(let i = 1; i <= partsToShow; i++) {
          if (parts[i]) visible.push(parts[i]);
      }
      return visible;
  };

  return (
    <div className="relative flex justify-center items-center h-64 w-full mx-auto my-4">
       <svg width="300" height="300" viewBox="0 0 300 300">
          {renderParts()}
       </svg>
    </div>
  );
};