import { build } from "./builder.js"
import { toPdf } from "./converter.js"
import { extract } from "./extract.js"

export async function render(text, templatePath, pdfPath, llm) {
  const html = build(templatePath, await extract(text, llm))
  await toPdf(html, pdfPath)
  return pdfPath
}
