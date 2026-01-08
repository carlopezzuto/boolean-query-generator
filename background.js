// ============================================
// Background Service Worker for LinkedIn API
// ============================================
// Handles LinkedIn Voyager API requests from popup
// Service worker has better cross-origin request capabilities

const LINKEDIN_BASE_URL = "https://www.linkedin.com/voyager/api";
const MANUAL_COOKIES_KEY = "bqg_manual_cookies";

// API endpoints - LinkedIn updates these periodically
const API_ENDPOINTS = {
  // Try multiple endpoint patterns
  typeahead: [
    "/voyager/api/graphql?variables=(query:{query},type:{type})&queryId=voyagerSearchDashTypeahead.c2ee54263676c498cbb22dc22423918e",
    "/voyager/api/search/dash/typeahead",
    "/voyager/api/typeahead/hitsV2"
  ]
};

// Cache for API results
const cache = new Map();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Get manually stored cookies
async function getManualCookies() {
  try {
    const result = await chrome.storage.local.get(MANUAL_COOKIES_KEY);
    return result[MANUAL_COOKIES_KEY] || null;
  } catch (error) {
    console.error("[Background] Error getting manual cookies:", error);
    return null;
  }
}

// Save manual cookies
async function saveManualCookies(liAt, jsessionId) {
  try {
    await chrome.storage.local.set({
      [MANUAL_COOKIES_KEY]: {
        li_at: liAt,
        JSESSIONID: jsessionId
      }
    });
    console.log("[Background] Manual cookies saved");
    return true;
  } catch (error) {
    console.error("[Background] Error saving manual cookies:", error);
    return false;
  }
}

// Clear manual cookies
async function clearManualCookies() {
  try {
    await chrome.storage.local.remove(MANUAL_COOKIES_KEY);
    console.log("[Background] Manual cookies cleared");
    return true;
  } catch (error) {
    console.error("[Background] Error clearing manual cookies:", error);
    return false;
  }
}

