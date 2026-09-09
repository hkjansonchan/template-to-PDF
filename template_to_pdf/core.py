from .builder import build
from .converter import to_pdf
from .extract import extract


def render(text, template_path, pdf_path, llm=None):
    html = build(template_path, extract(text, llm))
    to_pdf(html, pdf_path)
    return pdf_path
