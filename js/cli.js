#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { render } from "./core.js"

function arg(name) {
  const i = process.argv.indexOf("--" + name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const input = arg("input")
const template = arg("template")
const out = arg("out")
if (!input || !template || !out) {
  console.error("usage: template-to-pdf --input FILE --template FILE --out FILE")
  process.exit(1)
}

await render(readFileSync(input, "utf8"), template, out)
