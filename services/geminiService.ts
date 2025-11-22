import { GoogleGenAI, Type } from "@google/genai";
import { WordData, Difficulty } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelId = 'gemini-2.5-flash';

// --- OTIMIZAÇÃO 1: BANCO DE DADOS LOCAL DE BACKUP (FALLBACK) ---
// Garante que o jogo funcione instantaneamente se a API falhar ou demorar.
const FALLBACK_DB: Record<Difficulty, WordData[]> = {
  [Difficulty.CASUAL]: [
    { word: "GIRAFA", hint: "Pescoço longo e manchas.", category: "Animais" },
    { word: "BANANA", hint: "Fruta amarela e curva.", category: "Alimentos" },
    { word: "VIOLETA", hint: "Nome de cor e de flor.", category: "Natureza" },
    { word: "ESCOLA", hint: "Lugar de aprender.", category: "Lugares" }
  ],
  [Difficulty.NORMAL]: [
    { word: "METAFORA", hint: "Figura de linguagem comparativa.", category: "Gramática" },
    { word: "SATELITE", hint: "Orbita ao redor de planetas.", category: "Astronomia" },
    { word: "INCENDIO", hint: "Fogo fora de controle.", category: "Acidentes" },
    { word: "AUDITORIA", hint: "Exame minucioso de contas.", category: "Finanças" }
  ],
  [Difficulty.BRUTAL]: [
    { word: "XILOFONE", hint: "Instrumento musical de percussão.", category: "Música" },
    { word: "QUIMERA", hint: "Monstro mitológico ou sonho impossível.", category: "Mitologia" },
    { word: "IMPRESCINDIVEL", hint: "Algo que não pode faltar.", category: "Adjetivo" },
    { word: "CREPUSCULO", hint: "Momento entre o dia e a noite.", category: "Fenômeno" }
  ],
  [Difficulty.MEGA_BRUTAL]: [
    { word: "INCONSTITUCIONALISSIMAMENTE", hint: "De forma muito contrária à lei maior.", category: "Jurídico" },
    { word: "OSTRACISMO", hint: "Isolamento político ou social forçado.", category: "História" },
    { word: "TERGIVERSAR", hint: "Usar de evasivas; não ir direto ao ponto.", category: "Verbo Raro" },
    { word: "PROLEGOMENOS", hint: "Longa introdução ou princípios preliminares.", category: "Literatura" }
  ]
};

// Função auxiliar para pegar palavra local aleatória
const getLocalWord = (difficulty: Difficulty): WordData => {
  const list = FALLBACK_DB[difficulty];
  return list[Math.floor(Math.random() * list.length)];
};

export const generateWordData = async (
  mode: 'random' | 'topic', 
  difficulty: Difficulty,
  topic?: string
): Promise<WordData> => {

  // --- OTIMIZAÇÃO 2: TIMEOUT CONTROLLER ---
  // Se a IA demorar mais de 5 segundos, aborta e usa local.
  const timeoutPromise = new Promise<WordData>((resolve) => {
    setTimeout(() => {
      console.warn("IA demorou demais. Usando fallback local.");
      resolve(getLocalWord(difficulty));
    }, 5000);
  });

  const apiPromise = (async (): Promise<WordData> => {
    try {
      let promptContext = "";
      
      // Prompt otimizado para reduzir tokens de entrada e acelerar inferência
      switch (difficulty) {
        case Difficulty.CASUAL: promptContext = "Nível: CRIANÇA. Palavras comuns."; break;
        case Difficulty.NORMAL: promptContext = "Nível: ADULTO. Cultura geral."; break;
        case Difficulty.BRUTAL: promptContext = "Nível: ERUDITO. Palavras raras/complexas."; break;
        case Difficulty.MEGA_BRUTAL: promptContext = "Nível: INSANO. Arcaísmos ou cientificismos."; break;
      }

      const userPrompt = mode === 'topic' && topic 
        ? `TEMA OBRIGATÓRIO: ${topic}. ${promptContext}`
        : `Gere uma palavra aleatória. ${promptContext}`;

      const response = await ai.models.generateContent({
        model: modelId,
        contents: userPrompt,
        config: {
          // System Instruction define a "persona" para evitar repetir regras no prompt do usuário
          systemInstruction: `
            Você é uma API JSON para um jogo da forca.
            1. Retorne APENAS JSON válido.
            2. Idioma: Português Brasil.
            3. 'word': Palavra única, sem acentos se possível no JSON (mas o jogo trata), UPPERCASE.
            4. 'hint': Dica inteligente, nunca dê a resposta direta.
            5. 'category': Tag curta (1-2 palavras).
            6. Evite palavras muito curtas (<4 letras).
          `,
          responseMimeType: "application/json",
          temperature: 1.2, // Alta criatividade para evitar repetições
          topP: 0.95,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              hint: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["word", "hint", "category"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No text");
      const data = JSON.parse(text) as WordData;
      
      return {
        word: data.word.toUpperCase().trim(),
        hint: data.hint,
        category: data.category
      };

    } catch (error) {
      console.error("Erro Gemini (ou bloqueio de safety):", error);
      // Em caso de qualquer erro da API (Cota, Safety, Net), usa local
      return getLocalWord(difficulty);
    }
  })();

  // Corrida entre a API e o Timeout
  return Promise.race([apiPromise, timeoutPromise]);
};