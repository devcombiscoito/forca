import React from 'react';

interface WordDisplayProps {
  word: string;
  guessedLetters: Set<string>;
  revealAll: boolean;
}

export const WordDisplay: React.FC<WordDisplayProps> = ({ word, guessedLetters, revealAll }) => {
  const normalize = (char: string) => char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4 my-10 px-4 min-h-[80px]">
      {word.split('').map((char, index) => {
        const normalizedChar = normalize(char);
        const isSpecial = !/[a-zA-Z0-9]/.test(char);
        const isGuessed = guessedLetters.has(normalizedChar) || isSpecial;
        
        // Logic states
        const isVisible = isGuessed || revealAll;
        const isCorrectGuess = isGuessed && !isSpecial;
        const isMissed = revealAll && !isGuessed;

        if (char === ' ') {
            return <div key={index} className="w-6 sm:w-8"></div>;
        }

        return (
          <div 
            key={index} 
            className="flex flex-col items-center justify-end w-8 sm:w-12 group relative"
          >
            <span className={`
              text-3xl sm:text-5xl font-light mb-2
              transition-all duration-500
              ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
              
              ${isCorrectGuess 
                  ? 'text-neon-cyan drop-shadow-[0_0_8px_var(--neon-cyan)] animate-pop' 
                  : ''}
              
              ${isMissed 
                  ? 'text-neon-error opacity-60 animate-shake' 
                  : ''}
                  
              ${!isCorrectGuess && !isMissed ? 'text-theme-text' : ''}
            `}>
              {char}
            </span>
            
            {/* Underline */}
            <div className={`
                w-full h-[2px] transition-all duration-500 rounded-full
                ${isVisible 
                    ? (isMissed ? 'bg-neon-error/50' : 'bg-neon-cyan shadow-[0_0_10px_var(--neon-cyan)]') 
                    : 'bg-theme-border group-hover:bg-theme-muted'}
            `} />
          </div>
        );
      })}
    </div>
  );
};