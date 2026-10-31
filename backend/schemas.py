"""The data contracts between agents.

Every agent returns one of these models. The next agent in the chain reads the same model,
so a malformed reply is caught at the boundary, not three steps later.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

Level = Literal["recall", "understanding", "application"]
Outcome = Literal["correct_confident", "correct_unsure", "careless_slip", "knowledge_gap", "misconception"]
Style = Literal["analogy", "simple_words", "step_by_step", "story", "real_life_example", "custom"]


# ---- concept graph (ingestion agent -> everyone) -------------------------------------------

class Fact(BaseModel):
    fact: str
    source_quote: str


class Misconception(BaseModel):
    id: str
    text: str
    why_students_think_it: str = ""


class Concept(BaseModel):
    id: str
    name: str
    section_id: str
    pages: list[int] = Field(default_factory=list)
    summary: str
    prerequisites: list[str] = Field(default_factory=list)
    must_stay_true: list[Fact] = Field(default_factory=list)
    misconceptions: list[Misconception] = Field(default_factory=list)
    level: Level = "understanding"


class ConceptGraph(BaseModel):
    book: str
    chapter: str
    concepts: list[Concept]


# ---- tests (test builder -> validator -> student) -------------------------------------------

class Option(BaseModel):
    key: Literal["A", "B", "C", "D"]
    text: str
    misconception_id: Optional[str] = None  # set when this wrong option is built from a known misconception


class Question(BaseModel):
    id: str = ""
    concept_ids: list[str]
    level: Level = "understanding"
    stem: str
    options: list[Option]
    correct_key: Literal["A", "B", "C", "D"]
    source_section: str = ""
    source_quote: str
    explanation: str = ""


class RawQuestions(BaseModel):
    questions: list[Question]


class Verdict(BaseModel):
    question_id: str
    ok: bool
    issues: list[str] = Field(default_factory=list)


class Verdicts(BaseModel):
    verdicts: list[Verdict]


# ---- diagnosis (diagnoser -> learner model, explainer, teacher insights) -----------------------

class Diagnosis(BaseModel):
    question_id: str = ""
    outcome: Outcome
    misconception_id: Optional[str] = None
    thinking_summary: str = ""   # plain-language description of how the student was thinking
    evidence: str = ""           # the part of the student's words that shows it
    root_cause_concept_id: Optional[str] = None  # filled in by code from the learner model


# ---- explanations (explainer -> fact-checker -> student) ---------------------------------------

class Explanation(BaseModel):
    concept_id: str = ""
    style: Style = "analogy"
    text: str
    analogy_used: Optional[str] = None
    facts_covered: list[str] = Field(default_factory=list)
    check_question: str = ""


class FactCheck(BaseModel):
    approved: bool
    issues: list[str] = Field(default_factory=list)
    corrected_text: Optional[str] = None


class Briefing(BaseModel):
    spoken_text: str
    focus_concept_ids: list[str] = Field(default_factory=list)


# ---- teacher insights ---------------------------------------------------------------------------

class StudentProfile(BaseModel):
    thinking_summary: str
    strengths: list[str] = Field(default_factory=list)
    watch_outs: list[str] = Field(default_factory=list)
    how_to_approach: list[str] = Field(default_factory=list)
    best_explanation_style: str = ""


class Interests(BaseModel):
    interests: list[str] = Field(default_factory=list)


class ReteachPlan(BaseModel):
    concept_id: str
    misconception: str = ""
    explain_in_5_minutes: str
    analogy: str = ""
    practice_questions: list[str] = Field(default_factory=list)


class ClassPlans(BaseModel):
    plans: list[ReteachPlan]
