# Contributing to Boolean Query Generator

Thanks for your interest in contributing. This document outlines how to get involved.

## Development Setup

### Prerequisites

- Chrome or Chromium-based browser
- Text editor (VS Code recommended)
- Git

### Local Installation

```bash
git clone https://github.com/yourusername/boolean-query-generator.git
cd boolean-query-generator
```

Load the extension in Chrome:

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the project folder

The extension reloads automatically when you modify files. For `manifest.json` changes, click the refresh icon on the extension card.

## Project Structure

```
boolean-query-generator/
├── manifest.json         # Extension config (permissions, icons, entry points)
├── popup.html            # Main UI markup
├── popup.css             # Styles
├── popup.js              # UI logic, event handling, DOM manipulation
├── query-generator.js    # Core query generation, platform configs, validators
├── storage.js            # Chrome storage API wrapper for presets/history
├── icons/                # Extension icons (16, 48, 128px)
├── README.md             # User documentation
└── CONTRIBUTING.md       # This file
```

### Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `query-generator.js` | Platform configs, validation rules, query building, splitting logic |
| `storage.js` | Preset CRUD, history management, Chrome storage abstraction |
| `popup.js` | Tab navigation, form handling, results rendering, clipboard, tab opening |

## How to Contribute

### Reporting Bugs

Open an issue with:

- Browser version
- Steps to reproduce
- Expected vs actual behavior
- Screenshot if applicable
- Sample inputs that trigger the bug

### Suggesting Features

Open an issue tagged `enhancement` with:

- Use case description
- Proposed solution
- Alternative approaches considered

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test locally in Chrome
5. Commit with clear messages
6. Push and open a Pull Request

## Code Style

### JavaScript

- Use `const` by default, `let` when reassignment is needed
- Prefer arrow functions for callbacks
- Use template literals for string interpolation
- Keep functions small and focused
- Add comments for non-obvious logic

```javascript
// Good
const formatQuery = (terms) => terms.map(t => formatTerm(t)).join(" OR ");

// Avoid
function formatQuery(terms) {
  var result = "";
  for (var i = 0; i < terms.length; i++) {
    result += formatTerm(terms[i]);
    if (i < terms.length - 1) result += " OR ";
  }
  return result;
}
```

### CSS

- Use CSS custom properties for colors and spacing
- Follow existing naming conventions
- Mobile-first isn't relevant here (popup has fixed width), but keep specificity low

### HTML

- Semantic elements where appropriate
- IDs for JavaScript hooks, classes for styling
- Keep accessibility in mind (labels, focus states)

## Testing

No automated test suite yet. Manual testing checklist:

### Query Generation

- [ ] Google: Skills only → generates strict + broad queries
- [ ] Google: Skills + locations → splits into location batches
- [ ] Google: Skills + companies → splits into company batches
- [ ] Google: Query exceeds 32 words → validation error shown
- [ ] GitHub: Single language + locations → correct implicit OR syntax
- [ ] GitHub: Multiple languages → separate query per language
- [ ] GitHub: No parentheses in output
- [ ] GitHub: Query exceeds 256 chars → validation error shown

### UI Functions

- [ ] Platform toggle shows/hides correct fields
- [ ] Copy button copies to clipboard
- [ ] Open button opens correct URL in new tab
- [ ] "Open All" prompts confirmation when >10 queries
- [ ] Form clear resets all fields

### Storage

- [ ] Save preset persists after popup close
- [ ] Load preset populates form correctly
- [ ] Delete preset removes from list
- [ ] History records each generation
- [ ] History re-run reproduces same queries
- [ ] Clear history removes all entries

## Adding a New Platform

To add support for a new search platform:

1. Add platform config in `query-generator.js`:

```javascript
const PLATFORMS = {
  // ...existing platforms
  newplatform: {
    name: "newplatform",
    displayName: "New Platform",
    maxLength: 100,
    lengthUnit: "characters",
    maxOperators: 10,
    supportsParentheses: true,
    supportsExplicitAnd: true,
    supportsExplicitOr: true,
    notSyntax: "NOT",
    baseUrl: "https://example.com/search?q=",
    fields: ["skills", "locations"]
  }
};
```

2. Add validator function:

```javascript
function validateNewPlatform(query) {
  // Platform-specific validation
  return { valid: true, message: "OK" };
}
```

3. Add generator function:

```javascript
function generateNewPlatformQueries(inputs) {
  const queries = [];
  // Build queries respecting platform constraints
  return queries;
}
```

4. Update `validate()` and `generateQueries()` to handle new platform

5. Add UI elements in `popup.html`:
   - Radio button in platform selector
   - Platform-specific input fields if needed

6. Update field visibility in `popup.js`

## Commit Messages

Follow conventional commits:

```
feat: add Stack Overflow search platform
fix: correct word count for quoted phrases
docs: update README with new features
refactor: extract validation into separate module
style: fix indentation in popup.css
```

## Pull Request Process

1. Ensure all manual tests pass
2. Update README if adding user-facing features
3. Keep PRs focused — one feature or fix per PR
4. Respond to review feedback promptly

## Release Process

Maintainers only:

1. Update version in `manifest.json`
2. Update CHANGELOG (if we add one)
3. Create git tag: `git tag v1.x.x`
4. Zip the extension folder (excluding `.git`, docs)
5. Submit to Chrome Web Store

## Questions?

Open an issue tagged `question` or reach out to maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