// Get LinkedIn cookies (manual first, then automatic)
async function getLinkedInCookies() {
  // First try manual cookies
  const manualCookies = await getManualCookies();
  if (manualCookies && manualCookies.li_at && manualCookies.JSESSIONID) {
    console.log("[Background] Using manual cookies");
    const csrfToken = manualCookies.JSESSIONID.replace(/"/g, '');
    const cookieString = `li_at=${manualCookies.li_at}; JSESSIONID=${manualCookies.JSESSIONID}`;
    return {
      cookies: cookieString,
      csrfToken: csrfToken,
      isAuthenticated: true,
      source: "manual"
    };
  }

  // Fall back to automatic cookie capture
  try {
    console.log("[Background] Trying automatic cookie capture...");

    // Try multiple methods to get cookies
    let cookies = [];

    // Method 1: Get by URL (more reliable in some cases)
    try {
      cookies = await chrome.cookies.getAll({ url: "https://www.linkedin.com" });
      console.log("[Background] Method 1 (URL): Found", cookies.length, "cookies");
    } catch (e) {
      console.log("[Background] Method 1 failed:", e.message);
    }

    // Method 2: Get by domain if URL method failed
    if (cookies.length === 0) {
      try {
        cookies = await chrome.cookies.getAll({ domain: ".linkedin.com" });
        console.log("[Background] Method 2 (domain): Found", cookies.length, "cookies");
      } catch (e) {
        console.log("[Background] Method 2 failed:", e.message);
      }
    }

    // Method 3: Try specific cookies by name
    if (cookies.length === 0) {
      console.log("[Background] Trying to get specific cookies...");
      const liAtCookie = await chrome.cookies.get({ url: "https://www.linkedin.com", name: "li_at" });
      const jsessionCookie = await chrome.cookies.get({ url: "https://www.linkedin.com", name: "JSESSIONID" });

      if (liAtCookie) cookies.push(liAtCookie);
      if (jsessionCookie) cookies.push(jsessionCookie);
      console.log("[Background] Method 3 (specific): Found", cookies.length, "cookies");
    }


    // Try multiple methods to get cookies
    let cookies = [];

    // Method 1: Get by URL (more reliable in some cases)
    try {
      cookies = await chrome.cookies.getAll({ url: "https://www.linkedin.com" });
      console.log("[Background] Method 1 (URL): Found", cookies.length, "cookies");
    } catch (e) {
      console.log("[Background] Method 1 failed:", e.message);
    }

    // Method 2: Get by domain if URL method failed
    if (cookies.length === 0) {
      try {
        cookies = await chrome.cookies.getAll({ domain: ".linkedin.com" });
        console.log("[Background] Method 2 (domain): Found", cookies.length, "cookies");
      } catch (e) {
        console.log("[Background] Method 2 failed:", e.message);
      }
    }

    // Method 3: Try specific cookies by name
    if (cookies.length === 0) {
      console.log("[Background] Trying to get specific cookies...");
      const liAtCookie = await chrome.cookies.get({ url: "https://www.linkedin.com", name: "li_at" });
      const jsessionCookie = await chrome.cookies.get({ url: "https://www.linkedin.com", name: "JSESSIONID" });

      if (liAtCookie) cookies.push(liAtCookie);
      if (jsessionCookie) cookies.push(jsessionCookie);
      console.log("[Background] Method 3 (specific): Found", cookies.length, "cookies");
    }

    const cookieMap = {};
    for (const cookie of cookies) {
      cookieMap[cookie.name] = cookie.value;
    }

    // Extract CSRF token from JSESSIONID
    let csrfToken = null;
    if (cookieMap.JSESSIONID) {
      csrfToken = cookieMap.JSESSIONID.replace(/"/g, '');
    }

    // Build cookie string
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const isAuthenticated = !!cookieMap.li_at;
    console.log("[Background] Auto cookies - authenticated:", isAuthenticated, "has CSRF:", !!csrfToken);

    return {
      cookies: cookieString,
      csrfToken: csrfToken,
      isAuthenticated: isAuthenticated,
      source: "automatic"
    };
  } catch (error) {
    console.error("[Background] Error getting LinkedIn cookies:", error);
    return { cookies: null, csrfToken: null, isAuthenticated: false, source: "none" };
  }
}

// Import cookies from LinkedIn tab (when user is on linkedin.com)
async function importCookiesFromTab() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      return { success: false, error: "No active tab found" };
    }

    // Check if we're on LinkedIn
    if (!tab.url.includes("linkedin.com")) {
      return {
        success: false,
        error: "Please navigate to linkedin.com first, then try again",
        currentUrl: tab.url
      };
    }

    console.log("[Background] Importing cookies from LinkedIn tab:", tab.url);

    // Get cookies for this specific tab's URL
    const cookies = await chrome.cookies.getAll({ url: tab.url });
    console.log("[Background] Found", cookies.length, "cookies from tab URL");

    // Also try the main linkedin.com URL
    const mainCookies = await chrome.cookies.getAll({ url: "https://www.linkedin.com" });
    console.log("[Background] Found", mainCookies.length, "cookies from main URL");

    // Merge cookies, preferring tab cookies
    const cookieMap = {};
    for (const cookie of [...mainCookies, ...cookies]) {
      cookieMap[cookie.name] = cookie.value;
    }

    const liAt = cookieMap.li_at;
    const jsessionId = cookieMap.JSESSIONID;

    if (!liAt || !jsessionId) {
      return {
        success: false,
        error: `Missing required cookies. Found: li_at=${!!liAt}, JSESSIONID=${!!jsessionId}. Make sure you're logged into LinkedIn.`,
        cookieCount: Object.keys(cookieMap).length
      };
    }

    // Save as manual cookies
    await saveManualCookies(liAt, jsessionId);

    return {
      success: true,
      message: "Cookies imported successfully!",
      cookieCount: Object.keys(cookieMap).length
    };
  } catch (error) {
    console.error("[Background] Error importing cookies:", error);
    return { success: false, error: `Import failed: ${error.message}` };
  }
}

