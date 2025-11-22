import React, { useState, useCallback, useEffect } from 'react';
import { GameState, GameStatus, GameMode, Difficulty, WordData, Settings } from './types';
import { generateWordData } from './services/geminiService';
import { HangmanFigure } from './components/HangmanFigure';
import { WordDisplay } from './components/WordDisplay';
import { Keyboard } from './components/Keyboard';
import { Brain, Play, Trophy, Sparkles, RotateCcw, Info, Skull, Users, Settings as SettingsIcon, X, ChevronRight, Lock, Moon, Sun, Zap, ShieldAlert, Swords, Gauge } from 'lucide-react';

// OPTIMIZATION: Moved helper outside component to prevent recreation on render
const normalizeChar = (char: string) => char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

const App: React.FC = () => {
  const [state, setState] = useState<GameState>({
    status: GameStatus.IDLE,
    mode: GameMode.CLASSIC,
    difficulty: Difficulty.NORMAL,
    currentWord: '',
    normalizedWord: '',
    category: '',
    hint: '',
    guessedLetters: new Set(),
    lives: 6,
    maxLives: 6,
    score: 0,
    streak: 0,
    loading: false,
    error: null,
    megaBrutalUnlocked: false,
    settings: {
      theme: 'dark',
      strictMode: false,
      animations: true,
      effects: true
    }
  });

  const [showSettings, setShowSettings] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  
  // Versus Mode States
  const [versusP1Word, setVersusP1Word] = useState('');
  const [versusP1Hint, setVersusP1Hint] = useState('');

  // Load persisted data
  useEffect(() => {
    const savedMega = localStorage.getItem('forca_mega_unlocked');
    const savedSettings = localStorage.getItem('forca_settings');
    
    let initialSettings = state.settings;

    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            initialSettings = { ...state.settings, ...parsed };
        } catch (e) {
            console.error("Failed to parse settings", e);
        }
    }

    setState(prev => ({
      ...prev,
      megaBrutalUnlocked: savedMega === 'true',
      settings: initialSettings
    }));
  }, []);

  // Apply settings to DOM
  useEffect(() => {
      const doc = document.documentElement;
      
      // Apply Theme
      doc.setAttribute('data-theme', state.settings.theme);
      
      // Apply Performance Settings (data attributes handled by index.html CSS)
      doc.setAttribute('data-anim', String(state.settings.animations));
      doc.setAttribute('data-fx', String(state.settings.effects));

      // Persist
      localStorage.setItem('forca_settings', JSON.stringify(state.settings));
      localStorage.setItem('forca_theme', state.settings.theme); // Legacy support
  }, [state.settings]);

  const toggleTheme = () => {
    const newTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: newTheme });
  };

  const updateSettings = (newSettings: Partial<Settings>) => {
      setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...newSettings }
      }));
  };

  // Step 1: Select Mode
  const selectMode = (mode: GameMode, extraData?: string) => {
    if (mode === GameMode.VERSUS) {
      setState(prev => ({ ...prev, status: GameStatus.VERSUS_SETUP, mode: GameMode.VERSUS, error: null }));
      setVersusP1Word('');
      setVersusP1Hint('');
      return;
    }

    // Go to difficulty selection for AI modes
    setState(prev => ({
      ...prev,
      mode: mode,
      status: GameStatus.DIFFICULTY_SELECT,
      error: null,
    }));
  };

  // Step 2: Select Difficulty & Start Game
  const startGame = async (difficulty: Difficulty) => {
    let lives = 6;
    if (difficulty === Difficulty.CASUAL) lives = 8;
    if (difficulty === Difficulty.BRUTAL) lives = 3;
    if (difficulty === Difficulty.MEGA_BRUTAL) lives = 1;

    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      difficulty: difficulty,
      maxLives: lives,
      lives: lives
    }));

    let geminiMode: 'random' | 'topic' = 'random';
    if (state.mode === GameMode.THEMATIC) geminiMode = 'topic';

    try {
      const data: WordData = await generateWordData(geminiMode, difficulty, customTopic);
      startRound(data);
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Falha na conexão com a IA. Tente novamente." 
      }));
    }
  };

  const startVersusRound = () => {
    if (!versusP1Word.trim()) return;
    
    const data: WordData = {
      word: versusP1Word.trim().toUpperCase(),
      hint: versusP1Hint.trim() || "Sem dica disponível",
      category: "Desafio Versus"
    };
    
    setState(prev => ({
      ...prev,
      maxLives: 6,
      lives: 6,
      difficulty: Difficulty.NORMAL // Default for versus
    }));

    startRound(data);
  };

  const startRound = (data: WordData) => {
    setState(prev => ({
      ...prev,
      status: GameStatus.PLAYING,
      currentWord: data.word,
      normalizedWord: normalizeChar(data.word),
      category: data.category,
      hint: data.hint,
      guessedLetters: new Set(),
      lives: prev.maxLives,
      loading: false
    }));
  };

  const handleGuess = useCallback((letter: string) => {
    // Optimization: Check status early to avoid unnecessary logic
    if (state.status !== GameStatus.PLAYING || state.loading) return;

    const normalizedGuess = letter.toUpperCase();
    
    setState(prev => {
      if (prev.guessedLetters.has(normalizedGuess)) return prev;

      const newGuessed = new Set(prev.guessedLetters);
      newGuessed.add(normalizedGuess);

      const isCorrect = prev.normalizedWord.includes(normalizedGuess);
      const newLives = isCorrect ? prev.lives : prev.lives - 1;
      
      let newStatus = prev.status;
      let newScore = prev.score;
      let newStreak = prev.streak;
      let newMegaUnlock = prev.megaBrutalUnlocked;

      if (newLives === 0) {
        newStatus = GameStatus.LOST;
        newStreak = 0;
      } else {
        // Optimization: calculate unique letters once
        const uniqueWordLetters = new Set(prev.normalizedWord.split('').filter(c => /[A-Z]/.test(c)));
        const isWin = Array.from(uniqueWordLetters).every(l => newGuessed.has(l));
        
        if (isWin) {
          newStatus = GameStatus.WON;
          let points = 100 * newLives;
          if (prev.difficulty === Difficulty.BRUTAL) points *= 2;
          if (prev.difficulty === Difficulty.MEGA_BRUTAL) points *= 5;
          
          newScore += points;
          newStreak += 1;

          // Unlock Mega Brutal if won on Brutal
          if (prev.difficulty === Difficulty.BRUTAL && !prev.megaBrutalUnlocked) {
            newMegaUnlock = true;
            localStorage.setItem('forca_mega_unlocked', 'true');
          }
        }
      }

      return {
        ...prev,
        guessedLetters: newGuessed,
        lives: newLives,
        status: newStatus,
        score: newScore,
        streak: newStreak,
        megaBrutalUnlocked: newMegaUnlock
      };
    });
  }, [state.status, state.loading]);

  // --- COMPONENTS RENDERING ---

  const renderSettings = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-theme-surface border border-theme-border w-full max-w-md p-6 relative shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-theme-muted hover:text-theme-text transition-colors">
          <X size={24} />
        </button>
        <h2 className="text-2xl font-light mb-8 text-theme-text border-b border-theme-border pb-4 flex items-center gap-2">
           <SettingsIcon size={20} />
           Ajustes
        </h2>
        
        <div className="space-y-8">
          {/* Appearance */}
          <div className="flex items-center justify-between group">
             <div className="flex flex-col">
                 <span className="text-theme-text text-sm uppercase tracking-widest font-bold flex items-center gap-2"><Moon size={14} /> Aparência</span>
                 <span className="text-theme-muted text-xs">Alterne entre modos de visualização</span>
             </div>
             <button 
               onClick={toggleTheme}
               className="flex items-center gap-3 px-5 py-2 border border-theme-border rounded-full hover:border-neon-cyan hover:text-neon-cyan transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(var(--neon-cyan),0.2)]"
             >
               {state.settings.theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
               <span className="font-mono text-sm">{state.settings.theme === 'dark' ? 'NOIR' : 'BLANC'}</span>
             </button>
          </div>
          
          <div className="h-px bg-theme-border w-full" />

          {/* Performance Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-theme-text text-sm uppercase tracking-widest font-bold">
                <Gauge size={14} />
                Desempenho
            </div>
            
            {/* Toggle Animations */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-theme-text text-sm">Animações</span>
                    <span className="text-theme-muted text-xs">Transições suaves e movimentos</span>
                </div>
                <button 
                    onClick={() => updateSettings({ animations: !state.settings.animations })}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 border ${state.settings.animations ? 'bg-neon-cyan/20 border-neon-cyan' : 'bg-theme-bg border-theme-border'}`}
                >
                    <div className={`w-4 h-4 rounded-full bg-current transition-transform duration-300 ${state.settings.animations ? 'translate-x-6 text-neon-cyan' : 'translate-x-0 text-theme-muted'}`} />
                </button>
            </div>

            {/* Toggle Effects */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-theme-text text-sm">Efeitos Visuais</span>
                    <span className="text-theme-muted text-xs">Sombras, brilho neon e desfoque</span>
                </div>
                <button 
                    onClick={() => updateSettings({ effects: !state.settings.effects })}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 border ${state.settings.effects ? 'bg-neon-lime/20 border-neon-lime' : 'bg-theme-bg border-theme-border'}`}
                >
                    <div className={`w-4 h-4 rounded-full bg-current transition-transform duration-300 ${state.settings.effects ? 'translate-x-6 text-neon-lime' : 'translate-x-0 text-theme-muted'}`} />
                </button>
            </div>
          </div>

          <div className="h-px bg-theme-border w-full" />

          <div className="text-center space-y-2 pt-4">
            <p className="text-theme-muted text-xs font-mono">forca.js - v2.2.0</p>
            <p className="text-[10px] text-theme-muted/50 uppercase tracking-widest">Optimized Edition</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDifficultySelect = () => (
    <div className="w-full max-w-4xl animate-fade-in">
      <div className="text-center mb-12">
         <h2 className="text-4xl font-light text-theme-text mb-2 tracking-tight">Selecione a Dificuldade</h2>
         <p className="text-theme-muted font-mono text-sm tracking-widest uppercase">Defina seu nível de dor</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            id: Difficulty.CASUAL, 
            label: 'Casual', 
            lives: 8, 
            desc: 'Palavras do dia a dia. Para relaxar e aprender.', 
            color: 'border-neon-lime text-neon-lime' 
          },
          { 
            id: Difficulty.NORMAL, 
            label: 'Normal', 
            lives: 6, 
            desc: 'O equilíbrio ideal entre desafio e diversão.', 
            color: 'border-neon-cyan text-neon-cyan' 
          },
          { 
            id: Difficulty.BRUTAL, 
            label: 'Brutal', 
            lives: 3, 
            desc: 'Palavras raras. Margem de erro mínima.', 
            color: 'border-neon-error text-neon-error' 
          },
          { 
            id: Difficulty.MEGA_BRUTAL, 
            label: 'Mega-Brutal', 
            lives: 1, 
            desc: 'Você vai duvidar que essas palavras existem.', 
            color: 'border-neon-pink text-neon-pink',
            locked: !state.megaBrutalUnlocked
          },
        ].map(opt => (
          <button
            key={opt.id}
            disabled={opt.locked}
            onClick={() => startGame(opt.id)}
            className={`
              relative flex flex-col p-6 border bg-theme-surface/50 transition-all duration-300 h-56 justify-between group
              ${opt.locked ? 'opacity-40 cursor-not-allowed border-theme-border grayscale' : `${opt.color} hover:bg-theme-surface hover:scale-105 hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]`}
            `}
          >
            {opt.locked && (
               <div className="absolute inset-0 flex flex-col gap-2 items-center justify-center bg-black/60 z-10 backdrop-blur-[2px]">
                 <Lock className="text-theme-muted" />
                 <span className="text-[10px] font-mono text-theme-muted uppercase tracking-widest">Bloqueado</span>
               </div>
            )}
            
            <div className="flex justify-between items-start w-full">
              <span className="font-bold tracking-widest text-sm">{opt.label.toUpperCase()}</span>
              {opt.id === Difficulty.MEGA_BRUTAL && <Zap size={16} className="animate-pulse" />}
            </div>
            
            <div className="text-left">
               <div className="text-4xl font-light mb-3">{opt.lives} <span className="text-[10px] font-mono opacity-50 block -mt-1">VIDAS</span></div>
               <p className="text-xs opacity-80 leading-relaxed font-medium">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-16 text-center">
        <button 
          onClick={() => setState(prev => ({...prev, status: GameStatus.IDLE}))}
          className="text-theme-muted hover:text-theme-text text-sm font-mono border-b border-transparent hover:border-theme-text transition-all pb-1"
        >
          VOLTAR AO MENU
        </button>
      </div>
    </div>
  );

  const renderVersusSetup = () => (
    <div className="w-full max-w-md animate-slide-up flex flex-col gap-6">
      
      {/* Rules Card */}
      <div className="bg-gradient-to-br from-theme-surface to-theme-bg border border-theme-border p-6 rounded-sm shadow-xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Swords size={100} />
         </div>

         <div className="flex items-center gap-3 mb-4 text-neon-cyan">
            <ShieldAlert size={24} />
            <h3 className="font-bold uppercase text-sm tracking-[0.2em]">Protocolo Versus</h3>
         </div>
         <div className="space-y-4 text-sm text-theme-muted relative z-10">
            <div className="flex gap-4 items-start">
              <div className="bg-theme-border text-theme-text w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mt-0.5">1</div> 
              <p>O <strong className="text-neon-pink">Mestre</strong> define a palavra e a dica em segredo.</p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-theme-border text-theme-text w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mt-0.5">2</div> 
              <p>O <strong className="text-neon-cyan">Desafiante</strong> recebe o dispositivo.</p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-theme-border text-theme-text w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mt-0.5">3</div> 
              <p>O jogo começa com <strong className="text-theme-text">6 vidas</strong>. Que vença o melhor.</p>
            </div>
         </div>
      </div>

      <div className="space-y-8 mt-4">
        <div className="text-center">
          <h2 className="text-3xl font-light text-theme-text">Configuração</h2>
          <p className="text-theme-muted mt-1 text-xs uppercase tracking-widest">Área Restrita ao Mestre</p>
        </div>

        <div className="space-y-6">
          <div className="group">
            <label className="block text-[10px] uppercase tracking-widest text-neon-cyan mb-2 group-focus-within:text-neon-lime transition-colors">Palavra Secreta</label>
            <input 
              type="password" 
              value={versusP1Word}
              onChange={(e) => setVersusP1Word(e.target.value)}
              className="w-full bg-transparent border-b border-theme-border focus:border-neon-lime text-theme-text text-2xl py-2 outline-none transition-all placeholder-theme-muted/20 font-mono tracking-widest"
              placeholder="••••••••"
              autoComplete="off"
            />
          </div>

          <div className="group">
            <label className="block text-[10px] uppercase tracking-widest text-neon-pink mb-2 group-focus-within:text-neon-lime transition-colors">Dica (Opcional)</label>
            <input 
              type="text" 
              value={versusP1Hint}
              onChange={(e) => setVersusP1Hint(e.target.value)}
              className="w-full bg-transparent border-b border-theme-border focus:border-neon-lime text-theme-text text-lg py-2 outline-none transition-all placeholder-theme-muted/20 font-serif italic"
              placeholder="Ajude (ou confunda) seu oponente..."
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <button 
            onClick={() => setState(prev => ({...prev, status: GameStatus.IDLE}))}
            className="flex-1 py-4 border border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-text transition-colors text-sm font-bold tracking-widest uppercase"
          >
            Cancelar
          </button>
          <button 
            onClick={startVersusRound}
            disabled={!versusP1Word.trim()}
            className="flex-1 py-4 bg-theme-text text-theme-inverse font-bold uppercase tracking-widest hover:bg-neon-cyan hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]"
          >
            Iniciar
          </button>
        </div>
      </div>
    </div>
  );

  const renderMainMenu = () => (
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center animate-fade-in">
      <div className="space-y-8 order-2 lg:order-1 text-center lg:text-left">
         <div className="space-y-2">
            <h1 className="text-8xl sm:text-9xl font-bold tracking-tighter text-theme-text leading-none">
              forca<span className="text-neon-cyan animate-pulse">.js</span>
            </h1>
            <p className="text-theme-muted text-xl sm:text-2xl font-light tracking-wide pl-2 border-l-2 border-neon-lime ml-1">
              Minimalist Word Game
            </p>
         </div>

         <div className="flex justify-center lg:justify-start gap-6 text-xs font-mono text-theme-muted pt-4">
            <span className="flex items-center gap-2"><div className="w-2 h-2 bg-neon-lime rounded-full animate-pulse"></div> ONLINE</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 bg-neon-cyan rounded-full"></div> V2.2.0</span>
         </div>
      </div>

      <div className="flex flex-col gap-4 order-1 lg:order-2 w-full max-w-md mx-auto lg:mx-0">
        {[
          { mode: GameMode.CLASSIC, label: 'Clássico', icon: Play, desc: 'Palavras aleatórias', color: 'hover:border-neon-cyan hover:text-neon-cyan' },
          { mode: GameMode.AI_CHALLENGE, label: 'Desafio AI', icon: Brain, desc: 'Inteligência Adaptativa', color: 'hover:border-neon-lime hover:text-neon-lime' },
          { mode: GameMode.VERSUS, label: 'Versus Local', icon: Users, desc: 'Desafie um amigo', color: 'hover:border-neon-pink hover:text-neon-pink' }
        ].map(opt => (
          <button 
            key={opt.mode}
            onClick={() => selectMode(opt.mode)}
            className={`group relative flex items-center justify-between p-6 border border-theme-border bg-theme-surface/50 transition-all duration-300 ${opt.color} hover:pl-8 hover:bg-theme-surface hover:shadow-lg`}
          >
            <div className="flex items-center gap-5">
               <div className="p-2 bg-theme-bg rounded-full border border-theme-border group-hover:border-current transition-colors">
                 <opt.icon strokeWidth={1.5} size={20} />
               </div>
               <div className="text-left">
                 <div className="font-bold text-lg tracking-wide">{opt.label}</div>
                 <div className="text-xs text-theme-muted font-mono group-hover:text-current/70">{opt.desc}</div>
               </div>
            </div>
            <ChevronRight className="opacity-0 -translate-x-4 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
          </button>
        ))}

        {/* Thematic Input Inline */}
        <div className="group relative p-6 border border-theme-border bg-theme-surface/50 transition-all duration-300 hover:border-neon-lime hover:shadow-lg">
             <div className="flex items-center gap-5 mb-4 text-theme-text group-hover:text-neon-lime transition-colors">
               <div className="p-2 bg-theme-bg rounded-full border border-theme-border group-hover:border-neon-lime transition-colors">
                  <Sparkles strokeWidth={1.5} size={20} />
               </div>
               <div className="font-bold text-lg tracking-wide">Temático</div>
             </div>
             <div className="flex gap-0 relative">
                 <input 
                   type="text" 
                   value={customTopic}
                   onChange={(e) => setCustomTopic(e.target.value)}
                   placeholder="Digite um tema..."
                   className="flex-1 bg-transparent border-b border-theme-border py-2 text-sm focus:outline-none focus:border-neon-lime text-theme-text placeholder-theme-muted font-mono transition-colors"
                 />
                 <button 
                   onClick={() => { if(customTopic.trim()) selectMode(GameMode.THEMATIC, customTopic); }}
                   disabled={!customTopic.trim()}
                   className="absolute right-0 bottom-2 text-xs font-bold text-theme-muted hover:text-neon-lime disabled:opacity-0 transition-all uppercase tracking-widest"
                 >
                   Iniciar
                 </button>
             </div>
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="w-full max-w-4xl flex flex-col items-center animate-fade-in">
      <div className="w-full flex justify-between items-end border-b border-theme-border pb-6 mb-8">
        <div className="flex flex-col">
           <span className="text-[10px] text-theme-muted uppercase tracking-widest mb-1">Modo de Jogo</span>
           <div className="flex items-center gap-3">
             <span className="font-mono text-neon-cyan text-lg">
                {state.mode === GameMode.VERSUS ? '1v1 LOCAL' : state.mode.replace('_', ' ')}
             </span>
             {state.mode !== GameMode.VERSUS && (
                <span className="text-[10px] border border-theme-border px-2 py-0.5 rounded text-theme-muted uppercase">
                  {state.difficulty}
                </span>
             )}
           </div>
        </div>
        
        <div className="flex flex-col items-center">
           <span className="text-5xl font-light text-theme-text leading-none">{state.score}</span>
           <span className="text-[10px] text-theme-muted uppercase tracking-[0.3em] mt-1">Score</span>
        </div>

        <button 
          onClick={() => setState(prev => ({...prev, status: GameStatus.IDLE}))}
          className="text-theme-muted hover:text-theme-text transition-colors p-2 hover:bg-theme-surface rounded-full"
          title="Voltar ao Menu"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      <div className="relative w-full flex justify-center">
        {/* Category Tag */}
        <div className="absolute top-0 left-0">
          <div className="flex items-center gap-2 text-[10px] font-mono text-neon-pink border border-neon-pink/30 bg-neon-pink/5 px-3 py-1 rounded-full">
            <Info size={12} />
            {state.category.toUpperCase()}
          </div>
        </div>
        
        <HangmanFigure livesLeft={state.lives} maxLives={state.maxLives} />
      </div>

      <WordDisplay 
          word={state.normalizedWord} 
          guessedLetters={state.guessedLetters}
          revealAll={state.status !== GameStatus.PLAYING} 
      />

      <div className="my-8 text-center max-w-2xl px-6">
        <p className="text-theme-muted italic font-serif text-xl md:text-2xl leading-relaxed">"{state.hint}"</p>
      </div>

      <div className="w-full mt-auto">
         <Keyboard 
            guessedLetters={state.guessedLetters} 
            targetWord={state.normalizedWord}
            onGuess={handleGuess} 
            disabled={state.status !== GameStatus.PLAYING}
         />
      </div>
    </div>
  );

  // --- MAIN RENDER ---

  return (
    <div className="min-h-screen w-full bg-theme-bg text-theme-text flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-neon-cyan selection:text-black transition-colors duration-700 ease-in-out">
      
      {/* Global Settings Button */}
      <button 
        onClick={() => setShowSettings(true)}
        className="fixed top-6 right-6 text-theme-muted hover:text-theme-text hover:rotate-90 transition-all duration-500 z-40 p-2"
      >
        <SettingsIcon size={24} strokeWidth={1.5} />
      </button>

      {/* Settings Modal */}
      {showSettings && renderSettings()}

      {/* Loading */}
      {state.loading && (
         <div className="absolute inset-0 flex items-center justify-center bg-theme-bg/90 backdrop-blur-sm z-50 transition-all duration-500">
            <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-2 border-theme-border border-t-neon-cyan rounded-full animate-spin shadow-[0_0_20px_rgba(var(--neon-cyan),0.2)]"></div>
              <p className="font-mono text-xs animate-pulse text-neon-cyan tracking-widest">ESTABELECENDO CONEXÃO NEURAL...</p>
            </div>
         </div>
      )}

      {/* Error Toast */}
      {state.error && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 px-8 py-4 border border-neon-error bg-black text-neon-error text-sm font-mono z-50 shadow-[0_0_20px_rgba(var(--neon-error),0.3)] flex items-center gap-3">
           <Skull size={16} />
           ERROR: {state.error}
        </div>
      )}

      {/* Unlock Notification Toast */}
      {state.megaBrutalUnlocked && state.status === GameStatus.WON && state.difficulty === Difficulty.BRUTAL && (
         <div className="fixed bottom-8 right-8 px-6 py-5 border border-neon-pink bg-black text-neon-pink z-50 animate-slide-up flex items-center gap-4 shadow-[0_0_30px_rgba(255,0,255,0.4)]">
            <div className="p-2 bg-neon-pink text-black rounded-full">
               <Lock size={24} />
            </div>
            <div>
              <div className="font-bold text-lg tracking-wider">MEGA-BRUTAL DESBLOQUEADO</div>
              <div className="text-xs opacity-80 font-mono mt-1">A verdadeira dor começa agora.</div>
            </div>
         </div>
      )}

      {/* Status Router */}
      {state.status === GameStatus.IDLE && renderMainMenu()}
      {state.status === GameStatus.DIFFICULTY_SELECT && renderDifficultySelect()}
      {state.status === GameStatus.VERSUS_SETUP && renderVersusSetup()}
      {(state.status === GameStatus.PLAYING || state.status === GameStatus.WON || state.status === GameStatus.LOST) && renderGame()}

      {/* Game Over Overlay */}
      {state.status !== GameStatus.PLAYING && state.status !== GameStatus.IDLE && state.status !== GameStatus.VERSUS_SETUP && state.status !== GameStatus.DIFFICULTY_SELECT && (
         <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-theme-surface border border-theme-border p-10 max-w-lg w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
                {/* Background Glow */}
                <div className={`absolute top-0 left-0 w-full h-2 ${state.status === GameStatus.WON ? 'bg-neon-lime shadow-[0_0_20px_var(--neon-lime)]' : 'bg-neon-error shadow-[0_0_20px_var(--neon-error)]'}`} />

                <div className="mb-8">
                   {state.status === GameStatus.WON 
                     ? <Trophy size={80} className="mx-auto text-neon-lime animate-bounce drop-shadow-[0_0_15px_rgba(var(--neon-lime),0.5)]" strokeWidth={0.5} />
                     : <Skull size={80} className="mx-auto text-neon-error drop-shadow-[0_0_15px_rgba(var(--neon-error),0.5)]" strokeWidth={0.5} />
                   }
                </div>
                
                <h2 className={`text-6xl font-bold mb-2 tracking-tighter ${state.status === GameStatus.WON ? 'text-theme-text' : 'text-theme-muted'}`}>
                  {state.status === GameStatus.WON ? 'VITÓRIA' : 'DERROTA'}
                </h2>
                
                <div className="my-8 py-6 border-y border-theme-border bg-theme-bg/30">
                  <div className="text-[10px] text-theme-muted uppercase mb-3 tracking-widest">A palavra era</div>
                  <div className="text-4xl text-neon-cyan font-light tracking-wider drop-shadow-[0_0_5px_var(--neon-cyan)]">{state.currentWord}</div>
                </div>

                <div className="flex gap-4">
                   <button 
                      onClick={() => setState(prev => ({...prev, status: GameStatus.IDLE}))}
                      className="flex-1 py-4 border border-theme-border text-theme-text hover:bg-theme-text hover:text-theme-inverse transition-all font-bold tracking-widest text-sm uppercase"
                   >
                      Menu Principal
                   </button>
                   <button 
                      onClick={() => state.mode === GameMode.VERSUS ? setState(prev => ({...prev, status: GameStatus.VERSUS_SETUP})) : startGame(state.difficulty)}
                      className={`flex-1 py-4 font-bold text-black transition-all tracking-widest text-sm uppercase shadow-lg hover:scale-105 ${state.status === GameStatus.WON ? 'bg-neon-lime hover:bg-white hover:shadow-neon-lime/50' : 'bg-neon-error hover:bg-white hover:shadow-neon-error/50'}`}
                   >
                      Jogar Novamente
                   </button>
                </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default App;