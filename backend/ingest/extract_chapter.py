"""Turn a chapter PDF (with a clean text layer) into a human-readable JSON file.

Usage:
    python backend/ingest/extract_chapter.py data/life-processes.pdf data/life_processes.json

No AI is used here. The output keeps the exact NCERT wording, split by section
heading, with page references. Later agents read this file, never the PDF.
"""
import json
import re
import sys

import fitz  # PyMuPDF

# Section numbers and titles of NCERT Class 10 Science, Chapter 5 (Life Processes).
# The PDF breaks the big headings into fragments ("WHA" + "T ARE ..."), so the
# titles are listed here and located in the text by their section number.
SECTIONS = [
    ("5.1", "What are Life Processes?"),
    ("5.2", "Nutrition"),
    ("5.2.1", "Autotrophic Nutrition"),
    ("5.2.2", "Heterotrophic Nutrition"),
    ("5.2.3", "How do Organisms obtain their Nutrition?"),
    ("5.2.4", "Nutrition in Human Beings"),
    ("5.3", "Respiration"),
    ("5.4", "Transportation"),
    ("5.4.1", "Transportation in Human Beings"),
    ("5.4.2", "Transportation in Plants"),
    ("5.5", "Excretion"),
    ("5.5.1", "Excretion in Human Beings"),
    ("5.5.2", "Excretion in Plants"),
]
SECTION_IDS = {s for s, _ in SECTIONS}

NOISE = re.compile(r"^(Life Processes|Science|Reprint 2026-27|\d{1,3}|5\.|CHAPTER)$")


def read_lines(pdf_path):
    """Return (pdf_page, printed_page, line) tuples with repeats and page furniture removed."""
    doc = fitz.open(pdf_path)
    out = []
    offset = next((int(l) - (i + 1) for i, pg in enumerate(doc) for l in [x.strip() for x in pg.get_text().splitlines()[:4]]
                   if l.isdigit() and int(l) > 10), None)
    for i, page in enumerate(doc):
        raw = [l.strip() for l in page.get_text().splitlines()]
        # the first page shows the chapter number, not a page number; use the offset instead
        found = next((int(l) for l in raw[:4] if l.isdigit() and int(l) > 10), None)
        if found and offset is None:
            offset = found - (i + 1)
        printed = (i + 1 + offset) if offset is not None else None
        prev = None
        for line in raw:
            if not line or line == prev:  # bold text is drawn several times
                continue
            prev = line
            if NOISE.match(line):
                continue
            out.append((i + 1, printed, line))
    return out


def merge_bullets(lines):
    """The bullet glyph arrives as a lone 'n'; turn it into '- ' on the next line."""
    merged, bullet = [], False
    for pg, pr, line in lines:
        if line == "n":
            bullet = True
            continue
        merged.append((pg, pr, ("- " + line) if bullet else line))
        bullet = False
    return merged


def to_paragraphs(lines):
    """Join wrapped lines into readable paragraphs."""
    paras, cur = [], ""
    for line in lines:
        if line.startswith("- ") or re.match(r"^(Activity|Figure|Table)\s", line):
            if cur:
                paras.append(cur)
            cur = line
            continue
        if cur and cur.endswith((".", "?", "!", ":")) and line[:1].isupper():
            paras.append(cur)
            cur = line
        else:
            cur = (cur + " " + line).strip() if cur else line
    if cur:
        paras.append(cur)
    return paras


def build(pdf_path):
    lines = merge_bullets(read_lines(pdf_path))

    # find where each section starts: the first line that begins with its number
    starts = {}
    for idx, (_, _, line) in enumerate(lines):
        sid = line.split(" ", 1)[0]
        if sid in SECTION_IDS and sid not in starts:
            starts[sid] = idx
    # "What you have learnt" ends the teaching text
    end_idx = next((i for i, (_, _, l) in enumerate(lines) if l.lower() == "what you have learnt"), len(lines))

    order = [s for s, _ in SECTIONS if s in starts]
    order.sort(key=lambda s: starts[s])
    titles = dict(SECTIONS)

    sections = []
    for n, sid in enumerate(order):
        a = starts[sid] + 1
        b = starts[order[n + 1]] if n + 1 < len(order) else end_idx
        body = lines[a:b]
        # drop leftover heading fragments such as "WHA" / "T ARE LIFE PROCESSES?"
        while body and (body[0][2].split(" ", 1)[0] in SECTION_IDS or body[0][2].isupper()
                        or body[0][2] == titles[sid] or len(body[0][2]) < 4):
            body = body[1:]
        pages = [p for _, p, _ in body if p]
        text_lines = [l for _, _, l in body]
        sections.append({
            "id": sid,
            "title": titles[sid],
            "printed_pages": [min(pages), max(pages)] if pages else None,
            "paragraphs": to_paragraphs(text_lines),
        })

    tail = [l for _, _, l in lines[end_idx:]]
    return {
        "book": "NCERT Class 10 Science",
        "chapter": {"number": 5, "title": "Life Processes"},
        "source_pdf": pdf_path.replace("\\", "/"),
        "sections": sections,
        "end_of_chapter_text": to_paragraphs(tail),
    }


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    data = build(src)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    for s in data["sections"]:
        print(s["id"], s["title"], s["printed_pages"], len(s["paragraphs"]), "paragraphs")
    print("end-of-chapter paragraphs:", len(data["end_of_chapter_text"]))
