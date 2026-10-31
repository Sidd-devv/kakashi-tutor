"""Ingestion agent: extracted NCERT chapter -> concept graph. Runs offline, once; a human reviews the result.

    python -m backend.agents.ingestion
"""
import json

from .. import config, content
from ..llm import call_json
from ..registry import team_brief
from ..schemas import Concept, ConceptGraph, Fact, Misconception
from ..text_utils import quote_in, slug

SYSTEM = team_brief("ingestion") + """

How to build the graph:
- Make 22 to 28 concepts for the whole chapter. A concept is one teachable idea a Class 10 student can be tested on
  (for example "Photosynthesis", "Role of stomata", "Digestion in the small intestine", "Double circulation").
- Give each concept: id (snake_case), name, section_id (one of the section ids given), summary (1-2 plain sentences),
  prerequisites (ids of OTHER concepts in your list that must be understood first; keep it a true dependency, not a
  link to everything; no cycles), level (recall | understanding | application).
- must_stay_true: 2 to 4 facts per concept. Each has "fact" (short) and "source_quote": a VERBATIM sentence or part of a
  sentence copied exactly from that concept's section text, at least 8 words long. Do not paraphrase the quote.
- misconceptions: 1 to 3 per concept: wrong ideas Class 10 students commonly hold about it. Each has id (snake_case,
  unique across the graph), text (the wrong belief, written the way a student would say it), why_students_think_it.
  These come from teaching experience, not from the text, so keep them realistic and specific.
- Cover every section of the chapter, including excretion and transport in plants.

Output JSON: {"concepts":[{"id":"","name":"","section_id":"","summary":"","prerequisites":[],"level":"",
"must_stay_true":[{"fact":"","source_quote":""}],"misconceptions":[{"id":"","text":"","why_students_think_it":""}]}]}
"""


def _chapter_prompt() -> str:
    ch = content.chapter()
    blocks = []
    for s in ch["sections"]:
        blocks.append(f"### SECTION {s['id']} - {s['title']} (pages {s['printed_pages']})\n" + "\n".join(s["paragraphs"]))
    return "\n\n".join(blocks)


def _break_cycles(concepts: list[Concept]) -> None:
    ids = {c.id for c in concepts}
    for c in concepts:
        c.prerequisites = [p for p in dict.fromkeys(c.prerequisites) if p in ids and p != c.id]
    by_id = {c.id: c for c in concepts}

    def reaches(start, target, seen=()):
        if start == target:
            return True
        return any(reaches(p, target, seen + (start,)) for p in by_id[start].prerequisites if p not in seen)

    for c in concepts:
        c.prerequisites = [p for p in c.prerequisites if not reaches(p, c.id)]


def run(save: bool = True) -> ConceptGraph:
    ch = content.chapter()
    raw = call_json("ingestion", SYSTEM, _chapter_prompt(), temperature=0.2, max_tokens=16000)
    section_ids = {s["id"] for s in ch["sections"]}
    concepts, dropped_quotes, seen = [], 0, set()

    for item in raw.get("concepts", []):
        cid = slug(item.get("id") or item.get("name", ""))
        sid = item.get("section_id")
        if not cid or cid in seen or sid not in section_ids:
            continue
        seen.add(cid)
        source = content.section_text(sid)
        facts = []
        for f in item.get("must_stay_true", []):
            if quote_in(source, f.get("source_quote", "")):
                facts.append(Fact(fact=f["fact"], source_quote=f["source_quote"]))
            else:
                dropped_quotes += 1  # the quote is not in the book, so the fact is not trusted
        miscs = [Misconception(id=slug(m["id"]), text=m["text"], why_students_think_it=m.get("why_students_think_it", ""))
                 for m in item.get("misconceptions", []) if m.get("id") and m.get("text")]
        concepts.append(Concept(
            id=cid, name=item["name"], section_id=sid, pages=content.section_pages(sid),
            summary=item.get("summary", ""), prerequisites=[slug(p) for p in item.get("prerequisites", [])],
            must_stay_true=facts, misconceptions=miscs,
            level=item.get("level") if item.get("level") in ("recall", "understanding", "application") else "understanding",
        ))

    _break_cycles(concepts)
    graph = ConceptGraph(book=ch["book"], chapter=f"{ch['chapter']['number']}. {ch['chapter']['title']}", concepts=concepts)
    print(f"concepts: {len(concepts)} | facts dropped because quote not found in book: {dropped_quotes}")
    if save:
        config.GRAPH_JSON.write_text(json.dumps(graph.model_dump(), indent=2, ensure_ascii=False), encoding="utf-8")
        config.GRAPH_REVIEW_MD.write_text(review_markdown(graph), encoding="utf-8")
        print("saved", config.GRAPH_JSON, "and", config.GRAPH_REVIEW_MD)
    return graph


def review_markdown(g: ConceptGraph) -> str:
    names = {c.id: c.name for c in g.concepts}
    out = [f"# Concept graph review - {g.chapter}", "", f"{len(g.concepts)} concepts. Check facts, prerequisites and misconceptions.", ""]
    for c in g.concepts:
        out += [f"## {c.name}  (`{c.id}`, section {c.section_id}, pages {c.pages[:1]}-{c.pages[-1:]}, {c.level})",
                c.summary, ""]
        out.append("**Needs first:** " + (", ".join(names[p] for p in c.prerequisites) or "nothing"))
        out.append("")
        out.append("**Must stay true:**")
        out += [f"- {f.fact}  \n  _\"{f.source_quote}\"_" for f in c.must_stay_true]
        out.append("")
        out.append("**Common misconceptions:**")
        out += [f"- `{m.id}`: {m.text}" for m in c.misconceptions]
        out.append("")
    return "\n".join(out)


if __name__ == "__main__":
    run()
