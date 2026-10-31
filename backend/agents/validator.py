"""Validator agent: checks the test builder's questions against the book. Rejected questions are rebuilt."""
import json

from .. import content
from ..llm import call_json
from ..registry import team_brief
from ..schemas import Question, Verdict, Verdicts
from ..text_utils import quote_in

SYSTEM = team_brief("validator") + """

For each question decide ok=true or ok=false. Reject (ok=false) and list the issues if ANY of these is true:
- the source_quote does not clearly support the option marked correct;
- more than one option could be argued as correct, or none is;
- answering needs knowledge that is not in the source text;
- it is harder than an in-chapter NCERT Class 10 question, or is hypothetical;
- the wording is ambiguous or a wrong option is silly rather than a plausible mistake.
Be strict but fair. Judge only from the source text given.

Output JSON: {"verdicts":[{"question_id":"","ok":true,"issues":[]}]}
"""


def _code_checks(q: Question, topic_concept_ids: set[str], source: str) -> list[str]:
    issues = []
    if len({o.text.strip().lower() for o in q.options}) != 4:
        issues.append("options are not four distinct answers")
    if q.correct_key not in {o.key for o in q.options}:
        issues.append("correct_key is not one of the options")
    if not quote_in(source, q.source_quote):
        issues.append("source_quote was not found in the book text")
    if not set(q.concept_ids) <= topic_concept_ids:
        issues.append("question tagged with a concept outside this topic")
    return issues


def check(questions: list[Question], topic_id: str) -> list[Verdict]:
    source = content.topic_source(topic_id)
    topic_ids = {c.id for c in content.concepts_for_topic(topic_id)}
    verdicts, to_llm = {}, []
    for q in questions:
        issues = _code_checks(q, topic_ids, source)
        if issues:
            verdicts[q.id] = Verdict(question_id=q.id, ok=False, issues=issues)
        else:
            to_llm.append(q)

    if to_llm:
        payload = [{"question_id": q.id, "stem": q.stem, "options": {o.key: o.text for o in q.options},
                    "correct_key": q.correct_key, "source_quote": q.source_quote} for q in to_llm]
        user = f"SOURCE TEXT:\n{source}\n\nQUESTIONS TO CHECK:\n{json.dumps(payload, indent=1)}"
        result = call_json("validator", SYSTEM, user, schema=Verdicts, temperature=0.0, max_tokens=3000)
        for v in result.verdicts:
            verdicts[v.question_id] = v
        for q in to_llm:  # anything the model skipped counts as rejected
            verdicts.setdefault(q.id, Verdict(question_id=q.id, ok=False, issues=["validator gave no verdict"]))
    return [verdicts[q.id] for q in questions]
