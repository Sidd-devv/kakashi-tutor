"""Subjects, chapters and topics shown to students.

Only Class 10 Biology / Life Processes is built. The other cards are listed so the dashboard
looks complete, and are marked as coming soon.
"""

CHAPTER = {"number": 5, "title": "Life Processes"}

# topic id -> NCERT section id prefixes it covers
TOPICS = [
    {"id": "overview", "name": "What are Life Processes?", "sections": ["5.1"]},
    {"id": "nutrition", "name": "Nutrition", "sections": ["5.2"]},
    {"id": "respiration", "name": "Respiration", "sections": ["5.3"]},
    {"id": "transportation", "name": "Transportation", "sections": ["5.4"]},
    {"id": "excretion", "name": "Excretion", "sections": ["5.5"]},
]

SUBJECTS = [
    {"id": "bio10", "class": 10, "subject": "Biology", "available": True},
    {"id": "phy10", "class": 10, "subject": "Physics", "available": False},
    {"id": "bio9", "class": 9, "subject": "Biology", "available": False},
    {"id": "phy9", "class": 9, "subject": "Physics", "available": False},
]


def topic(topic_id: str) -> dict:
    for t in TOPICS:
        if t["id"] == topic_id:
            return t
    raise KeyError(f"unknown topic {topic_id}")


def section_in_topic(section_id: str, topic_id: str) -> bool:
    return any(section_id == p or section_id.startswith(p + ".") for p in topic(topic_id)["sections"])
