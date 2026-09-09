# template-to-PDF

AI text → JSON schema → fill `{{var}}` template → HTML → PDF.

## Flow

1. `extract` — parse JSON, or ask `llm(prompt)` and parse
2. `normalize` — enforce `{title, sections:[{heading,body}], meta?}`
3. `build` — flatten to `{{title}}` `{{body}}` + meta keys, replace, Markdown→HTML if `.md`
4. `to_pdf` — WeasyPrint (Python) / Puppeteer (JS)

## Layout

| Python | JS |
|---|---|
| `template_to_pdf/schema.py` | `js/schema.js` |
| `template_to_pdf/extract.py` | `js/extract.js` |
| `template_to_pdf/builder.py` | `js/builder.js` |
| `template_to_pdf/converter.py` | `js/converter.js` |
| `template_to_pdf/core.py` | `js/core.js` |
| `template_to_pdf/__main__.py` | `js/cli.js` |

Templates: `templates/report.md`, `templates/report.html`

## API

```python
from template_to_pdf import render
render(ai_text, "templates/report.html", "out.pdf", llm=None)
```

```js
import { render } from "template-to-pdf"
await render(aiText, "templates/report.html", "out.pdf", { llm })
```

CLI: `template-to-pdf --input data.json --template templates/report.html --out out.pdf`

LLM is optional. Non-JSON input requires `llm` callable returning JSON.
