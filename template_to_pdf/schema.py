def normalize(data):
    if not isinstance(data, dict):
        raise TypeError("expected object")
    title = data.get("title")
    if title is None:
        title = ""
    elif not isinstance(title, str):
        title = str(title)
    raw = data.get("sections", [])
    if not isinstance(raw, list):
        raise TypeError("sections must be a list")
    sections = []
    for item in raw:
        if not isinstance(item, dict):
            raise TypeError("section must be an object")
        heading = item.get("heading")
        body = item.get("body")
        sections.append({
            "heading": "" if heading is None else str(heading),
            "body": "" if body is None else str(body),
        })
    meta = data.get("meta") or {}
    if not isinstance(meta, dict):
        raise TypeError("meta must be an object")
    return {"title": title, "sections": sections, "meta": {str(k): "" if v is None else str(v) for k, v in meta.items()}}


def flatten(doc):
    doc = normalize(doc)
    vars_ = {"title": doc["title"]}
    chunks = [f"<h2>{s['heading']}</h2>\n<p>{s['body']}</p>" for s in doc["sections"]]
    vars_["body"] = "\n".join(chunks)
    for k, v in doc["meta"].items():
        vars_.setdefault(k, v)
    return vars_
