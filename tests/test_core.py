import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from template_to_pdf.builder import build, fill
from template_to_pdf.core import render
from template_to_pdf.extract import PROMPT, _parse_json, extract
from template_to_pdf.schema import flatten, normalize


class TestSchema(unittest.TestCase):
    def test_normalize_valid(self):
        doc = normalize({
            "title": "Report",
            "sections": [{"heading": "Intro", "body": "Hello"}],
            "meta": {"author": "Alice", "version": 1},
        })
        self.assertEqual(doc["title"], "Report")
        self.assertEqual(len(doc["sections"]), 1)
        self.assertEqual(doc["sections"][0], {"heading": "Intro", "body": "Hello"})
        self.assertEqual(doc["meta"]["author"], "Alice")
        self.assertEqual(doc["meta"]["version"], "1")

    def test_normalize_defaults(self):
        doc = normalize({})
        self.assertEqual(doc["title"], "")
        self.assertEqual(doc["sections"], [])
        self.assertEqual(doc["meta"], {})

    def test_normalize_none_fields(self):
        doc = normalize({"title": None, "sections": None, "meta": None})
        self.assertEqual(doc["title"], "")
        self.assertEqual(doc["sections"], [])
        self.assertEqual(doc["meta"], {})

    def test_normalize_coercion(self):
        doc = normalize({
            "title": 12345,
            "sections": [{"heading": 42, "body": True}, {"heading": None, "body": None}],
            "meta": {100: False},
        })
        self.assertEqual(doc["title"], "12345")
        self.assertEqual(doc["sections"][0], {"heading": "42", "body": "True"})
        self.assertEqual(doc["sections"][1], {"heading": "", "body": ""})
        self.assertEqual(doc["meta"]["100"], "False")

    def test_normalize_invalid_root_type(self):
        for bad in [None, 123, "string", [1, 2, 3]]:
            with self.subTest(bad=bad):
                with self.assertRaises(TypeError):
                    normalize(bad)

    def test_normalize_invalid_sections(self):
        with self.assertRaises(TypeError):
            normalize({"sections": "not-a-list"})
        with self.assertRaises(TypeError):
            normalize({"sections": ["not-a-dict"]})

    def test_normalize_invalid_meta(self):
        with self.assertRaises(TypeError):
            normalize({"meta": "not-a-dict"})
        with self.assertRaises(TypeError):
            normalize({"meta": [1, 2]})

    def test_flatten_happy_path(self):
        doc = {
            "title": "Title",
            "sections": [
                {"heading": "H1", "body": "B1"},
                {"heading": "H2", "body": "B2"},
            ],
            "meta": {"author": "Bob", "date": "2026-09-10"},
        }
        vars_ = flatten(doc)
        self.assertEqual(vars_["title"], "Title")
        self.assertIn("<h2>H1</h2>\n<p>B1</p>", vars_["body"])
        self.assertIn("<h2>H2</h2>\n<p>B2</p>", vars_["body"])
        self.assertEqual(vars_["author"], "Bob")
        self.assertEqual(vars_["date"], "2026-09-10")

    def test_flatten_no_sections(self):
        vars_ = flatten({"title": "Empty"})
        self.assertEqual(vars_["title"], "Empty")
        self.assertEqual(vars_["body"], "")

    def test_flatten_conflict_protection(self):
        vars_ = flatten({
            "title": "Original Title",
            "sections": [{"heading": "H", "body": "B"}],
            "meta": {"title": "Overwritten Title", "body": "Overwritten Body", "custom": "Keep"},
        })
        self.assertEqual(vars_["title"], "Original Title")
        self.assertIn("<h2>H</h2>\n<p>B</p>", vars_["body"])
        self.assertEqual(vars_["custom"], "Keep")

    def test_unicode_and_special_chars(self):
        data = {
            "title": "报告 Title 🎉",
            "sections": [{"heading": "第 1 节", "body": "内容 with <tags> & 'quotes'"}],
            "meta": {"emoji": "🚀"},
        }
        doc = normalize(data)
        vars_ = flatten(doc)
        self.assertEqual(vars_["title"], "报告 Title 🎉")
        self.assertIn("第 1 节", vars_["body"])
        self.assertEqual(vars_["emoji"], "🚀")


