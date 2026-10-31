"""Fact-checker agent: nothing reaches the student until it is checked against the book's facts."""
from .. import content
from ..llm import call_json
from ..registry import team_brief
from ..schemas import Explanation, FactCheck

SYSTEM = team_brief("fact_checker") + """

Check the explanation against the must-stay-true facts and the source quotes.
Reject (approved=false) if it:
- states anything that contradicts a fact or the quotes;
- adds a biology claim that is not in the facts or quotes and could be wrong;
- uses an analogy in a way that teaches a wrong idea (for example implies something is used up when the fact says it is not).
Small, harmless wording choices are fine. When you reject, list the issues and write corrected_text: the same explanation,
same style, same tone and length, with the problem fixed. When you approve, corrected_text is null.

Output JSON: {"approved":true,"issues":[],"corrected_text":null}
"""


def check(explanation: Explanation, concept_id: str) -> FactCheck:
    c = content.concept(concept_id)
    facts = "\n".join(f"- {f.fact}\n  book says: \"{f.source_quote}\"" for f in c.must_stay_true)
    user = (f"CONCEPT: {c.name}\nMUST-STAY-TRUE FACTS:\n{facts}\n\n"
            f"EXPLANATION TO CHECK (style: {explanation.style}):\n{explanation.text}\n"
            f"CHECK QUESTION: {explanation.check_question}")
    return call_json("fact_checker", SYSTEM, user, schema=FactCheck, temperature=0.0, max_tokens=700)
