"""Test builder agent: topic source text + concepts -> multiple-choice questions grounded in the book."""
import random

from .. import content
from ..llm import call_json
from ..registry import team_brief
from ..schemas import Option, Question, RawQuestions
from ..text_utils import quote_in

SYSTEM = team_brief("test_builder") + """

Rules for the questions:
- Use ONLY the source text provided. No outside knowledge, no hypothetical or "what if" scenarios beyond the book,
  no numerical problems, nothing harder than an in-chapter NCERT exercise. Allowed levels: recall, understanding,
  simple application of a statement in the text.
- Each question tests 1 or 2 concepts from the concept list (use their ids in concept_ids).
- Four options. Exactly one is correct. Build each wrong option from one of that concept's known misconceptions
  whenever one fits, and put that misconception's id in the option's misconception_id (otherwise null).
  Wrong options must be plausible to a student who holds the misconception, never silly.
- source_quote: copy one sentence (or the useful part of one) EXACTLY from the source text, at least 8 words, that is
  enough to prove the correct answer. Do not paraphrase it.
- explanation: one or two sentences saying why the correct option is right, using only that quote.
- Spread the questions across different concepts. If weak concepts are listed, at least half the questions
  must test them.
- Clear, short, exam-style wording for a Class 10 student.

Output JSON: {"questions":[{"concept_ids":[],"level":"recall|understanding|application","stem":"",
"options":[{"key":"A","text":"","misconception_id":null},{"key":"B",...},{"key":"C",...},{"key":"D",...}],
"correct_key":"A","source_quote":"","explanation":""}]}
"""


def _concepts_block(concepts) -> str:
    lines = []
    for c in concepts:
        lines.append(f"- id={c.id} | {c.name} | level={c.level}")
        lines += [f"    fact: {f.fact}" for f in c.must_stay_true]
        lines += [f"    misconception id={m.id}: {m.text}" for m in c.misconceptions]
    return "\n".join(lines)


def build(topic_id: str, n: int = 5, weak_concept_ids=None, avoid_stems=None, seed=None) -> list[Question]:
    concepts = content.concepts_for_topic(topic_id)
    valid_ids = {c.id for c in concepts}
    source = content.topic_source(topic_id)
    user = f"SOURCE TEXT (the only allowed material):\n{source}\n\nCONCEPTS OF THIS TOPIC:\n{_concepts_block(concepts)}\n\n"
    user += f"Write {n} questions."
    if weak_concept_ids:
        user += f"\nWeak concepts to focus on: {', '.join(weak_concept_ids)}"
    if avoid_stems:
        user += "\nDo not repeat these questions:\n" + "\n".join(f"- {s}" for s in avoid_stems)

    raw = call_json("test_builder", SYSTEM, user, schema=RawQuestions, temperature=0.4, max_tokens=6000)
    rng = random.Random(seed)
    out = []
    for q in raw.questions:
        q.concept_ids = [c for c in q.concept_ids if c in valid_ids]
        if not q.concept_ids or len(q.options) != 4:
            continue
        correct_text = next((o.text for o in q.options if o.key == q.correct_key), None)
        if correct_text is None:
            continue
        # shuffle so the answer is not always in the same position, then relabel A-D
        opts = list(q.options)
        rng.shuffle(opts)
        relabelled = [Option(key="ABCD"[i], text=o.text, misconception_id=o.misconception_id) for i, o in enumerate(opts)]
        q.correct_key = next(o.key for o in relabelled if o.text == correct_text)
        q.options = relabelled
        # the section is decided by code, from where the quote really is
        for s in content.chapter()["sections"]:
            if quote_in("\n".join(s["paragraphs"]), q.source_quote):
                q.source_section = s["id"]
                break
        out.append(q)
    return out
