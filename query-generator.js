// ============================================
// Boolean Query Generator - Core Logic
// ============================================

// Platform Configurations
const PLATFORMS = {
  google: {
    name: "google",
    displayName: "Google (X-ray)",
    maxLength: 32,
    lengthUnit: "words",
    maxOperators: 999,
    supportsParentheses: true,
    supportsExplicitAnd: false,
    supportsExplicitOr: true,
    notSyntax: "-",
    baseUrl: "https://www.google.com/search?q=",
    fields: ["skills", "titles", "companies", "locations", "exclusions"]
  },
  github: {
    name: "github",
    displayName: "GitHub User Search",
    maxLength: 256,
    lengthUnit: "characters",
    maxOperators: 5,
    supportsParentheses: false,
    supportsExplicitAnd: false,
    supportsExplicitOr: false,
    notSyntax: "-",
    baseUrl: "https://github.com/search?type=users&q=",
    fields: ["skills", "locations", "minFollowers", "keywords"]
  },
  linkedin: {
    name: "linkedin",
    displayName: "LinkedIn Search",
    maxLength: 1000,
    lengthUnit: "characters",
    maxOperators: 6,           // Vanilla mode limit
    maxOperatorsHack: 999,     // Hack mode (char limit only)
    supportsParentheses: true,
    supportsExplicitAnd: true,
    supportsExplicitOr: true,
    notSyntax: "NOT",
    baseUrl: "https://www.linkedin.com/search/results/people/",
    fields: ["skills", "titles", "locations", "exclusions", "facets"]
  }
};

// ============================================
// Utility Functions
// ============================================

function countWords(query) {
  // Quoted phrases count as 1 word
  let processed = query.replace(/"[^"]+"/g, "QUOTED");
  // Remove operators that don't count
  processed = processed.replace(/site:\S+/g, "SITEOP");
  return processed.split(/\s+/).filter(w => w.length > 0).length;
}

function escapeForUrl(str) {
  return encodeURIComponent(str);
}

function needsQuotes(str) {
  return str.includes(" ");
}

function formatTerm(term) {
  return needsQuotes(term) ? `"${term}"` : term;
}

// ============================================
// Validators
// ============================================

function validateGoogle(query) {
  const wordCount = countWords(query);
  if (wordCount > 32) {
    return { valid: false, message: `Exceeds 32 words (${wordCount})` };
  }
  return { valid: true, message: "OK" };
}

function validateGitHub(query) {
  if (query.length > 256) {
    return { valid: false, message: `Exceeds 256 characters (${query.length})` };
  }
  if (query.includes("(") || query.includes(")")) {
    return { valid: false, message: "Parentheses not supported" };
  }
  const operatorCount = (query.match(/\b(AND|OR|NOT)\b/g) || []).length;
  if (operatorCount > 5) {
    return { valid: false, message: `Exceeds 5 operators (${operatorCount})` };
  }
  return { valid: true, message: "OK" };
}

function validateLinkedIn(query, hackMode = false) {
  if (query.length > 1000) {
    return { valid: false, message: `Exceeds 1000 characters (${query.length})` };
  }

  // Count operators - both standard "AND term" and hack "AND(term)" formats
  const operatorCount = (query.match(/\b(AND|OR|NOT)\b/g) || []).length;
  const maxOps = hackMode ? PLATFORMS.linkedin.maxOperatorsHack : PLATFORMS.linkedin.maxOperators;

  if (operatorCount > maxOps) {
    return { valid: false, message: `Exceeds ${maxOps} operators (${operatorCount})` };
  }

  return { valid: true, message: "OK" };
}

function validate(platform, query, options = {}) {
  if (platform === "google") return validateGoogle(query);
  if (platform === "github") return validateGitHub(query);
  if (platform === "linkedin") return validateLinkedIn(query, options.hackMode);
  return { valid: false, message: "Unknown platform" };
}

// ============================================
// Google Query Generator
// ============================================

