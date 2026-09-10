import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { normalize, flatten } from "../js/schema.js"
import { extract, parseJson, PROMPT } from "../js/extract.js"
import { fill, build } from "../js/builder.js"
import { render } from "../js/core.js"
import { toPdf } from "../js/converter.js"

const execFileAsync = promisify(execFile)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

test("Schema Suite", async (t) => {
  await t.test("normalize valid document", () => {
    const doc = normalize({
      title: "Report",
      sections: [{ heading: "Intro", body: "Hello" }],
      meta: { author: "Alice", version: 1 },
    })
    assert.equal(doc.title, "Report")
    assert.equal(doc.sections.length, 1)
    assert.deepEqual(doc.sections[0], { heading: "Intro", body: "Hello" })
    assert.equal(doc.meta.author, "Alice")
    assert.equal(doc.meta.version, "1")
  })

  await t.test("normalize defaults on empty object", () => {
    const doc = normalize({})
    assert.equal(doc.title, "")
    assert.deepEqual(doc.sections, [])
    assert.deepEqual(doc.meta, {})
  })

  await t.test("normalize null fields safely", () => {
    const doc = normalize({ title: null, sections: null, meta: null })
    assert.equal(doc.title, "")
    assert.deepEqual(doc.sections, [])
    assert.deepEqual(doc.meta, {})
  })

  await t.test("normalize type coercion", () => {
    const doc = normalize({
      title: 12345,
      sections: [{ heading: 42, body: true }, { heading: null, body: null }],
      meta: { 100: false },
    })
    assert.equal(doc.title, "12345")
    assert.equal(doc.sections[0].heading, "42")
    assert.equal(doc.sections[0].body, "true")
    assert.equal(doc.sections[1].heading, "")
    assert.equal(doc.sections[1].body, "")
    assert.equal(doc.meta["100"], "false")
  })

  await t.test("normalize rejects non-object root", () => {
    for (const bad of [null, undefined, 123, "string", [1, 2]]) {
      assert.throws(() => normalize(bad), { name: "TypeError", message: "expected object" })
    }
  })

  await t.test("normalize rejects invalid sections", () => {
    assert.throws(() => normalize({ sections: "not-a-list" }), { name: "TypeError" })
    assert.throws(() => normalize({ sections: ["not-an-object"] }), { name: "TypeError" })
  })

  await t.test("normalize rejects invalid meta", () => {
    assert.throws(() => normalize({ meta: "not-an-object" }), { name: "TypeError" })
    assert.throws(() => normalize({ meta: [1, 2] }), { name: "TypeError" })
  })

  await t.test("flatten sections and meta", () => {
    const vars = flatten({
      title: "Title",
      sections: [
        { heading: "H1", body: "B1" },
        { heading: "H2", body: "B2" },
      ],
      meta: { author: "Bob", date: "2026-09-10" },
    })
    assert.equal(vars.title, "Title")
    assert.match(vars.body, /<h2>H1<\/h2>\n<p>B1<\/p>/)
    assert.match(vars.body, /<h2>H2<\/h2>\n<p>B2<\/p>/)
    assert.equal(vars.author, "Bob")
    assert.equal(vars.date, "2026-09-10")
  })

  await t.test("flatten with zero sections", () => {
    const vars = flatten({ title: "Empty" })
    assert.equal(vars.title, "Empty")
    assert.equal(vars.body, "")
  })

  await t.test("flatten conflict protection", () => {
    const vars = flatten({
      title: "Original Title",
      sections: [{ heading: "H", body: "B" }],
      meta: { title: "Overwritten Title", body: "Overwritten Body", custom: "Keep" },
    })
    assert.equal(vars.title, "Original Title")
    assert.match(vars.body, /<h2>H<\/h2>\n<p>B<\/p>/)
    assert.equal(vars.custom, "Keep")
  })

  await t.test("unicode and special characters", () => {
    const doc = normalize({
      title: "报告 Title 🎉",
      sections: [{ heading: "第 1 节", body: "内容 with <tags> & 'quotes'" }],
      meta: { emoji: "🚀" },
    })
    const vars = flatten(doc)
    assert.equal(vars.title, "报告 Title 🎉")
    assert.match(vars.body, /第 1 节/)
    assert.equal(vars.emoji, "🚀")
  })
})