// Build headers for LinkedIn API
async function getHeaders() {
  const { cookies, csrfToken } = await getLinkedInCookies();

  const headers = {
    "accept": "application/vnd.linkedin.normalized+json+2.1",
    "accept-language": "en-US,en;q=0.9",
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "en_US",
    "x-li-track": '{"clientVersion":"1.13.0"}',
  };

  if (csrfToken) {
    headers["csrf-token"] = csrfToken;
  }

  if (cookies) {
    headers["cookie"] = cookies;
  }

  return headers;
}

// Cache helpers
function getCacheKey(type, query) {
  return `${type}:${query.toLowerCase()}`;
}

function getFromCache(type, query) {
  const key = getCacheKey(type, query);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TIMEOUT) {
    return cached.data;
  }
  return null;
}

function setCache(type, query, data) {
  const key = getCacheKey(type, query);
  cache.set(key, { data, timestamp: Date.now() });
}

// Parse typeahead API response
function parseTypeaheadResults(data, type) {
  const results = [];

  try {
    console.log(`[Background] Parsing ${type} response`);

    // Handle different response structures
    const responseData = data.data || data;
    const elements = responseData.elements || responseData.included || data.elements || data.included || [];
    const included = responseData.included || data.included || [];

    console.log(`[Background] Found ${elements.length} elements, ${included.length} included items`);

    // Parse elements array
    for (const element of elements) {
      const item = parseElement(element, type);
      if (item && !results.some(r => r.id === item.id)) {
        results.push(item);
      }
    }

    // Parse included array
    for (const inc of included) {
      const entityType = inc.$type || "";
      const entityUrn = inc.entityUrn || "";
      let item = null;

      if (type === "GEO" && (entityType.includes("Geo") || entityUrn.includes(":geo:"))) {
        item = parseGeoResult(inc);
      } else if (type === "COMPANY" && (entityType.includes("Company") || entityUrn.includes(":company:") || entityUrn.includes(":fs_miniCompany:"))) {
        item = parseCompanyResult(inc);
      } else if (type === "SCHOOL" && (entityType.includes("School") || entityUrn.includes(":school:") || entityUrn.includes(":fs_miniSchool:"))) {
        item = parseSchoolResult(inc);
      } else if (type === "INDUSTRY" && (entityType.includes("Industry") || entityUrn.includes(":industry:"))) {
        item = parseIndustryResult(inc);
      }

      if (item && !results.some(r => r.id === item.id)) {
        results.push(item);
      }
    }

    console.log(`[Background] Parsed ${results.length} results for ${type}`);
  } catch (error) {
    console.error("[Background] Error parsing results:", error);
  }

  return results.slice(0, 10);
}

// Parse single element based on type
function parseElement(element, type) {
  if (type === "GEO") return parseGeoResult(element);
  if (type === "COMPANY") return parseCompanyResult(element);
  if (type === "SCHOOL") return parseSchoolResult(element);
  if (type === "INDUSTRY") return parseIndustryResult(element);
  return null;
}

// Parse geo/location result
function parseGeoResult(element) {
  try {
    const urn = element.entityUrn || element.targetUrn || element.objectUrn || element["*geo"] || "";
    const idMatch = urn.match(/urn:li:(?:fsd_)?geo:(\d+)/);
    if (!idMatch) return null;

    const id = idMatch[1];
    const name = element.text?.text ||
                 element.title?.text ||
                 element.defaultLocalizedName ||
                 element.defaultLocalizedNameWithoutCountryName ||
                 element.name || "";

    if (!name) return null;

    return { id, name, type: "GEO", urn: `urn:li:geo:${id}` };
  } catch (error) {
    return null;
  }
}

