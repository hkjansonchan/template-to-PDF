import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from template_to_pdf.builder import build
from template_to_pdf.extract import extract
from template_to_pdf.schema import flatten, normalize

doc = normalize({"title": "Hi", "sections": [{"heading": "A", "body": "B"}], "meta": {"author": "x"}})
assert doc["title"] == "Hi"
assert doc["sections"][0] == {"heading": "A", "body": "B"}
assert doc["meta"]["author"] == "x"
assert "Hi" in flatten(doc)["title"]
assert "<h2>A</h2>" in flatten(doc)["body"]

try:
    normalize({"title": "t", "sections": "nope"})
    assert False
except TypeError:
    pass

got = extract('{"title":"T","sections":[{"heading":"H","body":"P"}]}')
assert got["title"] == "T"

got = extract('```json\n{"title":"F","sections":[]}\n```')
assert got["title"] == "F"

got = extract("loose text", llm=lambda p: json.dumps({"title": "L", "sections": []}))
assert got["title"] == "L"

try:
    extract("not json")
    assert False
except ValueError:
    pass

html = build(ROOT / "templates" / "report.html", {"title": "R", "sections": [{"heading": "S", "body": "ok"}]})
assert "<h1>R</h1>" in html
assert "<h2>S</h2>" in html

md = build(ROOT / "templates" / "report.md", {"title": "M", "sections": [{"heading": "H", "body": "x"}]})
assert "<html" in md.lower()
assert "M" in md

print("ok")
