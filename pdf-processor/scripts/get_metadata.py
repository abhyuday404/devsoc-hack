#!/usr/bin/env python3
"""
get_metadata.py — Extract PDF metadata using pdfplumber.

Usage:
    python3 get_metadata.py <path_to_pdf>

Outputs JSON to stdout:
{
    "pageCount": int,
    "fileSize": int,
    "firstPageText": str
}
"""

import sys
import json
import os

import pdfplumber


def get_metadata(pdf_path: str) -> dict:
    file_size = os.path.getsize(pdf_path)

    with pdfplumber.open(pdf_path) as pdf:
        page_count = len(pdf.pages)

        first_page_text = ""
        if page_count > 0:
            text = pdf.pages[0].extract_text()
            if text:
                first_page_text = text

    return {
        "pageCount": page_count,
        "fileSize": file_size,
        "firstPageText": first_page_text,
    }


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path_to_pdf>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]

    if not os.path.isfile(pdf_path):
        print(f"Error: file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    try:
        metadata = get_metadata(pdf_path)
        print(json.dumps(metadata, ensure_ascii=False))
    except Exception as e:
        print(f"Error extracting metadata: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
