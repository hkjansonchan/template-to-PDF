import json
import re

from .schema import normalize

PROMPT = 'Extract JSON {"title": string, "sections": [{"heading": string, "body": string}], "meta"?: object} from the text. Reply with JSON only.'

_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```")


def _parse_json(text):
    text = text.strip()
    m = _FENCE.search(text)
    if m:
        text = m.group(1).strip()
    try:
        val = json.loads(text)
    except json.JSONDecodeError:
        return None
    return val if isinstance(val, dict) else None


def extract(text, llm=None):
    data = _parse_json(text)
    if data is None:
        if llm is None:
            raise ValueError("non-JSON input needs llm")
        data = _parse_json(llm(PROMPT + "\n\n" + text))
        if data is None:
            raise ValueError("llm did not return JSON")
    return normalize(data)