// Parse company result
function parseCompanyResult(element) {
  try {
    const urn = element.entityUrn || element.targetUrn || element.objectUrn || element["*company"] || "";
    const idMatch = urn.match(/urn:li:(?:fs_mini|fsd_)?[Cc]ompany:(\d+)/);
    if (!idMatch) return null;

    const id = idMatch[1];
    const name = element.text?.text ||
                 element.title?.text ||
                 element.name ||
                 element.universalName ||
                 element.localizedName || "";

    if (!name) return null;

    return { id, name, type: "COMPANY", urn: `urn:li:company:${id}` };
  } catch (error) {
    return null;
  }
}

// Parse school result
function parseSchoolResult(element) {
  try {
    const urn = element.entityUrn || element.targetUrn || element.objectUrn || element["*school"] || "";
    const idMatch = urn.match(/urn:li:(?:fs_mini|fsd_)?[Ss]chool:(\d+)/);
    if (!idMatch) return null;

    const id = idMatch[1];
    const name = element.text?.text ||
                 element.title?.text ||
                 element.name ||
                 element.schoolName ||
                 element.localizedName || "";

    if (!name) return null;

    return { id, name, type: "SCHOOL", urn: `urn:li:school:${id}` };
  } catch (error) {
    return null;
  }
}

// Parse industry result
function parseIndustryResult(element) {
  try {
    const urn = element.entityUrn || element.targetUrn || element.objectUrn || element["*industry"] || "";
    const idMatch = urn.match(/urn:li:(?:fsd_)?industry:(\d+)/);
    if (!idMatch) return null;

    const id = idMatch[1];
    const name = element.text?.text ||
                 element.title?.text ||
                 element.name ||
                 element.localizedName || "";

    if (!name) return null;

    return { id, name, type: "INDUSTRY", urn: `urn:li:industry:${id}` };
  } catch (error) {
    return null;
  }
}

// Generic typeahead search with fallback endpoints
async function typeaheadSearch(query, type, extraParams = "") {
  if (!query || query.length < 2) return [];

  const cached = getFromCache(type, query);
  if (cached) return cached;

  const headers = await getHeaders();

  // Try multiple endpoint patterns
  const endpoints = [
    // New dash endpoint format
    `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(query:${encodeURIComponent(query)},types:List(${type}),start:0,count:10)&queryId=voyagerSearchDashTypeahead.f44c445d06d59f04d9c30eb91afac4a1`,
    // Alternative dash format
    `https://www.linkedin.com/voyager/api/search/dash/typeahead?q=typeahead&query=${encodeURIComponent(query)}&types=List(${type})`,
    // Legacy format
    `${LINKEDIN_BASE_URL}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=${type}${extraParams}`
  ];

  for (const url of endpoints) {
    try {
      console.log(`[Background] Trying ${type} endpoint:`, url.substring(0, 80) + "...");

      const response = await fetch(url, {
        method: "GET",
        headers: headers,
        credentials: "include"
      });

      console.log(`[Background] ${type} Response:`, response.status);

      if (response.ok) {
        const data = await response.json();
        const results = parseTypeaheadResults(data, type);

        if (results.length > 0) {
          setCache(type, query, results);
          return results;
        }
      }
    } catch (error) {
      console.log(`[Background] Endpoint failed:`, error.message);
    }
  }

  console.error(`[Background] All ${type} endpoints failed`);
  return [];
}

// Search locations
async function searchLocations(query) {
  return typeaheadSearch(query, "GEO", "&queryContext=List(geoVersion->3,bingGeoSubTypeFilters->MARKET_AREA|COUNTRY_REGION|ADMIN_DIVISION_1|CITY)");
}

// Search companies
async function searchCompanies(query) {
  return typeaheadSearch(query, "COMPANY");
}

// Search schools
async function searchSchools(query) {
  return typeaheadSearch(query, "SCHOOL");
}

// Search industries
async function searchIndustries(query) {
  return typeaheadSearch(query, "INDUSTRY");
}