function generateGoogleQueries(inputs) {
  const queries = [];
  const { skills, titles, companies, locations, exclusions } = inputs;
  
  // Build exclusion string
  const excludeStr = exclusions.length > 0 
    ? " " + exclusions.map(e => `-${e}`).join(" ") 
    : "";
  
  // Build title group
  const titleGroup = titles.length > 0 
    ? ` (${titles.join(" OR ")})` 
    : "";
  
  // Base site filter
  const siteFilter = "site:linkedin.com/in";
  
  // Pattern 1: Strict skills (AND - all required)
  if (skills.length > 0) {
    const strictSkills = `(${skills.join(" ")})`;
    
    if (locations.length === 0 && companies.length === 0) {
      // Simple query
      const query = `${siteFilter} ${strictSkills}${titleGroup}${excludeStr}`.trim();
      queries.push(createQuery("google", "Strict Skills", "All skills required", query));
    } else {
      // Split by location batches
      if (locations.length > 0) {
        const locationBatches = batchItems(locations, 3);
        locationBatches.forEach((batch, i) => {
          const locGroup = ` (${batch.map(formatTerm).join(" OR ")})`;
          const query = `${siteFilter} ${strictSkills}${titleGroup}${locGroup}${excludeStr}`.trim();
          queries.push(createQuery("google", `Strict + Location ${i + 1}`, `All skills, locations: ${batch.join(", ")}`, query));
        });
      }
      
      // Split by company batches
      if (companies.length > 0) {
        const companyBatches = batchItems(companies, 3);
        companyBatches.forEach((batch, i) => {
          const compGroup = ` (${batch.map(formatTerm).join(" OR ")})`;
          const query = `${siteFilter} ${strictSkills}${titleGroup}${compGroup}${excludeStr}`.trim();
          queries.push(createQuery("google", `Strict + Company ${i + 1}`, `All skills, companies: ${batch.join(", ")}`, query));
        });
      }
    }
  }
  
  // Pattern 2: Broad skills (OR - any skill)
  if (skills.length > 1) {
    const broadSkills = `(${skills.join(" OR ")})`;
    
    if (locations.length === 0 && companies.length === 0) {
      const query = `${siteFilter} ${broadSkills}${titleGroup}${excludeStr}`.trim();
      queries.push(createQuery("google", "Broad Skills", "Any skill matches", query));
    } else {
      if (locations.length > 0) {
        const locationBatches = batchItems(locations, 3);
        locationBatches.forEach((batch, i) => {
          const locGroup = ` (${batch.map(formatTerm).join(" OR ")})`;
          const query = `${siteFilter} ${broadSkills}${titleGroup}${locGroup}${excludeStr}`.trim();
          queries.push(createQuery("google", `Broad + Location ${i + 1}`, `Any skill, locations: ${batch.join(", ")}`, query));
        });
      }
      
      if (companies.length > 0) {
        const companyBatches = batchItems(companies, 3);
        companyBatches.forEach((batch, i) => {
          const compGroup = ` (${batch.map(formatTerm).join(" OR ")})`;
          const query = `${siteFilter} ${broadSkills}${titleGroup}${compGroup}${excludeStr}`.trim();
          queries.push(createQuery("google", `Broad + Company ${i + 1}`, `Any skill, companies: ${batch.join(", ")}`, query));
        });
      }
    }
  }
  
  // Pattern 3: Individual skill queries (for comprehensive coverage)
  if (skills.length > 2) {
    skills.forEach(skill => {
      const query = `${siteFilter} ${formatTerm(skill)}${titleGroup}${excludeStr}`.trim();
      queries.push(createQuery("google", `Single: ${skill}`, `Focus on ${skill}`, query));
    });
  }
  
  return queries;
}

// ============================================
// GitHub Query Generator
// ============================================

function generateGitHubQueries(inputs) {
  const queries = [];
  const { skills, locations, minFollowers, keywords } = inputs;
  
  const basePrefix = "type:user";
  const followerFilter = minFollowers > 0 ? ` followers:>${minFollowers}` : "";
  const keywordStr = keywords.length > 0 ? " " + keywords.join(" ") : "";
  
  // GitHub requires splitting by language since you can only do implicit OR
  // with the same qualifier repeated
  
  if (skills.length === 0 && locations.length === 0) {
    // Just keywords + followers
    if (keywords.length > 0 || minFollowers > 0) {
      const query = `${basePrefix}${keywordStr}${followerFilter} in:name in:login`.trim();
      queries.push(createQuery("github", "Keyword Search", "Search by keywords", query));
    }
    return queries;
  }
  
  // Generate per-language queries
  if (skills.length > 0) {
    skills.forEach(lang => {
      if (locations.length === 0) {
        // Language only
        const query = `${basePrefix} language:${lang.toLowerCase()}${followerFilter}${keywordStr}`.trim();
        queries.push(createQuery("github", `Language: ${lang}`, `Developers using ${lang}`, query));
      } else {
        // Language + locations (can batch locations via implicit OR)
        const locationBatches = batchItems(locations, 4); // Keep queries manageable
        locationBatches.forEach((batch, i) => {
          const locStr = batch.map(loc => ` location:${formatTerm(loc)}`).join("");
          const query = `${basePrefix}${locStr} language:${lang.toLowerCase()}${followerFilter}${keywordStr}`.trim();
          queries.push(createQuery(
            "github", 
            `${lang} + Locations ${i + 1}`, 
            `${lang} devs in ${batch.join(", ")}`, 
            query
          ));
        });
      }
    });
  } else if (locations.length > 0) {
    // Locations only (no language filter)
    const locationBatches = batchItems(locations, 4);
    locationBatches.forEach((batch, i) => {
      const locStr = batch.map(loc => ` location:${formatTerm(loc)}`).join("");
      const query = `${basePrefix}${locStr}${followerFilter}${keywordStr} in:name in:login`.trim();
      queries.push(createQuery("github", `Locations ${i + 1}`, `Users in ${batch.join(", ")}`, query));
    });
  }
  
  return queries;
}

