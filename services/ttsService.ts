
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let audioContext: AudioContext;
let isQuotaExceeded = false;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
}

function decodeBase64(base64: string) {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Base64 decode failed", e);
    return new Uint8Array(0);
  }
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Native Speech Fallback using Web Speech API
 */
const speakNative = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  
  // Cancel any ongoing speech to start fresh
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  // Detect Hebrew text and set language accordingly
  const isHebrew = /[\u0590-\u05FF]/.test(text);
  utterance.lang = isHebrew ? 'he-IL' : 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  
  // Some browsers require voices to be loaded
  window.speechSynthesis.speak(utterance);
};

/**
 * Generates an AudioBuffer from text using Gemini TTS.
 */
export const generateAudioBuffer = async (text: string): Promise<AudioBuffer | null> => {
  // If we already know we're out of quota, don't even try to save time
  if (isQuotaExceeded) return null;

  try {
    const ctx = getAudioContext();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioData = decodeBase64(base64Audio);
      return await decodeAudioData(audioData, ctx, 24000, 1);
    }
  } catch (error: any) {
    if (error?.message?.includes('429') || error?.message?.includes('quota')) {
      console.warn("Gemini TTS Quota Exhausted. Switching to native fallback.");
      isQuotaExceeded = true; // Set flag to skip future attempts in this session
    } else {
      console.error("TTS Generation Error:", error);
    }
  }
  return null;
};

/**
 * Plays a pre-generated AudioBuffer immediately.
 */
export const playAudioBuffer = async (buffer: AudioBuffer) => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
};

/**
 * Main entry point for speaking text.
 * Prioritizes high-quality Gemini TTS, but falls back instantly to browser TTS on failure.
 */
export const speakText = async (text: string) => {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  // If quota is already flagged as exceeded, skip directly to native to avoid delay
  if (isQuotaExceeded) {
    speakNative(trimmedText);
    return;
  }

  try {
    const buffer = await generateAudioBuffer(trimmedText);
    if (buffer) {
      await playAudioBuffer(buffer);
    } else {
      // Failed to get buffer (quota/error), use native fallback
      speakNative(trimmedText);
    }
  } catch (e) {
    // Catch-all fallback
    speakNative(trimmedText);
  }
};
