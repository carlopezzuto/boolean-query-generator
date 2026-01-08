// ============================================
// Boolean Query Generator - Popup Logic
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initPlatformSelector();
  initForm();
  initPresets();
  initHistory();
  initModal();
});

// ============================================
// Tab Navigation
// ============================================

function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(`${target}-tab`).classList.add("active");

      // Refresh content when switching tabs
      if (target === "presets") renderPresets();
      if (target === "history") renderHistory();
    });
  });
}

// ============================================
// Platform Selector
// ============================================

function initPlatformSelector() {
  const radios = document.querySelectorAll('input[name="platform"]');
  
  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      updateFieldVisibility(radio.value);
    });
  });
}

function updateFieldVisibility(platform) {
  const googleFields = document.querySelector(".google-only");
  const githubFields = document.querySelector(".github-only");

  if (platform === "google") {
    googleFields.style.display = "block";
    githubFields.style.display = "none";
  } else {
    googleFields.style.display = "none";
    githubFields.style.display = "block";
  }
}

function getSelectedPlatform() {
  return document.querySelector('input[name="platform"]:checked').value;
}

// ============================================
// Form Handling
// ============================================

function initForm() {
  const form = document.getElementById("query-form");
  const clearBtn = document.getElementById("clear-form-btn");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleGenerate();
  });

  clearBtn.addEventListener("click", () => {
    form.reset();
    document.getElementById("results").style.display = "none";
    updateFieldVisibility("google");
  });
}

function getFormData() {
  return {
    skills: document.getElementById("skills").value,
    titles: document.getElementById("titles").value,
    companies: document.getElementById("companies").value,
    locations: document.getElementById("locations").value,
    exclusions: document.getElementById("exclusions").value,
    minFollowers: document.getElementById("minFollowers").value,
    keywords: document.getElementById("keywords").value
  };
}

function setFormData(data) {
  document.getElementById("skills").value = data.skills?.join?.(", ") || data.skills || "";
  document.getElementById("titles").value = data.titles?.join?.(", ") || data.titles || "";
  document.getElementById("companies").value = data.companies?.join?.(", ") || data.companies || "";
  document.getElementById("locations").value = data.locations?.join?.(", ") || data.locations || "";
  document.getElementById("exclusions").value = data.exclusions?.join?.(", ") || data.exclusions || "";
  document.getElementById("minFollowers").value = data.minFollowers || "";
  document.getElementById("keywords").value = data.keywords?.join?.(", ") || data.keywords || "";
}

// ============================================
// Query Generation
// ============================================

let currentQuerySet = null;

function handleGenerate() {
  const platform = getSelectedPlatform();
  const inputs = getFormData();

  // Validate minimum input
  if (!inputs.skills.trim() && !inputs.locations.trim() && !inputs.keywords.trim()) {
    showToast("Please enter at least skills, locations, or keywords", "error");
    return;
  }

  currentQuerySet = generateQueries(platform, inputs);

  if (currentQuerySet.queries.length === 0) {
    showToast("No queries generated. Check your inputs.", "error");
    return;
  }

  renderResults(currentQuerySet);
  addToHistory(currentQuerySet);
  showToast(`Generated ${currentQuerySet.queries.length} queries`, "success");
}

function renderResults(querySet) {
  const resultsDiv = document.getElementById("results");
  const queryList = document.getElementById("query-list");
  const countSpan = document.querySelector(".results-count");

  resultsDiv.style.display = "block";
  countSpan.textContent = `${querySet.validQueries}/${querySet.totalQueries} valid`;

  queryList.innerHTML = querySet.queries.map((q, i) => `
    <div class="query-card ${q.valid ? "" : "invalid"}">
      <div class="query-header">
        <span class="query-label">${escapeHtml(q.label)}</span>
        <div class="query-meta">
          <span class="query-length ${getLengthClass(q)}">${q.length}/${q.maxLength} ${q.lengthUnit}</span>
          <span class="validation-badge ${q.valid ? "valid" : "invalid"}">${q.valid ? "✓" : "✗"}</span>
        </div>
      </div>
      <div class="query-purpose">${escapeHtml(q.purpose)}</div>
      <div class="query-text">${escapeHtml(q.query)}</div>
      <div class="query-actions">
        <button class="btn btn-secondary btn-small" data-action="copy" data-index="${i}">📋 Copy</button>
        <button class="btn btn-primary btn-small" data-action="open" data-index="${i}">🚀 Open</button>
      </div>
    </div>
  `).join("");

  // Add event listeners
  queryList.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.index);
      const action = btn.dataset.action;
      const query = currentQuerySet.queries[index];

      if (action === "copy") {
        copyToClipboard(query.query);
        showToast("Copied to clipboard", "success");
      } else if (action === "open") {
        chrome.tabs.create({ url: query.url });
      }
    });
  });

  // Copy all button
  document.getElementById("copy-all-btn").onclick = () => {
    const allQueries = currentQuerySet.queries.map(q => q.query).join("\n\n");
    copyToClipboard(allQueries);
    showToast("All queries copied", "success");
  };

  // Open all button
  document.getElementById("open-all-btn").onclick = () => {
    if (currentQuerySet.queries.length > 10) {
      if (!confirm(`Open ${currentQuerySet.queries.length} tabs?`)) return;
    }
    currentQuerySet.queries.forEach(q => {
      chrome.tabs.create({ url: q.url, active: false });
    });
    showToast(`Opened ${currentQuerySet.queries.length} tabs`, "success");
  };
}

function getLengthClass(query) {
  const ratio = query.length / query.maxLength;
  if (ratio > 1) return "error";
  if (ratio > 0.85) return "warning";
  return "";
}

// ============================================
// Presets
// ============================================

