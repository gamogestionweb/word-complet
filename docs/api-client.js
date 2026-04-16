// Word Complet — browser-side OpenAI client.
//
// Ports the backend logic from server.py to run 100% in the browser:
//   - System + user prompts (model role stays rock-solid across calls)
//   - Model fallback: gpt-5.4-nano → gpt-4.1-nano → gpt-4o-mini
//   - Dead-model memoisation (skip permanently after a 404)
//   - max_tokens vs max_completion_tokens auto-detection with one retry
//   - LRU cache of 25 contexts keyed on `currentText` only
//   - Emergency fallback to offline Spanish pools if all models fail

import { OPENAI_API_KEY, MODELS, MAX_CHIPS } from "./config.js";
import { contextualDefaults } from "./word-pools.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// ---------- System prompts (stable across all calls) ----------

const SYSTEM_WORDS = `Eres el motor de predicción de Word Complet, un teclado AI inverso.

FUNCIONAMIENTO: el usuario NO escribe letra a letra. En su pantalla tiene 32 palabras o expresiones cortas que TÚ le sugieres. Pulsa las que encajan con la idea que quiere transmitir y así construye su texto a base de taps rapidísimos.

TU ÚNICO OBJETIVO: dado el texto parcial que lleva construido, devolverle las 32 palabras/expresiones MÁS PROBABLES con las que continuaría, ordenadas de más a menos probable, para que encuentre de un vistazo la que le sirve.

EL TEXTO PUEDE SER CUALQUIER COSA: un mensaje a otra persona, una nota para sí mismo, un email profesional, una búsqueda, un recordatorio, una lista, una idea suelta, una instrucción para una máquina, una descripción, una frase cualquiera. NO asumas que hay un interlocutor humano. NO asumas registro coloquial. NO asumas tema. Adáptate a la voz y el estilo que ya muestre el texto construido.

FORMATO de cada sugerencia:
- Cortas: 1 a 4 palabras como máximo.
- Directamente pulsables para encajar en la continuación.
- Mezcla categorías para ofrecer variedad: verbos, sustantivos, adjetivos, conectores, adverbios, tiempos, sitios, expresiones hechas, signos de puntuación cuando aplique.
- Si el texto parcial es corto o vacío, cubre un abanico amplio de intenciones para que el usuario pueda arrancar en cualquier dirección.
- Si el texto ya tiene dirección clara, enfócate en esa dirección pero mantén algo de variedad por si cambia de idea.

FORMATO DE RESPUESTA: solo las palabras/expresiones separadas por comas, en UNA sola línea. Sin numerar, sin guiones, sin comillas, sin explicaciones, sin saludo, sin nada más. Ejemplo válido:
hola, necesito, te aviso, luego, por favor, gracias, dónde estás, en casa`;

const SYSTEM_POLISH = `Eres Word Complet, un teclado AI inverso. El usuario construye textos pulsando palabras que tú le sugieres.

AHORA tu trabajo es distinto: recibes la secuencia de palabras que ha pulsado y debes devolverle el TEXTO NATURAL que quería escribir.

REGLAS:
- Interpreta la INTENCIÓN real detrás de las palabras pulsadas.
- Mantén la voz y el registro que sugieren las palabras (coloquial, formal, neutro, técnico, cariñoso, seco...). Si dice "porfa" es coloquial; si dice "estimado" es formal; adáptate.
- Reordena las palabras si hace falta para que fluya, y añade los conectores mínimos imprescindibles ("que", "de", "a", ",", etc.).
- NO inventes contenido nuevo que no esté insinuado por las palabras.
- NO asumas que es un WhatsApp ni un chat. Puede ser cualquier texto.
- Devuelve SOLO el texto final, sin comillas, sin explicación, sin prefijos tipo "Mensaje:" ni "Aquí tienes:". Directamente el texto.`;

// ---------- Per-session state ----------

const deadModels = new Set();          // models that returned 404 — skip forever
const reasoningModels = new Set();     // models needing max_completion_tokens + no temperature
const wordCache = new Map();           // LRU keyed on currentText → { words, apiCount }
const CACHE_MAX = 25;

