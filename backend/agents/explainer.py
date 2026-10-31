"""Explainer agent: explains a concept or a mistake in the student's own interest and tone.

Code (not the model) picks the style, so the "I didn't get that" loop reliably tries something new.
"""
from .. import content
from ..llm import call_json
from ..registry import team_brief
from ..schemas import Briefing, Explanation

STYLES = ["analogy", "simple_words", "step_by_step", "story", "real_life_example"]

STYLE_HELP = {
    "analogy": "Explain through a comparison from the student's interest. Name the analogy, map each part to the biology, "
               "and end by saying where the analogy stops being true.",
    "simple_words": "Use the simplest words and very short sentences. No jargon without a one-line meaning. No analogy.",
    "step_by_step": "Numbered steps, one idea per step, in the order things happen. No analogy.",
    "story": "A very short story (under 90 words) with characters from the student's interest that acts out the idea, "
             "then one sentence stating the biology plainly.",
    "real_life_example": "Use an everyday example from the student's own life (home, school, sport, food), not a comparison.",
    "custom": "Follow the student's own request about how they want it explained.",
}

TONE = {
    "gen_z": "casual, quick, modern; light humour is fine; no lecturing",
    "millennial": "friendly, clear, conversational",
    "gen_x": "calm, structured, respectful; no slang",
}

SYSTEM = team_brief("explainer") + """

How to write:
- Address the student directly as "you". Maximum 140 words.
- The biology must match the must-stay-true facts exactly. An analogy is a helper only; never let it change the facts.
- Start by naming what the student believed or got wrong (if a diagnosis is given) in a kind, non-judging way.
- Never announce the technique ("let's use an analogy", "here's the real deal"). Just use it naturally.
- If the student's interest is something you do not know well, say so briefly and use everyday examples instead of guessing.
- Put ONE short check question, at NCERT Class 10 level, asking the student to say the idea back in their own words, ONLY in the
  check_question field. The text itself must not contain that question or end with any question.
- Do not use filler like "here's the real deal" or "let's use the analogy".

Output JSON: {"text":"","analogy_used":null,"facts_covered":[""],"check_question":""}
"""


def pick_style(styles_tried: list[str], style_stats: dict) -> str:
    """First time: the style that has worked best for this student, else analogy. After that: the next untried one."""
    untried = [s for s in STYLES if s not in styles_tried]
    if not styles_tried:
        liked = [(v["helped"] / v["shown"], s) for s, v in style_stats.items() if s in STYLES and v["shown"] >= 1 and v["helped"] > 0]
        return max(liked)[1] if liked else "analogy"
    return untried[0] if untried else STYLES[len(styles_tried) % len(STYLES)]


def explain(student: dict, concept_id: str, diagnosis: dict | None, style: str,
            previous_text: str = "", request: str = "", feedback: str = "") -> Explanation:
    c = content.concept(concept_id)
    facts = "\n".join(f"- {f.fact}" for f in c.must_stay_true)
    user = (
        f"STUDENT: interest = {student.get('interest') or 'not given'}; age group = {student.get('age_group', 'gen_z')} "
        f"(tone: {TONE.get(student.get('age_group', 'gen_z'), TONE['millennial'])})\n"
        f"CONCEPT: {c.name}\nSUMMARY: {c.summary}\nMUST-STAY-TRUE FACTS:\n{facts}\n"
        f"STYLE TO USE: {style} - {STYLE_HELP[style]}\n"
    )
    if diagnosis:
        user += (f"DIAGNOSIS OF THE STUDENT'S MISTAKE: {diagnosis.get('outcome')}. {diagnosis.get('thinking_summary', '')}"
                 f" Student's words: {diagnosis.get('evidence', '')}\n")
        mid = diagnosis.get("misconception_id")
        if mid:
            m = next((m for m in c.misconceptions if m.id == mid), None)
            if m:
                user += f"MISCONCEPTION TO CORRECT: {m.text}\n"
    if previous_text:
        user += f"PREVIOUS EXPLANATION (the student did not understand it, do not repeat it):\n{previous_text}\n"
    if feedback:
        user += f"WHAT THE STUDENT SAID ABOUT IT: {feedback}\n"
    if request:
        user += f"THE STUDENT ASKED FOR: {request}\n"
    e = call_json("explainer", SYSTEM, user, schema=Explanation, temperature=0.6, max_tokens=700)
    e.concept_id, e.style = concept_id, style  # type: ignore[assignment]
    return e


BRIEFING_SYSTEM = team_brief("explainer") + """

Task now: write the short spoken briefing the tutor says right after a test (it may be read aloud, so no lists,
no markdown, no emojis). 70 to 110 words. In the student's tone and interest: say how they did, name the one or two
concepts to fix first (the root cause if one is given), and tell them they can ask for each mistake to be explained.
Be honest and encouraging. Do not explain the biology here.

Output JSON: {"spoken_text":"","focus_concept_ids":[""]}
"""


def briefing(student: dict, score: int, total: int, weak: list[dict], misconceptions: list[str]) -> Briefing:
    user = (
        f"STUDENT: name = {student.get('name')}; interest = {student.get('interest') or 'not given'}; "
        f"tone: {TONE.get(student.get('age_group', 'gen_z'), TONE['millennial'])}\n"
        f"SCORE: {score} of {total}\n"
        f"WEAKEST CONCEPTS (id, name, root-cause prerequisite if any): {weak}\n"
        f"MISCONCEPTIONS FOUND: {misconceptions}\n"
    )
    return call_json("explainer", BRIEFING_SYSTEM, user, schema=Briefing, temperature=0.6, max_tokens=500)
