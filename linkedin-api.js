// ============================================
// LinkedIn Voyager API Service
// ============================================
// Provides typeahead search for locations, companies, schools, and industries
// Requires user to be logged into LinkedIn (uses session cookie)

const LinkedInAPI = {
  // Base URL for Voyager API
  baseUrl: "https://www.linkedin.com/voyager/api",

  // Cache for API results (reduces API calls)
  cache: new Map(),
  cacheTimeout: 5 * 60 * 1000, // 5 minutes

  // Stored cookies for API requests
  cookies: null,
  csrfToken: null,

  // Get LinkedIn cookies using Chrome cookies API
  async getLinkedInCookies() {
    try {
      const cookies = await chrome.cookies.getAll({ domain: ".linkedin.com" });
      const cookieMap = {};

      for (const cookie of cookies) {
        cookieMap[cookie.name] = cookie.value;
      }

      // Store CSRF token (JSESSIONID without quotes)
      if (cookieMap.JSESSIONID) {
        this.csrfToken = cookieMap.JSESSIONID.replace(/"/g, '');
      }

      // Build cookie string for header
      this.cookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      return {
        cookies: this.cookies,
        csrfToken: this.csrfToken,
        isAuthenticated: !!cookieMap.li_at
      };
    } catch (error) {
      console.error("Error getting LinkedIn cookies:", error);
      return { cookies: null, csrfToken: null, isAuthenticated: false };
    }
  },

  // Check if user is authenticated with LinkedIn
  async isAuthenticated() {
    const { isAuthenticated } = await this.getLinkedInCookies();
    return isAuthenticated;
  },

  // Required headers for Voyager API
  async getHeaders() {
    // Ensure we have cookies
    if (!this.cookies) {
      await this.getLinkedInCookies();
    }

    const headers = {
      "accept": "application/vnd.linkedin.normalized+json+2.1",
      "accept-language": "en-US,en;q=0.9",
      "x-restli-protocol-version": "2.0.0",
      "x-li-lang": "en_US",
      "x-li-track": '{"clientVersion":"1.0.0"}',
    };

    // Add CSRF token if available
    if (this.csrfToken) {
      headers["csrf-token"] = this.csrfToken;
    }

    // Add cookies header
    if (this.cookies) {
      headers["cookie"] = this.cookies;
    }

    return headers;
  },

  // Generate cache key
  getCacheKey(type, query) {
    return `${type}:${query.toLowerCase()}`;
  },

  // Get from cache if valid
  getFromCache(type, query) {
    const key = this.getCacheKey(type, query);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  },

  // Store in cache
  setCache(type, query, data) {
    const key = this.getCacheKey(type, query);
    this.cache.set(key, { data, timestamp: Date.now() });
  },

  // Search for locations (geoUrn)
  async searchLocations(query) {
    if (!query || query.length < 2) return [];

    const cached = this.getFromCache("GEO", query);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=GEO&queryContext=List(geoVersion->3,bingGeoSubTypeFilters->MARKET_AREA|COUNTRY_REGION|ADMIN_DIVISION_1|CITY)`;

      const response = await fetch(url, {
        method: "GET",
        headers: await this.getHeaders()
      });

      if (!response.ok) {
        console.warn("LinkedIn API error:", response.status);
        return [];
      }

      const data = await response.json();
      const results = this.parseTypeaheadResults(data, "GEO");
      this.setCache("GEO", query, results);
      return results;
    } catch (error) {
      console.error("Error fetching locations:", error);
      return [];
    }
  },

  // Search for companies
  async searchCompanies(query) {
    if (!query || query.length < 2) return [];

    const cached = this.getFromCache("COMPANY", query);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=COMPANY`;

      const response = await fetch(url, {
        method: "GET",
        headers: await this.getHeaders()
      });

      if (!response.ok) {
        console.warn("LinkedIn API error:", response.status);
        return [];
      }

      const data = await response.json();
      const results = this.parseTypeaheadResults(data, "COMPANY");
      this.setCache("COMPANY", query, results);
      return results;
    } catch (error) {
      console.error("Error fetching companies:", error);
      return [];
    }
  },

  // Search for schools
  async searchSchools(query) {
    if (!query || query.length < 2) return [];

    const cached = this.getFromCache("SCHOOL", query);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=SCHOOL`;

      const response = await fetch(url, {
        method: "GET",
        headers: await this.getHeaders()
      });

      if (!response.ok) {
        console.warn("LinkedIn API error:", response.status);
        return [];
      }

      const data = await response.json();
      const results = this.parseTypeaheadResults(data, "SCHOOL");
      this.setCache("SCHOOL", query, results);
      return results;
    } catch (error) {
      console.error("Error fetching schools:", error);
      return [];
    }
  },

  // Search for industries
  async searchIndustries(query) {
    if (!query || query.length < 2) return [];

    const cached = this.getFromCache("INDUSTRY", query);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&origin=OTHER&q=type&type=INDUSTRY`;

      const response = await fetch(url, {
        method: "GET",
        headers: await this.getHeaders()
      });

      if (!response.ok) {
        console.warn("LinkedIn API error:", response.status);
        // Fall back to static list
        return this.searchIndustriesStatic(query);
      }

      const data = await response.json();
      const results = this.parseTypeaheadResults(data, "INDUSTRY");
      this.setCache("INDUSTRY", query, results);
      return results;
    } catch (error) {
      console.error("Error fetching industries:", error);
      return this.searchIndustriesStatic(query);
    }
  },

  // Parse typeahead API response
  parseTypeaheadResults(data, type) {
    const results = [];

    try {
      // The response structure varies, try different paths
      const elements = data.elements || data.included || [];

      for (const element of elements) {
        let item = null;

        // Try to extract based on type
        if (type === "GEO") {
          item = this.parseGeoResult(element);
        } else if (type === "COMPANY") {
          item = this.parseCompanyResult(element);
        } else if (type === "SCHOOL") {
          item = this.parseSchoolResult(element);
        } else if (type === "INDUSTRY") {
          item = this.parseIndustryResult(element);
        }

        if (item) {
          results.push(item);
        }
      }

      // Also check included array for additional data
      if (data.included) {
        for (const inc of data.included) {
          let item = null;

          if (type === "GEO" && inc.$type?.includes("Geo")) {
            item = this.parseGeoResult(inc);
          } else if (type === "COMPANY" && inc.$type?.includes("Company")) {
            item = this.parseCompanyResult(inc);
          } else if (type === "SCHOOL" && inc.$type?.includes("School")) {
            item = this.parseSchoolResult(inc);
          } else if (type === "INDUSTRY" && inc.$type?.includes("Industry")) {
            item = this.parseIndustryResult(inc);
          }

          if (item && !results.some(r => r.id === item.id)) {
            results.push(item);
          }
        }
      }
    } catch (error) {
      console.error("Error parsing typeahead results:", error);
    }

    return results.slice(0, 10); // Limit to 10 results
  },

  // Parse geo/location result
  parseGeoResult(element) {
    try {
      // Extract ID from URN like "urn:li:geo:103644278"
      const urn = element.entityUrn || element.targetUrn || element.objectUrn || "";
      const idMatch = urn.match(/urn:li:geo:(\d+)/);
      if (!idMatch) return null;

      const id = idMatch[1];
      const name = element.text?.text || element.title?.text || element.defaultLocalizedName || element.name || "";

      if (!name) return null;

      return {
        id,
        name,
        type: "GEO",
        urn: `urn:li:geo:${id}`
      };
    } catch (error) {
      return null;
    }
  },

  // Parse company result
  parseCompanyResult(element) {
    try {
      // Extract ID from URN like "urn:li:company:1441" or "urn:li:fs_miniCompany:1441"
      const urn = element.entityUrn || element.targetUrn || element.objectUrn || "";
      const idMatch = urn.match(/urn:li:(?:fs_mini)?[Cc]ompany:(\d+)/);
      if (!idMatch) return null;

      const id = idMatch[1];
      const name = element.text?.text || element.title?.text || element.name || element.universalName || "";

      if (!name) return null;

      return {
        id,
        name,
        type: "COMPANY",
        urn: `urn:li:company:${id}`
      };
    } catch (error) {
      return null;
    }
  },

  // Parse school result
  parseSchoolResult(element) {
    try {
      // Extract ID from URN like "urn:li:school:2584" or "urn:li:fs_miniSchool:2584"
      const urn = element.entityUrn || element.targetUrn || element.objectUrn || "";
      const idMatch = urn.match(/urn:li:(?:fs_mini)?[Ss]chool:(\d+)/);
      if (!idMatch) return null;

      const id = idMatch[1];
      const name = element.text?.text || element.title?.text || element.name || element.schoolName || "";

      if (!name) return null;

      return {
        id,
        name,
        type: "SCHOOL",
        urn: `urn:li:school:${id}`
      };
    } catch (error) {
      return null;
    }
  },

  // Parse industry result
  parseIndustryResult(element) {
    try {
      // Extract ID from URN like "urn:li:industry:47"
      const urn = element.entityUrn || element.targetUrn || element.objectUrn || "";
      const idMatch = urn.match(/urn:li:industry:(\d+)/);
      if (!idMatch) return null;

      const id = idMatch[1];
      const name = element.text?.text || element.title?.text || element.name || element.localizedName || "";

      if (!name) return null;

      return {
        id,
        name,
        type: "INDUSTRY",
        urn: `urn:li:industry:${id}`
      };
    } catch (error) {
      return null;
    }
  },

  // Static industry list fallback
  searchIndustriesStatic(query) {
    const lowerQuery = query.toLowerCase();
    return INDUSTRIES_LIST.filter(ind =>
      ind.name.toLowerCase().includes(lowerQuery)
    ).slice(0, 10);
  },

  // Check if user is logged into LinkedIn
  async checkAuth() {
    try {
      // First check if we have the li_at cookie
      const hasAuth = await this.isAuthenticated();
      if (!hasAuth) {
        return false;
      }

      // Verify with API call
      const response = await fetch("https://www.linkedin.com/voyager/api/me", {
        method: "GET",
        headers: await this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
};

// Static list of LinkedIn industries (fallback)
const INDUSTRIES_LIST = [
  { id: "1", name: "Defense & Space", type: "INDUSTRY" },
  { id: "3", name: "Computer Hardware", type: "INDUSTRY" },
  { id: "4", name: "Computer Software", type: "INDUSTRY" },
  { id: "5", name: "Computer Networking", type: "INDUSTRY" },
  { id: "6", name: "Internet", type: "INDUSTRY" },
  { id: "7", name: "Semiconductors", type: "INDUSTRY" },
  { id: "8", name: "Telecommunications", type: "INDUSTRY" },
  { id: "9", name: "Law Practice", type: "INDUSTRY" },
  { id: "10", name: "Legal Services", type: "INDUSTRY" },
  { id: "11", name: "Management Consulting", type: "INDUSTRY" },
  { id: "12", name: "Biotechnology", type: "INDUSTRY" },
  { id: "13", name: "Medical Practice", type: "INDUSTRY" },
  { id: "14", name: "Hospital & Health Care", type: "INDUSTRY" },
  { id: "15", name: "Pharmaceuticals", type: "INDUSTRY" },
  { id: "16", name: "Veterinary", type: "INDUSTRY" },
  { id: "17", name: "Medical Devices", type: "INDUSTRY" },
  { id: "18", name: "Cosmetics", type: "INDUSTRY" },
  { id: "19", name: "Apparel & Fashion", type: "INDUSTRY" },
  { id: "20", name: "Sporting Goods", type: "INDUSTRY" },
  { id: "21", name: "Tobacco", type: "INDUSTRY" },
  { id: "22", name: "Supermarkets", type: "INDUSTRY" },
  { id: "23", name: "Food Production", type: "INDUSTRY" },
  { id: "24", name: "Consumer Electronics", type: "INDUSTRY" },
  { id: "25", name: "Consumer Goods", type: "INDUSTRY" },
  { id: "26", name: "Furniture", type: "INDUSTRY" },
  { id: "27", name: "Retail", type: "INDUSTRY" },
  { id: "28", name: "Entertainment", type: "INDUSTRY" },
  { id: "29", name: "Gambling & Casinos", type: "INDUSTRY" },
  { id: "30", name: "Leisure, Travel & Tourism", type: "INDUSTRY" },
  { id: "31", name: "Hospitality", type: "INDUSTRY" },
  { id: "32", name: "Restaurants", type: "INDUSTRY" },
  { id: "33", name: "Sports", type: "INDUSTRY" },
  { id: "34", name: "Food & Beverages", type: "INDUSTRY" },
  { id: "35", name: "Motion Pictures and Film", type: "INDUSTRY" },
  { id: "36", name: "Broadcast Media", type: "INDUSTRY" },
  { id: "37", name: "Museums and Institutions", type: "INDUSTRY" },
  { id: "38", name: "Fine Art", type: "INDUSTRY" },
  { id: "39", name: "Performing Arts", type: "INDUSTRY" },
  { id: "40", name: "Recreational Facilities and Services", type: "INDUSTRY" },
  { id: "41", name: "Banking", type: "INDUSTRY" },
  { id: "42", name: "Insurance", type: "INDUSTRY" },
  { id: "43", name: "Financial Services", type: "INDUSTRY" },
  { id: "44", name: "Real Estate", type: "INDUSTRY" },
  { id: "45", name: "Investment Banking", type: "INDUSTRY" },
  { id: "46", name: "Investment Management", type: "INDUSTRY" },
  { id: "47", name: "Accounting", type: "INDUSTRY" },
  { id: "48", name: "Construction", type: "INDUSTRY" },
  { id: "49", name: "Building Materials", type: "INDUSTRY" },
  { id: "50", name: "Architecture & Planning", type: "INDUSTRY" },
  { id: "51", name: "Civil Engineering", type: "INDUSTRY" },
  { id: "52", name: "Aviation & Aerospace", type: "INDUSTRY" },
  { id: "53", name: "Automotive", type: "INDUSTRY" },
  { id: "54", name: "Chemicals", type: "INDUSTRY" },
  { id: "55", name: "Machinery", type: "INDUSTRY" },
  { id: "56", name: "Mining & Metals", type: "INDUSTRY" },
  { id: "57", name: "Oil & Energy", type: "INDUSTRY" },
  { id: "58", name: "Shipbuilding", type: "INDUSTRY" },
  { id: "59", name: "Utilities", type: "INDUSTRY" },
  { id: "60", name: "Textiles", type: "INDUSTRY" },
  { id: "61", name: "Paper & Forest Products", type: "INDUSTRY" },
  { id: "62", name: "Railroad Manufacture", type: "INDUSTRY" },
  { id: "63", name: "Farming", type: "INDUSTRY" },
  { id: "64", name: "Ranching", type: "INDUSTRY" },
  { id: "65", name: "Dairy", type: "INDUSTRY" },
  { id: "66", name: "Fishery", type: "INDUSTRY" },
  { id: "67", name: "Primary/Secondary Education", type: "INDUSTRY" },
  { id: "68", name: "Higher Education", type: "INDUSTRY" },
  { id: "69", name: "Education Management", type: "INDUSTRY" },
  { id: "70", name: "Research", type: "INDUSTRY" },
  { id: "71", name: "Military", type: "INDUSTRY" },
  { id: "72", name: "Legislative Office", type: "INDUSTRY" },
  { id: "73", name: "Judiciary", type: "INDUSTRY" },
  { id: "74", name: "International Affairs", type: "INDUSTRY" },
  { id: "75", name: "Government Administration", type: "INDUSTRY" },
  { id: "76", name: "Executive Office", type: "INDUSTRY" },
  { id: "77", name: "Law Enforcement", type: "INDUSTRY" },
  { id: "78", name: "Public Safety", type: "INDUSTRY" },
  { id: "79", name: "Public Policy", type: "INDUSTRY" },
  { id: "80", name: "Marketing and Advertising", type: "INDUSTRY" },
  { id: "81", name: "Newspapers", type: "INDUSTRY" },
  { id: "82", name: "Publishing", type: "INDUSTRY" },
  { id: "83", name: "Printing", type: "INDUSTRY" },
  { id: "84", name: "Information Services", type: "INDUSTRY" },
  { id: "85", name: "Libraries", type: "INDUSTRY" },
  { id: "86", name: "Environmental Services", type: "INDUSTRY" },
  { id: "87", name: "Package/Freight Delivery", type: "INDUSTRY" },
  { id: "88", name: "Individual & Family Services", type: "INDUSTRY" },
  { id: "89", name: "Religious Institutions", type: "INDUSTRY" },
  { id: "90", name: "Civic & Social Organization", type: "INDUSTRY" },
  { id: "91", name: "Consumer Services", type: "INDUSTRY" },
  { id: "92", name: "Transportation/Trucking/Railroad", type: "INDUSTRY" },
  { id: "93", name: "Warehousing", type: "INDUSTRY" },
  { id: "94", name: "Airlines/Aviation", type: "INDUSTRY" },
  { id: "95", name: "Maritime", type: "INDUSTRY" },
  { id: "96", name: "Information Technology and Services", type: "INDUSTRY" },
  { id: "97", name: "Market Research", type: "INDUSTRY" },
  { id: "98", name: "Public Relations and Communications", type: "INDUSTRY" },
  { id: "99", name: "Design", type: "INDUSTRY" },
  { id: "100", name: "Nonprofit Organization Management", type: "INDUSTRY" },
  { id: "101", name: "Fund-Raising", type: "INDUSTRY" },
  { id: "102", name: "Program Development", type: "INDUSTRY" },
  { id: "103", name: "Writing and Editing", type: "INDUSTRY" },
  { id: "104", name: "Staffing and Recruiting", type: "INDUSTRY" },
  { id: "105", name: "Professional Training & Coaching", type: "INDUSTRY" },
  { id: "106", name: "Venture Capital & Private Equity", type: "INDUSTRY" },
  { id: "107", name: "Political Organization", type: "INDUSTRY" },
  { id: "108", name: "Translation and Localization", type: "INDUSTRY" },
  { id: "109", name: "Computer Games", type: "INDUSTRY" },
  { id: "110", name: "Events Services", type: "INDUSTRY" },
  { id: "111", name: "Arts and Crafts", type: "INDUSTRY" },
  { id: "112", name: "Electrical/Electronic Manufacturing", type: "INDUSTRY" },
  { id: "113", name: "Online Media", type: "INDUSTRY" },
  { id: "114", name: "Nanotechnology", type: "INDUSTRY" },
  { id: "115", name: "Music", type: "INDUSTRY" },
  { id: "116", name: "Logistics and Supply Chain", type: "INDUSTRY" },
  { id: "117", name: "Plastics", type: "INDUSTRY" },
  { id: "118", name: "Computer & Network Security", type: "INDUSTRY" },
  { id: "119", name: "Wireless", type: "INDUSTRY" },
  { id: "120", name: "Alternative Dispute Resolution", type: "INDUSTRY" },
  { id: "121", name: "Security and Investigations", type: "INDUSTRY" },
  { id: "122", name: "Facilities Services", type: "INDUSTRY" },
  { id: "123", name: "Outsourcing/Offshoring", type: "INDUSTRY" },
  { id: "124", name: "Health, Wellness and Fitness", type: "INDUSTRY" },
  { id: "125", name: "Alternative Medicine", type: "INDUSTRY" },
  { id: "126", name: "Media Production", type: "INDUSTRY" },
  { id: "127", name: "Animation", type: "INDUSTRY" },
  { id: "128", name: "Commercial Real Estate", type: "INDUSTRY" },
  { id: "129", name: "Capital Markets", type: "INDUSTRY" },
  { id: "130", name: "Think Tanks", type: "INDUSTRY" },
  { id: "131", name: "Philanthropy", type: "INDUSTRY" },
  { id: "132", name: "E-Learning", type: "INDUSTRY" },
  { id: "133", name: "Wholesale", type: "INDUSTRY" },
  { id: "134", name: "Import and Export", type: "INDUSTRY" },
  { id: "135", name: "Mechanical or Industrial Engineering", type: "INDUSTRY" },
  { id: "136", name: "Photography", type: "INDUSTRY" },
  { id: "137", name: "Human Resources", type: "INDUSTRY" },
  { id: "138", name: "Business Supplies and Equipment", type: "INDUSTRY" },
  { id: "139", name: "Mental Health Care", type: "INDUSTRY" },
  { id: "140", name: "Graphic Design", type: "INDUSTRY" },
  { id: "141", name: "International Trade and Development", type: "INDUSTRY" },
  { id: "142", name: "Wine and Spirits", type: "INDUSTRY" },
  { id: "143", name: "Luxury Goods & Jewelry", type: "INDUSTRY" },
  { id: "144", name: "Renewables & Environment", type: "INDUSTRY" },
  { id: "145", name: "Glass, Ceramics & Concrete", type: "INDUSTRY" },
  { id: "146", name: "Packaging and Containers", type: "INDUSTRY" },
  { id: "147", name: "Industrial Automation", type: "INDUSTRY" },
  { id: "148", name: "Government Relations", type: "INDUSTRY" },
  { id: "150", name: "Horticulture", type: "INDUSTRY" },
  { id: "1594", name: "Technology, Information and Internet", type: "INDUSTRY" },
  { id: "3231", name: "IT Services and IT Consulting", type: "INDUSTRY" }
];

// Export for use in other modules
if (typeof module !== "undefined") {
  module.exports = { LinkedInAPI, INDUSTRIES_LIST };
}
