import { normalize } from "./schema.js"

export const PROMPT =
  'Extract JSON {"title": string, "sections": [{"heading": string, "body": string}], "meta"?: object} from the text. Reply with JSON only.'

const FENCE = /```(?:json)?\s*([\s\S]*?)```/

export function parseJson(text) {
  text = text.trim()
  const m = FENCE.exec(text)
  if (m) text = m[1].trim()
  try {
    const val = JSON.parse(text)
    return val && typeof val === "object" && !Array.isArray(val) ? val : null
  } catch {
    return null
  }
}

export function extract(text, llm) {
  let data = parseJson(text)
  if (data == null) {
    if (!llm) throw new Error("non-JSON input needs llm")
    data = parseJson(llm(PROMPT + "\n\n" + text))
    if (data == null) throw new Error("llm did not return JSON")
  }
  return normalize(data)
}
