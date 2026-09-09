import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { build } from "../js/builder.js"
import { extract } from "../js/extract.js"
import { flatten, normalize } from "../js/schema.js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const doc = normalize({ title: "Hi", sections: [{ heading: "A", body: "B" }], meta: { author: "x" } })
assert.equal(doc.title, "Hi")
assert.deepEqual(doc.sections[0], { heading: "A", body: "B" })
assert.equal(doc.meta.author, "x")
assert.equal(flatten(doc).title, "Hi")
assert.match(flatten(doc).body, /<h2>A<\/h2>/)

assert.throws(() => normalize({ title: "t", sections: "nope" }), TypeError)

assert.equal(extract('{"title":"T","sections":[{"heading":"H","body":"P"}]}').title, "T")
assert.equal(extract('```json\n{"title":"F","sections":[]}\n```').title, "F")
assert.equal(extract("loose text", () => JSON.stringify({ title: "L", sections: [] })).title, "L")
assert.throws(() => extract("not json"), /non-JSON/)

const html = build(join(ROOT, "templates", "report.html"), { title: "R", sections: [{ heading: "S", body: "ok" }] })
assert.match(html, /<h1>R<\/h1>/)
assert.match(html, /<h2>S<\/h2>/)

const md = build(join(ROOT, "templates", "report.md"), { title: "M", sections: [{ heading: "H", body: "x" }] })
assert.match(md.toLowerCase(), /<html/)
assert.match(md, /M/)

console.log("ok")