// Check authentication
async function checkAuth() {
  const { isAuthenticated, source } = await getLinkedInCookies();
  return { isAuthenticated, source };
}

// Test connection by making a simple API call
async function testConnection() {
  try {
    const { cookies, csrfToken, isAuthenticated, source } = await getLinkedInCookies();

    if (!isAuthenticated) {
      return {
        success: false,
        error: "Not authenticated - no valid cookies found",
        source: source
      };
    }

    // Try a simple search using the typeahead function
    const results = await searchLocations("New York");

    if (results && results.length > 0) {
      return {
        success: true,
        message: `Connection successful! Found ${results.length} results for "New York".`,
        source: source,
        status: 200
      };
    } else {
      // Try alternative: just verify we can make an authenticated request
      const headers = await getHeaders();
      const testUrls = [
        "https://www.linkedin.com/voyager/api/me",
        "https://www.linkedin.com/voyager/api/identity/profiles/me"
      ];

      for (const url of testUrls) {
        try {
          const response = await fetch(url, {
            method: "GET",
            headers: headers,
            credentials: "include"
          });

          if (response.ok) {
            return {
              success: true,
              message: "Connection successful! Authentication verified.",
              source: source,
              status: response.status
            };
          }
        } catch (e) {
          continue;
        }
      }

      return {
        success: false,
        error: "API endpoints returned no results. LinkedIn may have changed their API.",
        source: source,
        status: 404
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Connection error: ${error.message}`,
      source: "none"
    };
  }
}

// Check authentication
async function checkAuth() {
  const { isAuthenticated, source } = await getLinkedInCookies();
  return { isAuthenticated, source };
}

// Test connection by making a simple API call
async function testConnection() {
  try {
    const { cookies, csrfToken, isAuthenticated, source } = await getLinkedInCookies();

    if (!isAuthenticated) {
      return {
        success: false,
        error: "Not authenticated - no valid cookies found",
        source: source
      };
    }

    // Try a simple typeahead query
    const url = `${LINKEDIN_BASE_URL}/typeahead/hitsV2?keywords=test&origin=OTHER&q=type&type=GEO&queryContext=List(geoVersion->3)`;
    const headers = await getHeaders();

    const response = await fetch(url, {
      method: "GET",
      headers: headers,
      credentials: "include"
    });

    if (response.ok) {
      const data = await response.json();
      const resultCount = data.elements?.length || data.included?.length || 0;
      return {
        success: true,
        message: `Connection successful! Found ${resultCount} results.`,
        source: source,
        status: response.status
      };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        error: `API returned ${response.status}: ${errorText.substring(0, 100)}`,
        source: source,
        status: response.status
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Connection error: ${error.message}`,
      source: "none"
    };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Received message:", request.action);

  if (request.action === "searchLocations") {
    searchLocations(request.query).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === "searchCompanies") {
    searchCompanies(request.query).then(sendResponse);
    return true;
  }

  if (request.action === "searchSchools") {
    searchSchools(request.query).then(sendResponse);
    return true;
  }

  if (request.action === "searchIndustries") {
    searchIndustries(request.query).then(sendResponse);
    return true;
  }

  if (request.action === "checkAuth") {
    checkAuth().then(sendResponse);
    return true;
  }

  if (request.action === "saveCookies") {
    saveManualCookies(request.liAt, request.jsessionId).then(sendResponse);
    return true;
  }

  if (request.action === "getCookies") {
    getManualCookies().then(sendResponse);
    return true;
  }

  if (request.action === "clearCookies") {
    clearManualCookies().then(sendResponse);
    return true;
  }

  if (request.action === "testConnection") {
    testConnection().then(sendResponse);
    return true;
  }

  if (request.action === "importFromTab") {
    importCookiesFromTab().then(sendResponse);
    return true;
  }

  return false;
});

console.log("[Background] Service worker loaded");
