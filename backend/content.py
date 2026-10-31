"""Read access to the book text and the concept graph."""
import json
from functools import lru_cache

from . import config, topics
from .schemas import Concept, ConceptGraph


@lru_cache(maxsize=1)
def chapter() -> dict:
    return json.loads(config.CHAPTER_JSON.read_text(encoding="utf-8"))


def section_text(section_id: str) -> str:
    for s in chapter()["sections"]:
        if s["id"] == section_id:
            return "\n".join(s["paragraphs"])
    return ""


def section_pages(section_id: str) -> list[int]:
    for s in chapter()["sections"]:
        if s["id"] == section_id and s["printed_pages"]:
            a, b = s["printed_pages"]
            return list(range(a, b + 1))
    return []


def topic_source(topic_id: str) -> str:
    """The exact NCERT text for a topic, labelled by section. This is all a test may draw from."""
    blocks = []
    for s in chapter()["sections"]:
        if topics.section_in_topic(s["id"], topic_id):
            blocks.append(f"[SECTION {s['id']} {s['title']} | pages {s['printed_pages']}]\n" + "\n".join(s["paragraphs"]))
    return "\n\n".join(blocks)


def graph() -> ConceptGraph:
    return _graph(config.GRAPH_JSON.stat().st_mtime)


@lru_cache(maxsize=2)
def _graph(_mtime) -> ConceptGraph:
    return ConceptGraph.model_validate_json(config.GRAPH_JSON.read_text(encoding="utf-8"))


def concept(concept_id: str) -> Concept:
    for c in graph().concepts:
        if c.id == concept_id:
            return c
    raise KeyError(concept_id)


def concepts_for_topic(topic_id: str) -> list[Concept]:
    return [c for c in graph().concepts if topics.section_in_topic(c.section_id, topic_id)]