function isReasoningModel(name) {
  const m = name.toLowerCase();
  return m.startsWith("gpt-5") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4");
}

function buildPayload(model, messages, temperature, maxTokens) {
  const body = { model, messages };
  if (reasoningModels.has(model) || isReasoningModel(model)) {
    body.max_completion_tokens = maxTokens;
    // reasoning models don't accept temperature
  } else {
    body.max_tokens = maxTokens;
    body.temperature = temperature;
  }
  return body;
}

async function singlePost(model, messages, temperature, maxTokens, signal) {
  const payload = buildPayload(model, messages, temperature, maxTokens);
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
  const bodyText = await res.text();
  if (res.ok) {
    try {
      const data = JSON.parse(bodyText);
      const content = (data.choices?.[0]?.message?.content || "").trim();
      return { content, status: res.status };
    } catch {
      return { content: null, status: res.status, errCode: null, errMsg: "bad response" };
    }
  }
  let errCode = null, errMsg = `HTTP ${res.status}`;
  try {
    const err = JSON.parse(bodyText).error || {};
    errCode = err.code || null;
    errMsg = err.message || errMsg;
  } catch {}
  return { content: null, status: res.status, errCode, errMsg };
}

async function callOpenAI(messages, { temperature = 0.9, maxTokens = 150, signal } = {}) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.startsWith("PON_AQUI")) {
    return { content: null, model: null, warning: "Falta API key" };
  }

  let lastError = null;

  for (const model of MODELS) {
    if (deadModels.has(model)) continue;

    let resp;
    try {
      resp = await singlePost(model, messages, temperature, maxTokens, signal);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      lastError = `[${model}] ${e.message}`;
      continue;
    }

    if (resp.content !== null) {
      return { content: resp.content, model, warning: null };
    }

    // 404 or model_not_found → skip forever
    if (resp.status === 404 || resp.errCode === "model_not_found") {
      deadModels.add(model);
      console.info(`[${model}] not available (${resp.errCode || resp.status}); skipping`);
      lastError = `[${model}] ${resp.errMsg}`;
      continue;
    }

    // 400 with "max_completion_tokens" hint → remember and retry once
    if (resp.status === 400 && resp.errMsg && resp.errMsg.includes("max_completion_tokens") && !reasoningModels.has(model)) {
      reasoningModels.add(model);
      console.info(`[${model}] switching to max_completion_tokens`);
      try {
        const retry = await singlePost(model, messages, temperature, maxTokens, signal);
        if (retry.content !== null) return { content: retry.content, model, warning: null };
        lastError = `[${model}] ${retry.errMsg}`;
        continue;
      } catch (e) {
        if (e.name === "AbortError") throw e;
        lastError = `[${model}] ${e.message}`;
        continue;
      }
    }

    // Unsupported temperature → retry without it
    if (resp.status === 400 && resp.errMsg && /temperature/i.test(resp.errMsg) && /unsupported/i.test(resp.errMsg)) {
      reasoningModels.add(model);
      try {
        const retry = await singlePost(model, messages, temperature, maxTokens, signal);
        if (retry.content !== null) return { content: retry.content, model, warning: null };
        lastError = `[${model}] ${retry.errMsg}`;
        continue;
      } catch (e) {
        if (e.name === "AbortError") throw e;
        lastError = `[${model}] ${e.message}`;
        continue;
      }
    }

    console.warn(`[${model}] HTTP ${resp.status}: ${resp.errMsg}`);
    lastError = `[${model}] ${resp.errMsg}`;
  }

  return { content: null, model: null, warning: lastError || "Todos los modelos fallaron" };
}

// ---------- Public API ----------

