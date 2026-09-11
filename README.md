# template-to-PDF

Fill a Markdown/HTML template with `{{vars}}`, then write HTML → PDF.

AI output can be JSON already, or free text passed through an `llm` callable.

## Install

```bash
git clone https://github.com/hkjansonchan/template-to-PDF.git
cd template-to-PDF
pip install -e .
npm install
```

Python needs WeasyPrint. JS PDF uses Puppeteer (downloads Chromium).

## Schema

```json
{
  "title": "string",
  "sections": [{ "heading": "string", "body": "string" }],
  "meta": { "anyKey": "string" }
}
```

Flattened into template vars: `{{title}}`, `{{body}}` (sections as `<h2>`/`<p>`), plus each `meta` key.

Unknown `{{vars}}` become empty.

## CLI

Input must be JSON (or fenced ` ```json `). Free text needs the library + `llm`.

```bash
python -m template_to_pdf --input data.json --template templates/report.html --out out.pdf
node js/cli.js --input data.json --template templates/report.html --out out.pdf
```

`.md` templates are converted to HTML first.

## Python

```python
from template_to_pdf import render, extract, build, to_pdf

render(open("data.json", encoding="utf-8").read(), "templates/report.html", "out.pdf")

doc = extract(raw_text, llm=lambda prompt: call_your_model(prompt))
html = build("templates/report.md", doc)
to_pdf(html, "out.pdf")
```

## JavaScript

```js
import { render, extract, build, toPdf } from "template-to-pdf"

await render(jsonText, "templates/report.html", "out.pdf")

const doc = extract(rawText, (prompt) => callYourModel(prompt))
const html = build("templates/report.md", doc)
await toPdf(html, "out.pdf")
```

`llm` must return JSON matching the schema (sync string).

## Tests

```bash
python tests/test_core.py
npm test
```

## Contributing

```bash
# Clone the repository to your local machine
git clone https://github.com/hkjansonchan/template-to-PDF.git

# Make changes

# Create and switch to a new branch (or skip this if using an existing branch)
git branch your-branch-name

# Commit your changes with a descriptive message
git commit -m ""

# Push your branch to GitHub
git push -u origin your-branch-name
