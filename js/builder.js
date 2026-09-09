import { readFileSync } from "node:fs"
import { extname } from "node:path"
import { marked } from "marked"
import { flatten } from "./schema.js"

const VAR = /\{\{\s*(\w+)\s*\}\}/g

export function fill(template, vars) {
  return template.replace(VAR, (_, k) => vars[k] ?? "")
}

export function build(templatePath, doc) {
  const vars = flatten(doc)
  let html = fill(readFileSync(templatePath, "utf8"), vars)
  const ext = extname(templatePath).toLowerCase()
  if (ext === ".md" || ext === ".markdown") html = marked.parse(html)
  if (!html.toLowerCase().includes("<html")) {
    html = `<!doctype html><html><head><meta charset="utf-8"><title>${vars.title}</title></head><body>${html}</body></html>`
  }
  return html
}
