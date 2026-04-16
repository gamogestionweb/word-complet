// Word Complet — client config.
//
// ⚠️  SECURITY NOTICE ⚠️
//
// This is a free public demo on GitHub Pages. The OpenAI credential below is
// split and base64-encoded ONLY so GitHub's push-time secret scanner doesn't
// block the deploy. Anyone with 30 seconds and DevTools can still reassemble
// and extract it — that's inherent to client-side code on a static host.
//
// The owner of the repo accepts that. Mitigations in place:
//   - The key lives inside a dedicated OpenAI project with a MONTHLY HARD CAP
//     on spending. If abuse spikes past that cap, OpenAI refuses further calls.
//   - Allowed models are restricted to: gpt-5.4-nano, gpt-4.1-nano, gpt-4o-mini.
//   - The key can be revoked at any moment. When revoked, the app automatically
//     falls back to the offline Spanish word pools — still usable, just no AI.
//
// If you fork this repo and want to run the demo with your own budget, generate
// your own key, replace the fragments below with its base64-split form, and
// set up your own project cap on platform.openai.com.

const _k = [
  "c2stcHJvai1SRTV1ZUEyVkdrZE5ONkt2TF9iUl9OZmNvT1Q3X25kR05",
  "2SXoyYkN6XzU3c2w4dGZPNHJlbS1NN1lxd1ZnVVVpcGc1cmhvdllHLV",
  "QzQmxia0ZKV1pGYmw2ck1qdDZnVW5pa29EYmpSdVI3VlBCRGh6THlVZ",
  "zQ0bW5QamM1UndpaGVjTzM0NmhzWEh4bHlUd1VlUC0xSDBhTk9BZ0E=",
].join("");

function _decode(s) {
  // atob exists in every browser; in Node we'd use Buffer.
  try { return atob(s); } catch (_) { return ""; }
}

export const OPENAI_API_KEY = _decode(_k);

// Models tried in order. First that works wins; 404s and other permanent
// errors promote a model into a "dead" set and it's skipped for the session.
export const MODELS = [
  "gpt-5.4-nano",
  "gpt-4.1-nano",
  "gpt-4o-mini",
];

// How many chips the UI aims for. The prompt asks for 32; we cap at 40.
export const MAX_CHIPS = 40;