test("Extract Suite", async (t) => {
  await t.test("parseJson direct string", () => {
    const val = parseJson('{"title": "Clean"}')
    assert.deepEqual(val, { title: "Clean" })
  })

  await t.test("parseJson fenced markdown", () => {
    const val = parseJson('```json\n{"title": "Fenced"}\n```')
    assert.deepEqual(val, { title: "Fenced" })
  })

  await t.test("parseJson fenced untagged", () => {
    const val = parseJson('```\n{"title": "Untagged"}\n```')
    assert.deepEqual(val, { title: "Untagged" })
  })

  await t.test("parseJson multiple fences picks valid json", () => {
    const text = "Note:\n```python\nprint(1)\n```\nResult:\n```json\n{\"title\": \"Second\"}\n```"
    const val = parseJson(text)
    assert.deepEqual(val, { title: "Second" })
  })

  await t.test("parseJson invalid inputs return null", () => {
    assert.equal(parseJson(null), null)
    assert.equal(parseJson(12345), null)
    assert.equal(parseJson(""), null)
    assert.equal(parseJson("   "), null)
    assert.equal(parseJson("not json"), null)
    assert.equal(parseJson("[1, 2, 3]"), null)
    assert.equal(parseJson('"string only"'), null)
  })

  await t.test("extract direct JSON without LLM", () => {
    const doc = extract('{"title": "Direct", "sections": []}')
    assert.equal(doc.title, "Direct")
  })

  await t.test("extract plain text without LLM throws", () => {
    assert.throws(() => extract("plain notes without json"), { message: /non-JSON/ })
  })

  await t.test("extract with sync LLM", () => {
    let calledPrompt = ""
    const doc = extract("raw text", (p) => {
      calledPrompt = p
      return '{"title": "Sync LLM", "sections": [{"heading": "A", "body": "B"}]}'
    })
    assert.equal(doc.title, "Sync LLM")
    assert.equal(doc.sections[0].heading, "A")
    assert.ok(calledPrompt.startsWith(PROMPT))
    assert.ok(calledPrompt.includes("raw text"))
  })

  await t.test("extract with async LLM", async () => {
    const promise = extract("raw text", async (p) => {
      await new Promise((r) => setTimeout(r, 10))
      return '```json\n{"title": "Async LLM", "sections": []}\n```'
    })
    assert.ok(promise instanceof Promise)
    const doc = await promise
    assert.equal(doc.title, "Async LLM")
  })

  await t.test("extract with LLM returning invalid JSON throws", () => {
    assert.throws(() => extract("raw text", () => "invalid response"), { message: /did not return JSON/ })
  })
})

test("Builder Suite", async (t) => {
  await t.test("fill variables", () => {
    const tmpl = "Hello {{name}}, welcome to {{ place }}! Missing: {{unknown}}"
    const res = fill(tmpl, { name: "World", place: "Earth" })
    assert.equal(res, "Hello World, welcome to Earth! Missing: ")
  })

  await t.test("fill is single-pass", () => {
    const tmpl = "{{var}}"
    const res = fill(tmpl, { var: "{{recursive}}" })
    assert.equal(res, "{{recursive}}")
  })

  await t.test("build HTML full document", () => {
    const tmp = mkdtempSync(join(tmpdir(), "t2p-"))
    const tmplPath = join(tmp, "full.html")
    writeFileSync(tmplPath, "<!doctype html><html><head><title>{{title}}</title></head><body><h1>{{title}}</h1>{{body}}</body></html>")
    try {
      const html = build(tmplPath, { title: "Full", sections: [{ heading: "H", body: "B" }] })
      assert.equal((html.match(/<!doctype html>/gi) || []).length, 1)
      assert.match(html, /<h1>Full<\/h1>/)
      assert.match(html, /<h2>H<\/h2>/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  await t.test("build HTML fragment wraps in html5", () => {
    const tmp = mkdtempSync(join(tmpdir(), "t2p-"))
    const tmplPath = join(tmp, "frag.html")
    writeFileSync(tmplPath, "<h1>{{title}}</h1><div>{{body}}</div>")
    try {
      const html = build(tmplPath, { title: "Frag", sections: [] })
      assert.match(html.toLowerCase(), /<!doctype html>/)
      assert.match(html, /<title>Frag<\/title>/)
      assert.match(html, /<h1>Frag<\/h1>/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  await t.test("build Markdown converts and wraps in html5", () => {
    const tmp = mkdtempSync(join(tmpdir(), "t2p-"))
    const tmplPath = join(tmp, "doc.md")
    writeFileSync(tmplPath, "# {{title}}\n\n**Bold note**\n\n{{body}}")
    try {
      const html = build(tmplPath, { title: "MD Doc", sections: [{ heading: "Sec1", body: "Text1" }] })
      assert.match(html.toLowerCase(), /<!doctype html>/)
      assert.match(html, /<h1>MD Doc<\/h1>/)
      assert.match(html, /<strong>Bold note<\/strong>/)
      assert.match(html, /<h2>Sec1<\/h2>/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  await t.test("build non-existent template throws", () => {
    assert.throws(() => build("non_existent.html", { title: "T" }), { code: "ENOENT" })
  })
})

test("Core & CLI Suite", async (t) => {
  await t.test("render pipeline with async LLM and mocked PDF", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "t2p-"))
    const tmplPath = join(tmp, "t.html")
    const pdfPath = join(tmp, "out.pdf")
    writeFileSync(tmplPath, "<h1>{{title}}</h1>{{body}}")

    try {
      const out = await render(
        "raw text",
        tmplPath,
        pdfPath,
        async () => '{"title": "Core Render", "sections": [{"heading": "H", "body": "B"}]}'
      )
      assert.equal(out, pdfPath)
      assert.ok(existsSync(pdfPath))
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  await t.test("CLI execution success", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "t2p-"))
    const inputPath = join(tmp, "in.json")
    const tmplPath = join(tmp, "t.html")
    const pdfPath = join(tmp, "cli-out.pdf")

    writeFileSync(inputPath, JSON.stringify({ title: "CLI", sections: [] }))
    writeFileSync(tmplPath, "<h1>{{title}}</h1>")

    try {
      const { stdout } = await execFileAsync("node", [
        join(ROOT, "js", "cli.js"),
        "--input",
        inputPath,
        "--template",
        tmplPath,
        "--out",
        pdfPath,
      ])
      assert.ok(existsSync(pdfPath))
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  await t.test("CLI missing arguments fails", async () => {
    await assert.rejects(
      async () => {
        await execFileAsync("node", [join(ROOT, "js", "cli.js")])
      },
      (err) => {
        assert.equal(err.code, 1)
        assert.match(err.stderr, /usage: template-to-pdf/)
        return true
      }
    )
  })
})
