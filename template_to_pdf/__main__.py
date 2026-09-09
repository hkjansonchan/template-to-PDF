import argparse
from pathlib import Path

from .core import render


def main():
    p = argparse.ArgumentParser(prog="template-to-pdf")
    p.add_argument("--input", required=True)
    p.add_argument("--template", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()
    text = Path(args.input).read_text(encoding="utf-8")
    render(text, args.template, args.out)


if __name__ == "__main__":
    main()
