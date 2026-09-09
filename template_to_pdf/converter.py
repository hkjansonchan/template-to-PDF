def to_pdf(html, path):
    from weasyprint import HTML
    HTML(string=html).write_pdf(path)
