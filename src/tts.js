// קריין בקול AI (Gemini TTS) – הופך טקסט לדיבור, ומחזיר קובץ WAV
import { GoogleGenAI, ApiError } from '@google/genai';
import { AiError, aiEnabled, listAvailableModels } from './ai.js';

export const TTS_VOICES = ['Kore', 'Aoede', 'Leda', 'Puck', 'Charon', 'Fenrir'];
const DEFAULT_TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'];
const MAX_CHARS = 500;

// PCM גולמי (16 ביט, מונו) → קובץ WAV שהדפדפן יודע לנגן
function pcmToWav(pcm, rate) {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function ttsModels(ai, env) {
  const preferred = env.GEMINI_TTS_MODEL ? [env.GEMINI_TTS_MODEL] : DEFAULT_TTS_MODELS;
  try {
    const names = await listAvailableModels(ai, env.GEMINI_API_KEY);
    const has = new Set(names);
    const found = [...preferred, ...names.filter((n) => /tts/i.test(n))].filter((m, i, a) => has.has(m) && a.indexOf(m) === i);
    if (found.length) return found.slice(0, 3);
  } catch {
    /* אם הרשימה לא זמינה – מנסים את ברירות המחדל */
  }
  return preferred;
}

export async function synthesize(env, text, voice) {
  if (!aiEnabled(env)) throw new AiError('קול AI לא הופעל (חסר מפתח Gemini)');
  text = String(text || '').trim().slice(0, MAX_CHARS);
  if (!text) throw new AiError('אין טקסט להקראה');
  const voiceName = TTS_VOICES.includes(voice) ? voice : TTS_VOICES[0];
  const ai = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    ...(env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: env.GEMINI_BASE_URL } } : {}),
  });
  // הוראת סגנון לפני הטקסט – המודל מקריא רק את מה שאחרי הנקודתיים
  const prompt = `Read the following Hebrew text aloud in fluent, natural Israeli Hebrew, like an upbeat, friendly TV game-show host: ${text}`;

  let lastError = null;
  for (const model of await ttsModels(ai, env)) {
    for (const withVoice of [true, false]) {
      try {
        const r = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseModalities: ['AUDIO'],
            ...(withVoice ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } } : {}),
          },
        });
        const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!part) throw new AiError('לא התקבל קול');
        const mime = part.inlineData.mimeType || '';
        const bytes = b64ToBytes(part.inlineData.data);
        if (/wav|mpeg|mp3|ogg/i.test(mime)) return { bytes, mime };
        const rate = Number((mime.match(/rate=(\d+)/) || [])[1]) || 24000;
        return { bytes: pcmToWav(bytes, rate), mime: 'audio/wav' };
      } catch (e) {
        lastError = e;
        console.error('Gemini TTS error', model, withVoice, e?.status, e?.message);
        // קול שלא קיים → ננסה בלי לבחור קול; עומס/דגם חסר → הדגם הבא
        if (e instanceof ApiError && e.status === 400 && withVoice) continue;
        break;
      }
    }
  }
  const st = lastError?.status;
  throw new AiError(
    st >= 500 || st === 429 ? 'שירות הקול עמוס כרגע' : `קול AI לא זמין${st ? ` (קוד ${st})` : ''}`
  );
}