// ============================================
// LinkedIn Query Generator
// ============================================

function generateLinkedInQueries(inputs, hackMode = false, facets = {}) {
  const queries = [];
  const { skills, titles, exclusions } = inputs;

  // Helper to join terms with OR
  function buildOrGroup(terms, useHack) {
    if (terms.length === 0) return "";
    if (terms.length === 1) return formatTerm(terms[0]);

    if (useHack) {
      // Hack format: (term1 OR(term2) OR(term3))
      const first = formatTerm(terms[0]);
      const rest = terms.slice(1).map(t => `OR(${formatTerm(t)})`).join(" ");
      return `(${first} ${rest})`;
    } else {
      // Standard format: (term1 OR term2 OR term3)
      return `(${terms.map(formatTerm).join(" OR ")})`;
    }
  }

  // Helper to build exclusions
  function buildExclusions(terms, useHack) {
    if (terms.length === 0) return "";
    if (useHack) {
      return " " + terms.map(t => `NOT(${formatTerm(t)})`).join(" ");
    } else {
      return " " + terms.map(t => `NOT ${formatTerm(t)}`).join(" ");
    }
  }

  const excludeStr = buildExclusions(exclusions, hackMode);

  // Check if we have any facets selected
  const hasFacets = facets && (
    (facets.geoUrn && facets.geoUrn.length > 0) ||
    (facets.currentCompany && facets.currentCompany.length > 0) ||
    (facets.pastCompany && facets.pastCompany.length > 0) ||
    (facets.industry && facets.industry.length > 0) ||
    (facets.schoolFilter && facets.schoolFilter.length > 0)
  );

  // Build facet description for query labels
  function getFacetDescription() {
    const parts = [];
    if (facets.geoUrn?.length) parts.push(`${facets.geoUrn.length} location(s)`);
    if (facets.currentCompany?.length) parts.push(`${facets.currentCompany.length} current company(s)`);
    if (facets.pastCompany?.length) parts.push(`${facets.pastCompany.length} past company(s)`);
    if (facets.industry?.length) parts.push(`${facets.industry.length} industry(s)`);
    if (facets.schoolFilter?.length) parts.push(`${facets.schoolFilter.length} school(s)`);
    return parts.length > 0 ? ` + ${parts.join(", ")}` : "";
  }

  const facetDesc = getFacetDescription();

  // Pattern 1: All skills required (AND logic)
  if (skills.length > 0) {
    let skillPart;
    if (hackMode) {
      // Hack: skill1 AND(skill2) AND(skill3)
      const first = formatTerm(skills[0]);
      const rest = skills.slice(1).map(s => `AND(${formatTerm(s)})`).join(" ");
      skillPart = rest ? `${first} ${rest}` : first;
    } else {
      // Standard: skill1 AND skill2 AND skill3
      skillPart = skills.map(formatTerm).join(" AND ");
    }

    const titlePart = titles.length > 0
      ? (hackMode ? ` AND(${buildOrGroup(titles, hackMode)})` : ` AND ${buildOrGroup(titles, hackMode)}`)
      : "";

    const query = `${skillPart}${titlePart}${excludeStr}`.trim();
    queries.push(createLinkedInQuery(
      `Strict Skills${facetDesc}`,
      "All skills required" + (hasFacets ? " with LinkedIn filters" : ""),
      query,
      hackMode,
      facets
    ));
  }

  // Pattern 2: Any skill (OR logic)
  if (skills.length > 1) {
    const skillPart = buildOrGroup(skills, hackMode);

    const titlePart = titles.length > 0
      ? (hackMode ? ` AND(${buildOrGroup(titles, hackMode)})` : ` AND ${buildOrGroup(titles, hackMode)}`)
      : "";

    const query = `${skillPart}${titlePart}${excludeStr}`.trim();
    queries.push(createLinkedInQuery(
      `Broad Skills${facetDesc}`,
      "Any skill matches" + (hasFacets ? " with LinkedIn filters" : ""),
      query,
      hackMode,
      facets
    ));
  }

  // Pattern 3: Individual skill queries (only if no facets, to avoid too many queries)
  if (skills.length > 2 && !hasFacets) {
    const titlePart = titles.length > 0
      ? (hackMode ? ` AND(${buildOrGroup(titles, hackMode)})` : ` AND ${buildOrGroup(titles, hackMode)}`)
      : "";

    skills.forEach(skill => {
      const query = `${formatTerm(skill)}${titlePart}${excludeStr}`.trim();
      queries.push(createLinkedInQuery(`Single: ${skill}`, `Focus on ${skill}`, query, hackMode, facets));
    });
  }

  // If no skills but has facets, generate a basic query
  if (skills.length === 0 && hasFacets) {
    const titlePart = titles.length > 0 ? buildOrGroup(titles, hackMode) : "";
    const query = titlePart ? `${titlePart}${excludeStr}`.trim() : "";
    queries.push(createLinkedInQuery(
      `Filters Only${facetDesc}`,
      "Search with LinkedIn filters only",
      query,
      hackMode,
      facets
    ));
  }

  return queries;
}