const WORD_FILTER = /^[a-záéíóúñü¿?¡!\-' ]+$/i;

function cleanWords(raw) {
  const out = [];
  for (const piece of raw.split(",")) {
    let w = piece
      .trim()
      .replace(/"/g, "")
      .replace(/\./g, "")
      .replace(/\n/g, " ")
      .trim()
      .toLowerCase()
      .replace(/^[\s\t\r\n¡!¿?]+|[\s\t\r\n¡!¿?]+$/g, "");
    if (!w || w.includes("  ")) continue;
    if (w.length < 2 || w.length > 14) continue;
    if (!WORD_FILTER.test(w)) continue;
    out.push(w);
  }
  return out;
}

/**
 * @param {string} context
 * @param {string[]} usedList
 * @param {object} opts — { nocache?: boolean, signal?: AbortSignal }
 * @returns {Promise<{ words: string[], model: string|null, source: string, warning: string|null, apiCount: number }>}
 */
export async function getNextWords(context, usedList, { nocache = false, signal } = {}) {
  const used = new Set(usedList.map(w => String(w).toLowerCase()));

  if (!nocache) {
    const cached = wordCache.get(context);
    if (cached) {
      // LRU bump
      wordCache.delete(context);
      wordCache.set(context, cached);
      return { words: cached.words, model: null, source: "cache", warning: null, apiCount: cached.apiCount };
    }
  }

  const noRepeat = usedList.length ? `\nYa pulsadas (no las repitas): ${usedList.slice(-10).join(", ")}.` : "";

  const userMsg = !context.trim()
    ? "Texto construido hasta ahora: (vacío, el usuario acaba de abrir la app).\nDame 32 palabras/expresiones cubriendo el abanico más amplio posible de textos que podría querer escribir. Variedad total."
    : `Texto construido hasta ahora: "${context}"\nDame 32 palabras/expresiones para continuar, ordenadas de más a menos probable. Variedad temática suficiente para que encuentre la que encaja con su intención.${noRepeat}`;

  const { content, model, warning } = await callOpenAI(
    [
      { role: "system", content: SYSTEM_WORDS },
      { role: "user",   content: userMsg },
    ],
    { temperature: 0.9, maxTokens: 150, signal }
  );

  let apiWords = [];
  if (content) {
    const seen = new Set();
    for (const w of cleanWords(content)) {
      if (used.has(w) || seen.has(w)) continue;
      seen.add(w);
      apiWords.push(w);
    }
  }

  let result, apiCount, source, warn = warning;

  if (apiWords.length) {
    result = apiWords.slice(0, MAX_CHIPS);
    apiCount = result.length;
    source = "api";
    wordCache.set(context, { words: result, apiCount });
    while (wordCache.size > CACHE_MAX) {
      const firstKey = wordCache.keys().next().value;
      wordCache.delete(firstKey);
    }
  } else {
    const defaults = contextualDefaults(context, used);
    result = defaults.slice(0, MAX_CHIPS);
    apiCount = 0;
    source = "defaults-only";
    if (!warn) warn = "Sin respuesta de la IA, usando palabras de respaldo";
  }

  return { words: result, model, source, warning: warn, apiCount };
}

/**
 * @param {string[]} words
 * @param {object} opts — { signal?: AbortSignal }
 * @returns {Promise<{ text: string, model: string|null, warning: string|null }>}
 */
export async function polishText(words, { signal } = {}) {
  if (!words || words.length < 2) {
    return { text: (words || []).join(" "), model: null, warning: null };
  }
  const raw = words.join(" ");
  const userMsg = `Palabras pulsadas en orden: ${raw}\nDevuélveme el texto natural que quería escribir, manteniendo la voz y el registro que sugieren las palabras. Solo el texto final.`;

  const { content, model, warning } = await callOpenAI(
    [
      { role: "system", content: SYSTEM_POLISH },
      { role: "user",   content: userMsg },
    ],
    { temperature: 0.3, maxTokens: 120, signal }
  );

  if (content) {
    const clean = content.replace(/^["']|["']$/g, "").trim();
    return { text: clean, model, warning: null };
  }
  return { text: raw, model: null, warning: warning || "Sin respuesta de la IA" };
}

export function clearWordCache() {
  wordCache.clear();
}
