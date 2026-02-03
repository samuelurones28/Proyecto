// config.js
// Las API keys ahora se cargan desde variables de entorno (.env)
// Ver .env.example para la plantilla

// API Keys
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
export const RAPIDAPI_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;

// Modelos de IA
export const GROQ_MODEL = "llama-3.3-70b-versatile";
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";