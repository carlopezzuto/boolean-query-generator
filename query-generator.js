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

function validate(platform, query) {
  return platform === "google" ? validateGoogle(query) : validateGitHub(query);
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

function generateQueries(platform, inputs) {
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
  
  const queries = platform === "google" 
    ? generateGoogleQueries(cleanInputs)
    : generateGitHubQueries(cleanInputs);
  
  return {
    platform,
    platformName: PLATFORMS[platform].displayName,
    queries,
    totalQueries: queries.length,
    validQueries: queries.filter(q => q.valid).length,
    timestamp: new Date().toISOString(),
    inputs: cleanInputs
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
