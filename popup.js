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
  initTypeaheads();
  initSettings();
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
      if (target === "settings") refreshAuthStatus();
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
  const linkedinFields = document.querySelectorAll(".linkedin-only");
  const nonLinkedinFields = document.querySelectorAll(".non-linkedin-only");

  // Hide all platform-specific fields first
  googleFields.style.display = "none";
  githubFields.style.display = "none";
  linkedinFields.forEach(el => el.style.display = "none");
  nonLinkedinFields.forEach(el => el.style.display = "block");

  // Show fields for selected platform
  if (platform === "google") {
    googleFields.style.display = "block";
  } else if (platform === "github") {
    githubFields.style.display = "block";
  } else if (platform === "linkedin") {
    linkedinFields.forEach(el => el.style.display = "block");
    // Hide common locations field for LinkedIn (uses faceted filters instead)
    nonLinkedinFields.forEach(el => el.style.display = "none");
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
    clearSelectedFacets(); // Clear LinkedIn facet selections
  });
}

function getFormData() {
  const platform = getSelectedPlatform();

  // Base fields
  const data = {
    skills: document.getElementById("skills").value,
    locations: document.getElementById("locations").value
  };

  // Platform-specific fields
  if (platform === "google") {
    data.titles = document.getElementById("titles").value;
    data.companies = document.getElementById("companies").value;
    data.exclusions = document.getElementById("exclusions").value;
  } else if (platform === "github") {
    data.minFollowers = document.getElementById("minFollowers").value;
    data.keywords = document.getElementById("keywords").value;
  } else if (platform === "linkedin") {
    data.titles = document.getElementById("linkedin-titles").value;
    data.exclusions = document.getElementById("linkedin-exclusions").value;
    data.hackMode = document.getElementById("linkedin-hack-mode").checked;
    // Get LinkedIn facets from typeahead selections
    data.facets = getLinkedInFacets();
  }

  return data;
}

function setFormData(data, platform) {
  // Common fields
  document.getElementById("skills").value = data.skills?.join?.(", ") || data.skills || "";
  document.getElementById("locations").value = data.locations?.join?.(", ") || data.locations || "";

  // Google fields
  document.getElementById("titles").value = data.titles?.join?.(", ") || data.titles || "";
  document.getElementById("companies").value = data.companies?.join?.(", ") || data.companies || "";
  document.getElementById("exclusions").value = data.exclusions?.join?.(", ") || data.exclusions || "";

  // GitHub fields
  document.getElementById("minFollowers").value = data.minFollowers || "";
  document.getElementById("keywords").value = data.keywords?.join?.(", ") || data.keywords || "";

  // LinkedIn fields
  document.getElementById("linkedin-titles").value = data.titles?.join?.(", ") || data.titles || "";
  document.getElementById("linkedin-companies").value = data.companies?.join?.(", ") || data.companies || "";
  document.getElementById("linkedin-exclusions").value = data.exclusions?.join?.(", ") || data.exclusions || "";
  document.getElementById("linkedin-hack-mode").checked = data.hackMode || false;
}

// ============================================
// Query Generation
// ============================================

let currentQuerySet = null;

function handleGenerate() {
  const platform = getSelectedPlatform();
  const inputs = getFormData();

  // Validate minimum input
  const hasSkills = inputs.skills.trim();
  const hasLocations = inputs.locations.trim();
  const hasKeywords = inputs.keywords?.trim();
  const hasFacets = platform === "linkedin" && inputs.facets && (
    inputs.facets.geoUrn?.length > 0 ||
    inputs.facets.currentCompany?.length > 0 ||
    inputs.facets.pastCompany?.length > 0 ||
    inputs.facets.industry?.length > 0 ||
    inputs.facets.schoolFilter?.length > 0
  );

  if (!hasSkills && !hasLocations && !hasKeywords && !hasFacets) {
    showToast("Please enter at least skills, locations, keywords, or select LinkedIn filters", "error");
    return;
  }

  // Build options for generator
  const options = {};
  if (platform === "linkedin") {
    options.hackMode = inputs.hackMode || false;
  }

  currentQuerySet = generateQueries(platform, inputs, options);

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

// ============================================
// Typeahead / Autocomplete for LinkedIn Filters
// ============================================

// Store selected items for each typeahead
const selectedFacets = {
  geoUrn: [],
  currentCompany: [],
  pastCompany: [],
  titleFilter: [],
  industry: [],
  schoolFilter: []
};

// Debounce function for API calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function initTypeaheads() {
  const containers = document.querySelectorAll(".typeahead-container");

  containers.forEach(container => {
    const input = container.querySelector(".typeahead-input");
    const dropdown = container.querySelector(".typeahead-dropdown");
    const tagsContainer = container.querySelector(".selected-tags");
    const type = container.dataset.type;
    const param = container.dataset.param;

    // Debounced search function (synchronous - uses static data)
    const debouncedSearch = debounce((query) => {
      if (query.length < 2) {
        dropdown.classList.remove("show");
        return;
      }

      dropdown.classList.add("show");

      let results = [];

      // Call appropriate search based on type (all synchronous now)
      if (type === "GEO") {
        results = LinkedInAPI.searchLocations(query);
      } else if (type === "COMPANY") {
        results = LinkedInAPI.searchCompanies(query);
      } else if (type === "SCHOOL") {
        results = LinkedInAPI.searchSchools(query);
      } else if (type === "TITLE") {
        results = LinkedInAPI.searchTitles(query);
      } else if (type === "INDUSTRY") {
        results = LinkedInAPI.searchIndustries(query);
      }

      if (results.length === 0) {
        dropdown.innerHTML = '<div class="typeahead-empty">No results found. Try a different search term.</div>';
        return;
      }

      renderDropdownResults(dropdown, results, param, tagsContainer);
    }, 150);

    // Input event listener
    input.addEventListener("input", (e) => {
      debouncedSearch(e.target.value.trim());
    });

    // Focus shows dropdown if there's content
    input.addEventListener("focus", () => {
      if (dropdown.children.length > 0 && !dropdown.querySelector(".typeahead-loading")) {
        dropdown.classList.add("show");
      }
    });

    // Click outside closes dropdown
    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.remove("show");
      }
    });

    // Render initial tags
    renderSelectedTags(tagsContainer, param);
  });
}