class TestExtract(unittest.TestCase):
    def test_parse_json_direct(self):
        val = _parse_json('{"title": "Clean"}')
        self.assertEqual(val, {"title": "Clean"})

    def test_parse_json_fenced(self):
        val = _parse_json('```json\n{"title": "Fenced"}\n```')
        self.assertEqual(val, {"title": "Fenced"})

    def test_parse_json_fenced_untagged(self):
        val = _parse_json('```\n{"title": "Untagged"}\n```')
        self.assertEqual(val, {"title": "Untagged"})

    def test_parse_json_multiple_fences(self):
        text = "Here is an example:\n```python\nprint(1)\n```\nHere is JSON:\n```json\n{\"title\": \"Second\"}\n```"
        val = _parse_json(text)
        self.assertEqual(val, {"title": "Second"})

    def test_parse_json_invalid(self):
        self.assertIsNone(_parse_json(None))
        self.assertIsNone(_parse_json(12345))
        self.assertIsNone(_parse_json(""))
        self.assertIsNone(_parse_json("   "))
        self.assertIsNone(_parse_json("not valid json"))
        self.assertIsNone(_parse_json("[1, 2, 3]"))
        self.assertIsNone(_parse_json('"just a string"'))

    def test_extract_direct_json(self):
        doc = extract('{"title": "T", "sections": []}')
        self.assertEqual(doc["title"], "T")

    def test_extract_no_llm_fails_on_plain_text(self):
        with self.assertRaises(ValueError):
            extract("raw text without json")

    def test_extract_sync_llm(self):
        called_prompt = []

        def mock_llm(p):
            called_prompt.append(p)
            return '{"title": "From LLM", "sections": [{"heading": "A", "body": "B"}]}'

        doc = extract("my raw notes", llm=mock_llm)
        self.assertEqual(doc["title"], "From LLM")
        self.assertEqual(doc["sections"][0]["heading"], "A")
        self.assertTrue(called_prompt[0].startswith(PROMPT))
        self.assertIn("my raw notes", called_prompt[0])

    def test_extract_llm_returns_fenced(self):
        doc = extract("notes", llm=lambda p: '```json\n{"title": "Fenced LLM"}\n```')
        self.assertEqual(doc["title"], "Fenced LLM")

    def test_extract_llm_invalid_json(self):
        with self.assertRaises(ValueError):
            extract("notes", llm=lambda p: "sorry I cannot generate JSON")


class TestBuilder(unittest.TestCase):
    def test_fill_variables(self):
        tmpl = "Hello {{name}}, welcome to {{ place }}! Missing: {{unknown}}"
        res = fill(tmpl, {"name": "World", "place": "Earth"})
        self.assertEqual(res, "Hello World, welcome to Earth! Missing: ")

    def test_fill_single_pass(self):
        tmpl = "{{var}}"
        res = fill(tmpl, {"var": "{{recursive}}"})
        self.assertEqual(res, "{{recursive}}")

    def test_build_html_full_template(self):
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
            f.write("<!doctype html><html><head><title>{{title}}</title></head><body><h1>{{title}}</h1>{{body}}</body></html>")
            path = f.name
        try:
            html = build(path, {"title": "Doc", "sections": [{"heading": "H", "body": "B"}]})
            self.assertEqual(html.count("<!doctype html>"), 1)
            self.assertIn("<h1>Doc</h1>", html)
            self.assertIn("<h2>H</h2>", html)
        finally:
            os.remove(path)

    def test_build_html_fragment(self):
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
            f.write("<h1>{{title}}</h1><div>{{body}}</div>")
            path = f.name
        try:
            html = build(path, {"title": "Fragment", "sections": []})
            self.assertIn("<!doctype html>", html.lower())
            self.assertIn("<title>Fragment</title>", html)
            self.assertIn("<h1>Fragment</h1>", html)
        finally:
            os.remove(path)

    def test_build_markdown_template(self):
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
            f.write("# {{title}}\n\n**Bold note**\n\n{{body}}")
            path = f.name
        try:
            html = build(path, {"title": "MD Doc", "sections": [{"heading": "Sec1", "body": "Text1"}]})
            self.assertIn("<!doctype html>", html.lower())
            self.assertIn("<h1>MD Doc</h1>", html)
            self.assertIn("<strong>Bold note</strong>", html)
            self.assertIn("<h2>Sec1</h2>", html)
        finally:
            os.remove(path)

    def test_build_missing_template(self):
        with self.assertRaises(FileNotFoundError):
            build("non_existent_template.html", {"title": "T"})


class TestCore(unittest.TestCase):
    @patch("template_to_pdf.core.to_pdf")
    def test_render_pipeline(self, mock_to_pdf):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpl_path = Path(tmpdir) / "test.html"
            tmpl_path.write_text("<h1>{{title}}</h1>{{body}}", encoding="utf-8")
            pdf_path = Path(tmpdir) / "output.pdf"

            out = render('{"title": "Core", "sections": [{"heading": "H", "body": "B"}]}', str(tmpl_path), str(pdf_path))
            self.assertEqual(out, str(pdf_path))
            mock_to_pdf.assert_called_once()
            called_html, called_path = mock_to_pdf.call_args[0]
            self.assertIn("<h1>Core</h1>", called_html)
            self.assertEqual(called_path, str(pdf_path))


class TestCLI(unittest.TestCase):
    def test_cli_success(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_file = Path(tmpdir) / "input.json"
            input_file.write_text(json.dumps({"title": "CLI Test", "sections": []}), encoding="utf-8")
            tmpl_file = Path(tmpdir) / "tmpl.html"
            tmpl_file.write_text("<h1>{{title}}</h1>", encoding="utf-8")
            out_file = Path(tmpdir) / "out.pdf"

            with patch("template_to_pdf.core.to_pdf") as mock_to_pdf:
                from template_to_pdf.__main__ import main
                with patch.object(sys, "argv", ["template-to-pdf", "--input", str(input_file), "--template", str(tmpl_file), "--out", str(out_file)]):
                    main()
                mock_to_pdf.assert_called_once()

    def test_cli_missing_args(self):
        with patch.object(sys, "argv", ["template-to-pdf"]):
            with self.assertRaises(SystemExit) as cm:
                from template_to_pdf.__main__ import main
                main()
            self.assertNotEqual(cm.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
