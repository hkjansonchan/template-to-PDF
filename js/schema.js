export function normalize(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("expected object")
  }
  let title = data.title
  if (title == null) title = ""
  else if (typeof title !== "string") title = String(title)
  let raw = data.sections
  if (raw == null) raw = []
  else if (!Array.isArray(raw)) throw new TypeError("sections must be a list")
  const sections = raw.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError("section must be an object")
    }
    return {
      heading: item.heading == null ? "" : String(item.heading),
      body: item.body == null ? "" : String(item.body),
    }
  })
  let meta = data.meta
  if (meta == null) meta = {}
  else if (typeof meta !== "object" || Array.isArray(meta)) {
    throw new TypeError("meta must be an object")
  }
  const outMeta = Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [String(k), v == null ? "" : String(v)]),
  )
  return { title, sections, meta: outMeta }
}

export function flatten(doc) {
  doc = normalize(doc)
  const vars = { title: doc.title }
  vars.body = doc.sections.map((s) => `<h2>${s.heading}</h2>\n<p>${s.body}</p>`).join("\n")
  for (const [k, v] of Object.entries(doc.meta)) {
    if (!Object.prototype.hasOwnProperty.call(vars, k)) vars[k] = v
  }
  return vars
}
