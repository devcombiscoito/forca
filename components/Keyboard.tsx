import React, { useCallback, useEffect, useState } from 'react';

interface KeyboardProps {
  guessedLetters: Set<string>;
  targetWord: string;
  onGuess: (letter: string) => void;
  disabled: boolean;
}

const KEYS = [
  "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P",
  "A", "S", "D", "F", "G", "H", "J", "K", "L",
  "Z", "X", "C", "V", "B", "N", "M"
];

export const Keyboard: React.FC<KeyboardProps> = ({ guessedLetters, targetWord, onGuess, disabled }) => {
  const [lastPressed, setLastPressed] = useState<string | null>(null);

  const handleInput = useCallback((char: string) => {
    if (disabled) return;
    setLastPressed(char);
    // Reset animation trigger
    setTimeout(() => setLastPressed(null), 200);
    onGuess(char);
  }, [disabled, onGuess]);
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const char = event.key.toUpperCase();
    if (/^[A-Z]$/.test(char)) {
      handleInput(char);
    }
  }, [handleInput]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="w-full max-w-3xl mx-auto px-2">
        <div className="flex flex-wrap justify-center gap-2">
            {KEYS.map((key) => {
                const isGuessed = guessedLetters.has(key);
                const isCorrect = isGuessed && targetWord.includes(key);
                const isWrong = isGuessed && !targetWord.includes(key);
                const isLastPressed = lastPressed === key;

                // Base Style
                let buttonStyle = `
                  bg-theme-surface border-theme-border text-theme-text 
                  hover:border-neon-cyan hover:text-neon-cyan hover:shadow-[0_0_15px_rgba(0,243,255,0.3)] hover:-translate-y-1 hover:scale-110
                `;
                
                // State Overrides
                if (isCorrect) {
                    buttonStyle = 'bg-theme-surface border-neon-lime text-neon-lime shadow-[0_0_10px_rgba(var(--neon-lime),0.3)] scale-95 opacity-100';
                } else if (isWrong) {
                    buttonStyle = 'bg-transparent border-transparent text-theme-muted opacity-20 scale-90';
                }

                // Active/Click Effect
                if (isLastPressed) {
                  buttonStyle += ' scale-90 brightness-150 transition-none';
                }

                return (
                    <button
                        key={key}
                        onClick={() => handleInput(key)}
                        disabled={isGuessed || disabled}
                        className={`
                            w-9 h-12 sm:w-11 sm:h-14 text-sm sm:text-base font-bold 
                            transition-all duration-300 border rounded-sm
                            ${buttonStyle}
                            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                        `}
                    >
                        {key}
                    </button>
                )
            })}
        </div>
    </div>
  );
};