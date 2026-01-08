// ============================================
// Storage Module - Presets & History
// ============================================

const STORAGE_KEYS = {
  PRESETS: "bqg_presets",
  HISTORY: "bqg_history"
};

const MAX_HISTORY_ITEMS = 50;

// ============================================
// Presets Management
// ============================================

async function getPresets() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PRESETS);
  return result[STORAGE_KEYS.PRESETS] || [];
}

async function savePreset(preset) {
  const presets = await getPresets();
  
  // Check for duplicate name
  const existingIndex = presets.findIndex(p => p.name === preset.name);
  if (existingIndex >= 0) {
    // Update existing
    presets[existingIndex] = {
      ...preset,
      updatedAt: new Date().toISOString()
    };
  } else {
    // Add new
    presets.push({
      ...preset,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  await chrome.storage.local.set({ [STORAGE_KEYS.PRESETS]: presets });
  return presets;
}

async function deletePreset(presetId) {
  const presets = await getPresets();
  const filtered = presets.filter(p => p.id !== presetId);
  await chrome.storage.local.set({ [STORAGE_KEYS.PRESETS]: filtered });
  return filtered;
}

async function loadPreset(presetId) {
  const presets = await getPresets();
  return presets.find(p => p.id === presetId) || null;
}

// ============================================
// History Management
// ============================================

async function getHistory() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
  return result[STORAGE_KEYS.HISTORY] || [];
}

async function addToHistory(querySet) {
  const history = await getHistory();
  
  const historyEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    platform: querySet.platform,
    platformName: querySet.platformName,
    totalQueries: querySet.totalQueries,
    inputs: querySet.inputs,
    queries: querySet.queries.map(q => ({
      label: q.label,
      query: q.query,
      url: q.url,
      valid: q.valid
    }))
  };
  
  // Add to front, limit size
  history.unshift(historyEntry);
  if (history.length > MAX_HISTORY_ITEMS) {
    history.pop();
  }
  
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
  return history;
}

async function clearHistory() {
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
  return [];
}

async function deleteHistoryItem(itemId) {
  const history = await getHistory();
  const filtered = history.filter(h => h.id !== itemId);
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: filtered });
  return filtered;
}

// ============================================
// Utilities
// ============================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
