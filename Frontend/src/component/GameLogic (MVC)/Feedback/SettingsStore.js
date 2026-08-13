const STORAGE_KEY = 'gameSettings';

export const DEFAULT_SETTINGS = {
  audio: { masterVolume: 80, musicVolume: 50, soundEffects: 70 },
  display: {
    graphicsQuality: 'medium',
    showDamageNumbers: true,
    showHealthBars: true,
    screenShake: true,
  },
  gameplay: {
    autoCollectEnergy: false,
    autoDeployDefenders: false,
    showTutorialHints: true,
    confirmDeployment: false,
  },
};

const subscribers = new Set();
let current = null;

/** Merges stored values over defaults, one level deep per category. */
function merge(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };
  const out = {};
  for (const category of Object.keys(DEFAULT_SETTINGS)) {
    out[category] = { ...DEFAULT_SETTINGS[category], ...(stored[category] || {}) };
  }
  return out;
}

export function loadSettings() {
  let parsed = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  current = merge(parsed);
  return current;
}

export function saveSettings(settings) {
  current = merge(settings);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full or unavailable (private browsing). Keep the in-memory
    // value so the session still honours the change.
  }
  for (const fn of subscribers) fn(current);
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function getSettings() {
  return current ?? loadSettings();
}
