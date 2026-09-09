import re
from pathlib import Path

import markdown

from .schema import flatten

_VAR = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def fill(template, vars_):
    return _VAR.sub(lambda m: vars_.get(m.group(1), ""), template)


def build(template_path, doc):
    path = Path(template_path)
    vars_ = flatten(doc)
    html = fill(path.read_text(encoding="utf-8"), vars_)
    if path.suffix.lower() in {".md", ".markdown"}:
        html = markdown.markdown(html)
    if "<html" not in html.lower():
        html = (
            "<!doctype html><html><head><meta charset=\"utf-8\">"
            f"<title>{vars_['title']}</title></head><body>{html}</body></html>"
        )
    return html