function renderDropdownResults(dropdown, results, param, tagsContainer) {
  const selected = selectedFacets[param] || [];
  const selectedIds = new Set(selected.map(s => s.id));

  dropdown.innerHTML = results.map(item => `
    <div class="typeahead-item ${selectedIds.has(item.id) ? 'selected' : ''}"
         data-id="${escapeHtml(item.id)}"
         data-name="${escapeHtml(item.name)}"
         data-param="${param}">
      <span class="typeahead-item-name">${escapeHtml(item.name)}</span>
      <span class="typeahead-item-id">${escapeHtml(item.id)}</span>
    </div>
  `).join("");

  // Add click handlers
  dropdown.querySelectorAll(".typeahead-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      const name = item.dataset.name;
      const itemParam = item.dataset.param;

      // Toggle selection
      if (item.classList.contains("selected")) {
        // Remove from selection
        selectedFacets[itemParam] = selectedFacets[itemParam].filter(s => s.id !== id);
        item.classList.remove("selected");
      } else {
        // Add to selection
        selectedFacets[itemParam].push({ id, name });
        item.classList.add("selected");
      }

      renderSelectedTags(tagsContainer, itemParam);

      // Close dropdown and clear input after selection for better UX
      dropdown.classList.remove("show");
      const input = dropdown.closest(".typeahead-container").querySelector(".typeahead-input");
      if (input) {
        input.value = "";
      }
    });
  });
}

function renderSelectedTags(container, param) {
  const selected = selectedFacets[param] || [];

  container.innerHTML = selected.map(item => `
    <span class="selected-tag" data-id="${escapeHtml(item.id)}" data-param="${param}">
      <span class="selected-tag-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
      <button class="selected-tag-remove" type="button">&times;</button>
    </span>
  `).join("");

  // Add remove handlers
  container.querySelectorAll(".selected-tag-remove").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tag = btn.closest(".selected-tag");
      const id = tag.dataset.id;
      const tagParam = tag.dataset.param;

      selectedFacets[tagParam] = selectedFacets[tagParam].filter(s => s.id !== id);
      renderSelectedTags(container, tagParam);

      // Update dropdown if visible
      const dropdown = container.closest(".typeahead-container").querySelector(".typeahead-dropdown");
      const itemInDropdown = dropdown.querySelector(`[data-id="${id}"]`);
      if (itemInDropdown) {
        itemInDropdown.classList.remove("selected");
      }
    });
  });
}

// Get LinkedIn facets for URL generation
function getLinkedInFacets() {
  return {
    geoUrn: selectedFacets.geoUrn.map(s => s.id),
    currentCompany: selectedFacets.currentCompany.map(s => s.id),
    pastCompany: selectedFacets.pastCompany.map(s => s.id),
    industry: selectedFacets.industry.map(s => s.id),
    schoolFilter: selectedFacets.schoolFilter.map(s => s.id)
  };
}

// Clear all selected facets
function clearSelectedFacets() {
  Object.keys(selectedFacets).forEach(key => {
    selectedFacets[key] = [];
  });

  // Re-render all tag containers
  document.querySelectorAll(".selected-tags").forEach(container => {
    container.innerHTML = "";
  });
}

// Format timestamp for history
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

// ============================================
// Settings - Data Stats Display
// ============================================

function initSettings() {
  // Display data statistics
  refreshAuthStatus();
}

function refreshAuthStatus() {
  // Update data statistics display
  try {
    const stats = LinkedInAPI.getDataStats();
    document.getElementById("stat-locations").textContent = stats.locations.toLocaleString();
    document.getElementById("stat-companies").textContent = stats.companies.toLocaleString();
    document.getElementById("stat-titles").textContent = stats.titles.toLocaleString();
    document.getElementById("stat-industries").textContent = stats.industries.toLocaleString();
  } catch (error) {
    console.error("Error getting data stats:", error);
  }
}
