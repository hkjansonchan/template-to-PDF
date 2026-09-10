import { normalize } from "./schema.js"

export const PROMPT =
  'Extract JSON {"title": string, "sections": [{"heading": string, "body": string}], "meta"?: object} from the text. Reply with JSON only.'

export function parseJson(text) {
  if (typeof text !== "string") return null
  text = text.trim()
  try {
    const val = JSON.parse(text)
    if (val && typeof val === "object" && !Array.isArray(val)) return val
  } catch {
    // try code fences
  }
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/g
  let m
  while ((m = fenceRegex.exec(text)) !== null) {
    try {
      const val = JSON.parse(m[1].trim())
      if (val && typeof val === "object" && !Array.isArray(val)) return val
    } catch {
      // try next block
    }
  }
  return null
}

export function extract(text, llm) {
  let data = parseJson(text)
  if (data == null) {
    if (!llm) throw new Error("non-JSON input needs llm")
    const res = llm(PROMPT + "\n\n" + text)
    if (res && typeof res.then === "function") {
      return res.then((resolved) => {
        const d = parseJson(resolved)
        if (d == null) throw new Error("llm did not return JSON")
        return normalize(d)
      })
    }
    data = parseJson(res)
    if (data == null) throw new Error("llm did not return JSON")
  }
  return normalize(data)
}
