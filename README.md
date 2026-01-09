# boolean-query-generator
A Chrome extension that generates optimized boolean search queries for Google X-ray (LinkedIn sourcing), native LinkedIn people search, and GitHub user search with automatic coverage splitting.

## Features

- **Platform-aware generation**: Respects Google's 32-word limit, GitHub's 256-character / 5-operator limits, and LinkedIn's search constraints
- **LinkedIn Native Search**: Generate LinkedIn people search URLs with faceted filters (location, company, industry, school, job title)
- **Offline autocomplete**: Pre-loaded data for LinkedIn filters - no authentication required
- **Automatic splitting**: Breaks complex searches into multiple valid queries for full coverage
- **Operator Hack Mode**: LinkedIn option to bypass the 6-operator limit using AND(term) syntax
- **Query validation**: Real-time feedback on query validity with length indicators
- **Presets**: Save and load your common search configurations
- **History**: Track and re-run previous searches
- **One-click execution**: Open generated queries directly in new tabs
- **Copy functions**: Copy individual queries or all at once
  
<img width="400" height="562" alt="uibooleangenerator" src="https://github.com/user-attachments/assets/e72ee3b8-3d40-4a2f-adb6-4402474fb991" />

<img width="400" height="562" alt="ui1booleangenerator" src="https://github.com/user-attachments/assets/fc80cafb-bb77-4013-befd-8bc06dabf23a" />
<img width="400" height="562" alt="ui2booleangenerator" src="https://github.com/user-attachments/assets/246b8ad5-c719-40ad-9fd8-1eaa2e9dfb55" />
<img width="400" height="562" alt="ui3booleangenerator" src="https://github.com/user-attachments/assets/2cfac9a2-65e8-4272-bc4a-7b4178221c76" />

## Installation

### From Release (Recommended)

1. Download the latest `boolean-query-generator-vX.X.X.zip` from [Releases](../../releases)
2. Extract the ZIP file to a folder
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right corner)
5. Click **Load unpacked**
6. Select the extracted folder
7. The extension icon will appear in your toolbar

### From Source

1. Clone this repository: `git clone https://github.com/carlopezzuto/boolean-query-generator.git`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `boolean-query-generator` folder
6. The extension icon will appear in your toolbar

### From Chrome Web Store

*(Coming soon)*

## Usage

### Google X-ray Search

Best for LinkedIn profile sourcing via Google:

1. Select **Google (X-ray)** platform
2. Enter **Skills** (e.g., Python, Go, Rust)
3. Enter **Titles** (e.g., Engineer, Developer)
4. Optionally add **Companies** and **Locations**
5. Add **Exclusions** (e.g., recruiter, intern)
6. Click **Generate Queries**

The tool generates multiple queries:
- **Strict Skills**: All skills required (AND)
- **Broad Skills**: Any skill matches (OR)
- **Location/Company splits**: Separate queries per batch

### LinkedIn Native Search

Best for searching directly on LinkedIn with precise filters:

1. Select **LinkedIn Search** platform
2. Enter **Skills/Languages** for keyword search
3. Enter **Titles** to search in keywords
4. Use the **LinkedIn Filters** to add faceted search criteria:
   - **Location**: Geographic regions (countries, cities)
   - **Current Company**: Where they work now
   - **Past Company**: Where they worked before
   - **Job Title**: Current or past positions
   - **Industry**: Business sector
   - **School**: Education background
5. Optionally enable **Operator Hack Mode** to bypass LinkedIn's 6-operator limit
6. Add **Exclusions** for terms to exclude
7. Click **Generate Queries**

All LinkedIn filters use offline autocomplete - no LinkedIn login required!

### GitHub User Search

Best for finding developers on GitHub:

1. Select **GitHub User Search** platform
2. Enter **Skills/Languages** (e.g., Python, Go)
3. Enter **Locations** (e.g., San Francisco, Berlin)
4. Optionally set **Min Followers** filter
5. Add **Keywords** for bio/name search
6. Click **Generate Queries**

The tool automatically splits by language (GitHub limitation).

### Presets

- Click **Save as Preset** after entering your search criteria
- Load presets from the **Presets** tab
- Great for recurring searches (e.g., "Backend Engineer SF")

### History

- All generated query sets are saved automatically
- Re-run previous searches with one click
- View and open individual queries from history

### Settings

- View data statistics for available offline filters
- See counts of locations, companies, job titles, and industries

## Platform Constraints

### Google Search
| Constraint | Detail |
|------------|--------|
| 32 word limit | Everything after word 32 is ignored |
| AND is implicit | Space = AND |
| OR must be caps | `OR` is operator, `or` is search term |
| NOT = minus | Use `-term` instead |

### GitHub User Search
| Constraint | Detail |
|------------|--------|
| 256 character limit | Total query length |
| Max 5 operators | Cannot exceed 5 AND/OR/NOT |
| No parentheses | Breaks search entirely |
| Implicit OR | Repeat same qualifier for OR |

### LinkedIn Search
| Constraint | Detail |
|------------|--------|
| 6 operator limit | Max 6 AND/OR/NOT operators by default |
| Operator Hack Mode | Uses AND(term) syntax to bypass limit |
| Faceted filters | Use URL parameters for precise filtering |
| Keywords | Free-text search in profiles |

## Development

```
boolean-query-generator/
├── manifest.json      # Extension manifest (v3)
├── popup.html         # Main UI
├── popup.css          # Styles
├── popup.js           # UI logic & event handling
├── query-generator.js # Core generation logic
├── storage.js         # Chrome storage for presets/history
├── linkedin-api.js    # LinkedIn data service (offline search)
├── static-data.js     # Pre-loaded data (locations, companies, etc.)
├── background.js      # Service worker
└── icons/             # Extension icons
```

## License

MIT

## Author

Built with love for recruiters and sourcers by [Carlo](https://linkedin.com/in/carlopezzuto)