function createLinkedInQuery(label, purpose, queryString, hackMode, facets = {}) {
  const config = PLATFORMS.linkedin;
  const validation = validateLinkedIn(queryString, hackMode);

  // Build URL with facet parameters
  const url = buildLinkedInUrl(queryString, facets);

  return {
    platform: "linkedin",
    label,
    purpose,
    query: queryString,
    length: queryString.length,
    lengthUnit: config.lengthUnit,
    maxLength: config.maxLength,
    valid: validation.valid,
    validationMessage: validation.message,
    url,
    hackMode,
    facets
  };
}

// Build LinkedIn search URL with facet parameters
function buildLinkedInUrl(keywords, facets = {}) {
  const baseUrl = PLATFORMS.linkedin.baseUrl;
  const params = new URLSearchParams();

  // Add keywords if present
  if (keywords && keywords.trim()) {
    params.set("keywords", keywords);
  }

  // Add facet parameters in LinkedIn's format: ["id1","id2"]
  if (facets.geoUrn && facets.geoUrn.length > 0) {
    params.set("geoUrn", JSON.stringify(facets.geoUrn));
  }

  if (facets.currentCompany && facets.currentCompany.length > 0) {
    params.set("currentCompany", JSON.stringify(facets.currentCompany));
  }

  if (facets.pastCompany && facets.pastCompany.length > 0) {
    params.set("pastCompany", JSON.stringify(facets.pastCompany));
  }

  if (facets.industry && facets.industry.length > 0) {
    params.set("industry", JSON.stringify(facets.industry));
  }

  if (facets.schoolFilter && facets.schoolFilter.length > 0) {
    params.set("schoolFilter", JSON.stringify(facets.schoolFilter));
  }

  // Add origin parameter (required by LinkedIn)
  params.set("origin", "FACETED_SEARCH");

  return baseUrl + "?" + params.toString();
}

// ============================================
// Helper Functions
// ============================================

function batchItems(items, batchSize) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

function createQuery(platform, label, purpose, queryString) {
  const config = PLATFORMS[platform];
  const validation = validate(platform, queryString);
  const length = config.lengthUnit === "words" 
    ? countWords(queryString) 
    : queryString.length;
  
  return {
    platform,
    label,
    purpose,
    query: queryString,
    length,
    lengthUnit: config.lengthUnit,
    maxLength: config.maxLength,
    valid: validation.valid,
    validationMessage: validation.message,
    url: config.baseUrl + escapeForUrl(queryString)
  };
}

// ============================================
// Main Generator Function
// ============================================

function generateQueries(platform, inputs, options = {}) {
  // Clean inputs
  const cleanInputs = {
    skills: parseList(inputs.skills),
    titles: parseList(inputs.titles || ""),
    companies: parseList(inputs.companies || ""),
    locations: parseList(inputs.locations),
    exclusions: parseList(inputs.exclusions || ""),
    minFollowers: parseInt(inputs.minFollowers) || 0,
    keywords: parseList(inputs.keywords || "")
  };

  // Get facets for LinkedIn (if present)
  const facets = inputs.facets || {};

  let queries;
  if (platform === "google") {
    queries = generateGoogleQueries(cleanInputs);
  } else if (platform === "github") {
    queries = generateGitHubQueries(cleanInputs);
  } else if (platform === "linkedin") {
    queries = generateLinkedInQueries(cleanInputs, options.hackMode || false, facets);
  } else {
    queries = [];
  }

  return {
    platform,
    platformName: PLATFORMS[platform].displayName,
    queries,
    totalQueries: queries.length,
    validQueries: queries.filter(q => q.valid).length,
    timestamp: new Date().toISOString(),
    inputs: cleanInputs,
    facets,
    hackMode: options.hackMode || false
  };
}

function parseList(input) {
  if (Array.isArray(input)) return input.filter(i => i.trim());
  if (typeof input !== "string") return [];
  return input
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Export for use in popup.js
if (typeof module !== "undefined") {
  module.exports = { generateQueries, PLATFORMS, validate };
}
