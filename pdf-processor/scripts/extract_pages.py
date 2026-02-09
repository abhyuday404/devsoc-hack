#!/usr/bin/env python3
"""
Extract text and table data from specific pages of a PDF.

Usage:
    python extract_pages.py <pdf_path> <page_numbers>

    page_numbers is a comma-separated list of 0-based page indices.
    Example: python extract_pages.py statement.pdf 0,1,4,5

Output:
    JSON to stdout with the structure:
    {
        "pages": [
            {
                "pageNum": 0,
                "text": "...",
                "tables": [
                    [["col1", "col2"], ["val1", "val2"]],
                    ...
                ]
            },
            ...
        ]
    }
"""

import json
import sys

import pdfplumber


def extract_page(page, page_num: int) -> dict:
    """Extract text and tables from a single pdfplumber page."""
    text = page.extract_text() or ""

    raw_tables = page.extract_tables() or []

    # Normalize table cells: None → empty string, strip whitespace
    tables = []
    for table in raw_tables:
        normalized = []
        for row in table:
            normalized.append([(cell or "").strip() for cell in row])
        tables.append(normalized)

    return {
        "pageNum": page_num,
        "text": text,
        "tables": tables,
    }


def main():
    if len(sys.argv) < 3:
        print(
            json.dumps({"error": "Usage: extract_pages.py <pdf_path> <page_numbers>"}),
            file=sys.stderr,
        )
        sys.exit(1)

    pdf_path = sys.argv[1]
    page_numbers_str = sys.argv[2]

    try:
        requested_pages = [int(p.strip()) for p in page_numbers_str.split(",")]
    except ValueError:
        print(
            json.dumps({"error": f"Invalid page numbers: {page_numbers_str}"}),
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            results = []

            for page_num in requested_pages:
                if page_num < 0 or page_num >= total_pages:
                    # Skip out-of-range pages but note them
                    results.append(
                        {
                            "pageNum": page_num,
                            "text": f"[Page {page_num} out of range — PDF has {total_pages} pages]",
                            "tables": [],
                        }
                    )
                    continue

                page = pdf.pages[page_num]
                results.append(extract_page(page, page_num))

        output = {"pages": results}
        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
