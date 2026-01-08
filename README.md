# boolean-query-generator
A Chrome extension that generates optimized boolean search queries for Google X-ray (LinkedIn sourcing) and GitHub user search with automatic coverage splitting.

## Features

- **Platform-aware generation**: Respects Google's 32-word limit and GitHub's 256-character / 5-operator limits
- **Automatic splitting**: Breaks complex searches into multiple valid queries for full coverage
- **Query validation**: Real-time feedback on query validity with length indicators
- **Presets**: Save and load your common search configurations
- **History**: Track and re-run previous searches
- **One-click execution**: Open generated queries directly in new tabs
- **Copy functions**: Copy individual queries or all at once

## Installation

### From Source (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `boolean-query-generator` folder
6. The extension icon will appear in your toolbar

### From Chrome Web Store

*(Coming soon after submission)*

## Usage

### Google X-ray Search

Best for LinkedIn profile sourcing:

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

## Development

```
boolean-query-generator/
├── manifest.json      # Extension manifest (v3)
├── popup.html         # Main UI
├── popup.css          # Styles
├── popup.js           # UI logic & event handling
├── query-generator.js # Core generation logic
├── storage.js         # Chrome storage for presets/history
└── icons/             # Extension icons
```

## License

MIT

## Author

Built with ❤️ for recruiters and sourcers by [Carlo](https://linkedin.com/in/carlopezzuto)

