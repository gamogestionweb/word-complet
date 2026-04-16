// Word Complet — UI controller (browser-only version).
// Calls OpenAI directly through api-client.js; no backend needed.

import { getNextWords, polishText, clearWordCache } from "./api-client.js";

const HINT = "Pulsa una palabra para empezar a escribir...";

const $ = (id) => document.getElementById(id);
const el = {
  polished:     $("polished"),
  raw:          $("raw-words"),
  chips:        $("chips"),
  progress:     $("progress"),
  scrollText:   $("scroll-text"),
  btnUndo:      $("btn-undo"),
  btnClear:     $("btn-clear"),
  btnCopy:      $("btn-copy"),
  btnRefresh:   $("btn-refresh"),
  toast:        $("toast"),
  iosHint:      $("ios-hint"),
  iosHintClose: $("ios-hint-close"),
  intro:        $("intro"),
  introClose:   $("intro-close"),
};

// ---------- State ----------

const selected = [];
let refreshTimer = 0;
let polishTimer = 0;
let wordsAbort = null;
let polishAbort = null;
let bypassCache = false;
let isFallback = false;

// ---------- Rendering ----------

function showHintText() {
  el.polished.textContent = HINT;
  el.polished.classList.add("hint");
}

function setPolishedText(text) {
  el.polished.textContent = text;
  el.polished.classList.remove("hint");
  requestAnimationFrame(() => {
    el.scrollText.scrollTop = el.scrollText.scrollHeight;
  });
}

function updateRaw() {
  el.raw.textContent = selected.length === 0 ? "" : selected.join(" \u203A ");
}

function showProgress(on) {
  el.progress.classList.toggle("hidden", !on);
}

function renderChips(words, fallback = false) {
  const frag = document.createDocumentFragment();
  const used = new Set(selected.map(w => w.toLowerCase()));
  for (const word of words) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = fallback ? "chip fallback" : "chip";
    btn.textContent = word;
    btn.dataset.word = word;
    if (used.has(word.toLowerCase())) btn.classList.add("used");
    frag.appendChild(btn);
  }
  el.chips.replaceChildren(frag);
  el.chips.scrollTop = 0;
}

function markChipUsed(chipEl) {
  chipEl.classList.add("used");
}

// ---------- Toast ----------

let toastTimer = 0;
function toast(message, opts = {}) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.toggle("error", !!opts.error);
  el.toast.classList.remove("hidden");
  toastTimer = setTimeout(() => el.toast.classList.add("hidden"), opts.duration ?? 2200);
}

// ---------- API calls ----------

async function fetchWords() {
  if (wordsAbort) wordsAbort.abort();
  wordsAbort = new AbortController();

  const context = selected.join(" ");
  showProgress(true);

  try {
    const data = await getNextWords(context, selected, {
      nocache: bypassCache,
      signal: wordsAbort.signal,
    });
    bypassCache = false;

    if (data.warning) toast(data.warning, { error: true, duration: 3500 });

    isFallback = data.source === "defaults-only";
    renderChips(data.words, isFallback);
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("fetchWords failed:", err);
    toast("No se pudieron cargar palabras", { error: true });
  } finally {
    showProgress(false);
  }
}

async function fetchPolish() {
  if (polishAbort) polishAbort.abort();
  polishAbort = new AbortController();

  if (selected.length < 2) {
    setPolishedText(selected.join(" "));
    return;
  }

  try {
    const data = await polishText(selected, { signal: polishAbort.signal });
    if (data.warning) toast(data.warning, { error: true });
    if (selected.length < 2) return;  // user hit clear while polish was in flight
    setPolishedText(data.text || selected.join(" "));
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("fetchPolish failed:", err);
    setPolishedText(selected.join(" "));
  }
}

// ---------- Event handlers ----------

function onChipClick(e) {
  const target = e.target.closest(".chip");
  if (!target || target.classList.contains("used")) return;
  const word = target.dataset.word;
  if (!word) return;

  selected.push(word);
  markChipUsed(target);
  updateRaw();
  setPolishedText(selected.join(" "));

  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(fetchWords, 350);

  clearTimeout(polishTimer);
  const even = selected.length % 2 === 0;
  polishTimer = setTimeout(fetchPolish, even ? 0 : 800);
}

function onUndo() {
  if (selected.length === 0) return;
  selected.pop();
  updateRaw();
  if (selected.length === 0) {
    showHintText();
  } else {
    setPolishedText(selected.join(" "));
    if (selected.length >= 2) {
      clearTimeout(polishTimer);
      polishTimer = setTimeout(fetchPolish, 800);
    }
  }
  fetchWords();
}

function onClear() {
  selected.length = 0;
  updateRaw();
  showHintText();
  clearTimeout(polishTimer);
  clearTimeout(refreshTimer);
  if (polishAbort) polishAbort.abort();
  fetchWords();
}

function onRefresh() {
  bypassCache = true;
  el.btnRefresh.classList.remove("spinning");
  void el.btnRefresh.offsetWidth;
  el.btnRefresh.classList.add("spinning");
  setTimeout(() => el.btnRefresh.classList.remove("spinning"), 800);
  clearTimeout(refreshTimer);
  fetchWords();
}

async function onCopy() {
  const text = el.polished.textContent;
  if (!text || el.polished.classList.contains("hint")) {
    toast("Nada que copiar");
    return;
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast("Texto copiado al portapapeles");
      return;
    }
  } catch (_) {}

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.left = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    toast(ok ? "Texto copiado al portapapeles" : "Copia no disponible aquí", { error: !ok });
  } catch (err) {
    console.error("copy failed:", err);
    toast("No se pudo copiar", { error: true });
  }
}

// ---------- Intro banner ----------

function maybeShowIntro() {
  if (!el.intro || !el.introClose) return;
  if (localStorage.getItem("intro-dismissed") === "1") {
    el.intro.classList.add("hidden");
    return;
  }
  el.introClose.addEventListener("click", () => {
    el.intro.classList.add("hidden");
    try { localStorage.setItem("intro-dismissed", "1"); } catch (_) {}
  });
}

// ---------- iOS install hint ----------

function maybeShowIosHint() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  if (!isIOS || isStandalone) return;
  if (localStorage.getItem("ios-hint-dismissed") === "1") return;

  setTimeout(() => el.iosHint?.classList.remove("hidden"), 2500);
  el.iosHintClose?.addEventListener("click", () => {
    el.iosHint.classList.add("hidden");
    try { localStorage.setItem("ios-hint-dismissed", "1"); } catch (_) {}
  });
}

// ---------- Service Worker ----------

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  // On HTTPS (GitHub Pages) SW registers fine. On file:// or http LAN, it's skipped.
  if (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("SW register failed:", err));
    });
  }
}

// ---------- Wire up ----------

function init() {
  el.chips.addEventListener("click", onChipClick);
  el.btnUndo.addEventListener("click", onUndo);
  el.btnClear.addEventListener("click", onClear);
  el.btnCopy.addEventListener("click", onCopy);
  el.btnRefresh.addEventListener("click", onRefresh);

  showHintText();
  updateRaw();
  fetchWords();

  maybeShowIntro();
  maybeShowIosHint();
  registerSW();
}

document.addEventListener("DOMContentLoaded", init);
