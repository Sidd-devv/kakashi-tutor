"""Small text helpers shared by the agents."""
import re


def norm(text: str) -> str:
    """Lowercase, drop punctuation and hyphen/space differences so quotes can be matched."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def quote_in(source: str, quote: str) -> bool:
    """True if the quote appears in the source, ignoring punctuation and line-wrap differences."""
    q = norm(quote)
    return len(q.split()) >= 4 and q in norm(source)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
