// ============================================
// Background Service Worker for LinkedIn API
// ============================================
// Handles LinkedIn Voyager API requests from popup
// Service worker has better cross-origin request capabilities

const LINKEDIN_BASE_URL = "https://www.linkedin.com/voyager/api";

// Cache for API results
const cache = new Map();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Get LinkedIn cookies
async function getLinkedInCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: ".linkedin.com" });
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

    return {
      cookies: cookieString,
      csrfToken: csrfToken,
      isAuthenticated: !!cookieMap.li_at
    };
  } catch (error) {
    console.error("[Background] Error getting LinkedIn cookies:", error);
    return { cookies: null, csrfToken: null, isAuthenticated: false };
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

// Search locations
async function searchLocations(query) {
  if (!query || query.length < 2) return [];

  const cached = getFromCache("GEO", query);
  if (cached) return cached;

  try {
    const url = `${LINKEDIN_BASE_URL}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=GEO&queryContext=List(geoVersion->3,bingGeoSubTypeFilters->MARKET_AREA|COUNTRY_REGION|ADMIN_DIVISION_1|CITY)`;

    console.log("[Background] Fetching locations:", url);
    const headers = await getHeaders();

    const response = await fetch(url, {
      method: "GET",
      headers: headers,
      credentials: "include"
    });

    console.log("[Background] GEO Response:", response.status);

    if (!response.ok) {
      console.error("[Background] GEO error:", await response.text());
      return [];
    }

    const data = await response.json();
    const results = parseTypeaheadResults(data, "GEO");
    setCache("GEO", query, results);
    return results;
  } catch (error) {
    console.error("[Background] Error fetching locations:", error);
    return [];
  }
}

// Search companies
async function searchCompanies(query) {
  if (!query || query.length < 2) return [];

  const cached = getFromCache("COMPANY", query);
  if (cached) return cached;

  try {
    const url = `${LINKEDIN_BASE_URL}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=COMPANY`;

    console.log("[Background] Fetching companies:", url);
    const headers = await getHeaders();

    const response = await fetch(url, {
      method: "GET",
      headers: headers,
      credentials: "include"
    });

    console.log("[Background] COMPANY Response:", response.status);

    if (!response.ok) {
      console.error("[Background] COMPANY error:", await response.text());
      return [];
    }

    const data = await response.json();
    const results = parseTypeaheadResults(data, "COMPANY");
    setCache("COMPANY", query, results);
    return results;
  } catch (error) {
    console.error("[Background] Error fetching companies:", error);
    return [];
  }
}

// Search schools
async function searchSchools(query) {
  if (!query || query.length < 2) return [];

  const cached = getFromCache("SCHOOL", query);
  if (cached) return cached;

  try {
    const url = `${LINKEDIN_BASE_URL}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=SCHOOL`;

    console.log("[Background] Fetching schools:", url);
    const headers = await getHeaders();

    const response = await fetch(url, {
      method: "GET",
      headers: headers,
      credentials: "include"
    });

    console.log("[Background] SCHOOL Response:", response.status);

    if (!response.ok) {
      console.error("[Background] SCHOOL error:", await response.text());
      return [];
    }

    const data = await response.json();
    const results = parseTypeaheadResults(data, "SCHOOL");
    setCache("SCHOOL", query, results);
    return results;
  } catch (error) {
    console.error("[Background] Error fetching schools:", error);
    return [];
  }
}

// Search industries
async function searchIndustries(query) {
  if (!query || query.length < 2) return [];

  const cached = getFromCache("INDUSTRY", query);
  if (cached) return cached;

  try {
    const url = `${LINKEDIN_BASE_URL}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=INDUSTRY`;

    console.log("[Background] Fetching industries:", url);
    const headers = await getHeaders();

    const response = await fetch(url, {
      method: "GET",
      headers: headers,
      credentials: "include"
    });

    console.log("[Background] INDUSTRY Response:", response.status);

    if (!response.ok) {
      console.error("[Background] INDUSTRY error:", await response.text());
      // Return empty - fallback handled in popup
      return [];
    }

    const data = await response.json();
    const results = parseTypeaheadResults(data, "INDUSTRY");
    setCache("INDUSTRY", query, results);
    return results;
  } catch (error) {
    console.error("[Background] Error fetching industries:", error);
    return [];
  }
}

// Check authentication
async function checkAuth() {
  const { isAuthenticated } = await getLinkedInCookies();
  return isAuthenticated;
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

  return false;
});

console.log("[Background] Service worker loaded");