function initPresets() {
  document.getElementById("save-preset-btn").addEventListener("click", () => {
    document.getElementById("preset-modal").style.display = "flex";
    document.getElementById("preset-name").value = "";
    document.getElementById("preset-name").focus();
  });
}

async function renderPresets() {
  const presets = await getPresets();
  const container = document.getElementById("presets-list");

  if (presets.length === 0) {
    container.innerHTML = '<p class="empty-state">No saved presets yet. Create one from the Generator tab.</p>';
    return;
  }

  container.innerHTML = presets.map(p => `
    <div class="preset-card">
      <div class="preset-header">
        <span class="preset-name">${escapeHtml(p.name)}</span>
        <span class="preset-meta">${PLATFORMS[p.platform].displayName}</span>
      </div>
      <div class="preset-details">
        ${formatPresetDetails(p)}
      </div>
      <div class="preset-actions">
        <button class="btn btn-primary btn-small" data-action="load" data-id="${p.id}">Load</button>
        <button class="btn btn-danger btn-small" data-action="delete" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "load") {
        const preset = await loadPreset(id);
        if (preset) {
          // Switch to generator tab
          document.querySelector('[data-tab="generator"]').click();
          
          // Set platform
          document.querySelector(`input[name="platform"][value="${preset.platform}"]`).checked = true;
          updateFieldVisibility(preset.platform);
          
          // Set form data
          setFormData(preset.inputs);
          
          showToast(`Loaded: ${preset.name}`, "success");
        }
      } else if (action === "delete") {
        if (confirm("Delete this preset?")) {
          await deletePreset(id);
          renderPresets();
          showToast("Preset deleted", "success");
        }
      }
    });
  });
}

function formatPresetDetails(preset) {
  const parts = [];
  if (preset.inputs.skills?.length) parts.push(`Skills: ${preset.inputs.skills.join(", ")}`);
  if (preset.inputs.locations?.length) parts.push(`Locations: ${preset.inputs.locations.join(", ")}`);
  if (preset.inputs.titles?.length) parts.push(`Titles: ${preset.inputs.titles.join(", ")}`);
  return parts.slice(0, 2).join(" • ") || "No details";
}

// ============================================
// History
// ============================================

function initHistory() {
  document.getElementById("clear-history-btn").addEventListener("click", async () => {
    if (confirm("Clear all history?")) {
      await clearHistory();
      renderHistory();
      showToast("History cleared", "success");
    }
  });
}

async function renderHistory() {
  const history = await getHistory();
  const container = document.getElementById("history-list");

  if (history.length === 0) {
    container.innerHTML = '<p class="empty-state">No query history yet.</p>';
    return;
  }

  container.innerHTML = history.map(h => `
    <div class="history-card">
      <div class="history-header-row">
        <span class="history-title">${h.platformName}</span>
        <span class="history-meta">${formatTimestamp(h.timestamp)} • ${h.totalQueries} queries</span>
      </div>
      <div class="preset-details">
        ${formatPresetDetails({ inputs: h.inputs })}
      </div>
      <div class="history-actions">
        <button class="btn btn-secondary btn-small" data-action="rerun" data-id="${h.id}">↻ Re-run</button>
        <button class="btn btn-secondary btn-small" data-action="expand" data-id="${h.id}">Show Queries</button>
        <button class="btn btn-ghost btn-small" data-action="delete" data-id="${h.id}">✕</button>
      </div>
      <div class="history-queries" id="queries-${h.id}" style="display: none;">
        ${h.queries.map(q => `
          <div class="history-query-item">
            <span class="history-query-label">${escapeHtml(q.label)}</span>
            <button class="btn btn-small" data-action="open-query" data-url="${escapeHtml(q.url)}">Open</button>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "rerun") {
        const history = await getHistory();
        const item = history.find(h => h.id === id);
        if (item) {
          document.querySelector('[data-tab="generator"]').click();
          document.querySelector(`input[name="platform"][value="${item.platform}"]`).checked = true;
          updateFieldVisibility(item.platform);
          setFormData(item.inputs);
          handleGenerate();
        }
      } else if (action === "expand") {
        const queriesDiv = document.getElementById(`queries-${id}`);
        const isHidden = queriesDiv.style.display === "none";
        queriesDiv.style.display = isHidden ? "block" : "none";
        btn.textContent = isHidden ? "Hide Queries" : "Show Queries";
      } else if (action === "delete") {
        await deleteHistoryItem(id);
        renderHistory();
      } else if (action === "open-query") {
        chrome.tabs.create({ url: btn.dataset.url });
      }
    });
  });
}

// ============================================
// Modal
// ============================================

function initModal() {
  const modal = document.getElementById("preset-modal");
  const cancelBtn = document.getElementById("cancel-preset-btn");
  const confirmBtn = document.getElementById("confirm-preset-btn");
  const nameInput = document.getElementById("preset-name");

  cancelBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  confirmBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast("Please enter a name", "error");
      return;
    }

    const platform = getSelectedPlatform();
    const inputs = getFormData();

    await savePreset({
      name,
      platform,
      inputs: {
        skills: parseList(inputs.skills),
        titles: parseList(inputs.titles),
        companies: parseList(inputs.companies),
        locations: parseList(inputs.locations),
        exclusions: parseList(inputs.exclusions),
        minFollowers: parseInt(inputs.minFollowers) || 0,
        keywords: parseList(inputs.keywords)
      }
    });

    modal.style.display = "none";
    showToast(`Preset "${name}" saved`, "success");
  });

  // Close on background click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // Enter key to save
  nameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      confirmBtn.click();
    }
  });
}

// ============================================
// Utilities
// ============================================

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function parseList(input) {
  if (typeof input !== "string") return [];
  return input
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
