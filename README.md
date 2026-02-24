# markup-to-x-articles

Convert markdown articles from GitHub into X Article format for copy-pasting into the browser.

Fetches articles from [ProfessorSeb/maniak-io/content/articles](https://github.com/ProfessorSeb/maniak-io/tree/main/content/articles) and converts them to clean, paste-ready text for X's long-form article editor.

## Setup

```bash
npm install
```

## Usage

### Interactive mode (select from list)

```bash
npm start
```

### Convert a specific article

```bash
npm start -- "2026-02-21-multi-agent-architecture"
```

Partial name matching works — just provide enough of the filename to be unique.

### List all available articles

```bash
npm run list
```

### Output to stdout instead of file

```bash
npm start -- --stdout
npm start -- "kill-switch" --stdout
```

## How it works

1. Fetches the article list from the GitHub API
2. Downloads the raw markdown for the selected article(s)
3. Strips YAML frontmatter and extracts metadata (title, author, date)
4. Converts markdown formatting to clean text suitable for X Articles:
   - Headings become uppercase section headers
   - Code blocks become indented text with language labels
   - Tables become aligned plain text
   - Links become `text (url)` format
   - Images and mermaid diagrams are removed (add via X's editor)
5. Saves to `output/<article-name>.txt` (or prints to stdout)

## Output

Converted articles are saved to the `output/` directory as `.txt` files. Open the file, select all, copy, and paste into X's article composer.

X Articles support up to 25,000 characters. The tool warns if an article exceeds this limit.
