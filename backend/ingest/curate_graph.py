"""Human-reviewed corrections to the generated concept graph. Run after the ingestion agent:

    python -m backend.ingest.curate_graph

Every fact added here must quote the book verbatim (checked against the chapter text), and every
concept's page references are recomputed from where its quotes really are in the PDF.
"""
import json

import fitz  # PyMuPDF

from .. import config, content
from ..agents.ingestion import review_markdown
from ..schemas import Concept, ConceptGraph, Fact, Misconception
from ..text_utils import norm, quote_in

# concept id -> facts to add (or replace, when "replace" names the fact text to drop)
FACT_FIXES = {
    "events_in_photosynthesis": {"add": [
        ("Photosynthesis happens in three events: chlorophyll absorbs light energy; light energy is converted to chemical "
         "energy and water is split; carbon dioxide is reduced to carbohydrates.",
         "(i) Absorption of light energy by chlorophyll. (ii) Conversion of light energy to chemical energy and splitting "
         "of water molecules into hydrogen and oxygen. (iii) Reduction of carbon dioxide to carbohydrates.")]},
    "heterotrophic_nutrition": {"add": [
        ("The form of nutrition depends on the type and availability of food and on how the organism obtains it.",
         "The form of nutrition differs depending on the type and availability of food material as well as how it is "
         "obtained by the organism."),
        ("Some organisms break down food outside the body and then absorb it.",
         "Some organisms break-down the food material outside the body and then absorb it.")]},
    "digestion_and_absorption_in_small_intestine": {
        "replace": "Bile from the liver makes food alkaline and emulsifies fats.",
        "add": [("Food from the stomach is acidic, so it is made alkaline (by bile juice from the liver) for the pancreatic enzymes to act.",
                 "The food coming from the stomach is acidic and has to be made alkaline for the pancreatic enzymes to act. "
                 "Bile juice from the liver accomplishes this in addition to acting on fats.")]},
    "transportation_in_humans_overview": {
        "replace": "The heart is a muscular organ that pumps blood.",
        "add": [("A pumping organ (the heart) is needed to push blood around the body.",
                 "We thus need a pumping organ to push blood around the body, a network of tubes to reach all the tissues")]},
    "excretion_in_humans": {"add": [
        ("The human excretory system has a pair of kidneys, a pair of ureters, a urinary bladder and a urethra.",
         "The excretory system of human beings (Fig. 5.13) includes a pair of kidneys, a pair of ureters, a urinary "
         "bladder and a urethra.")]},
}

NEW_CONCEPTS = [
    {
        "id": "nephron_and_urine_formation", "name": "Nephron and Urine Formation", "section_id": "5.5.1",
        "summary": "Each kidney filters blood in many tiny units called nephrons; useful substances are taken back as the urine flows on.",
        "prerequisites": ["excretion_in_humans"], "level": "understanding",
        "facts": [
            ("The kidney's filtration units are nephrons: a cluster of thin-walled blood capillaries joined to the cup-shaped Bowman's capsule, which collects the filtrate.",
             "Each capillary cluster in the kidney is associated with the cup-shaped end of a coiled tube called Bowman’s capsule "
             "that collects the filtrate (Fig. 5.14). Each kidney has large numbers of these filtration units called nephrons packed close together."),
            ("Glucose, amino acids, salts and much of the water in the first filtrate are selectively re-absorbed as urine flows along the tube.",
             "Some substances in the initial filtrate, such as glucose, amino acids, salts and a major amount of water, are "
             "selectively re-absorbed as the urine flows along the tube."),
            ("About 180 L of filtrate forms daily but only a litre or two is excreted, because the rest is re-absorbed.",
             "However, the volume actually excreted is only a litre or two a day, because the remaining filtrate is re-absorbed in the kidney tubules.")],
        "misconceptions": [("all_filtrate_becomes_urine", "Everything the kidney filters out of the blood leaves the body as urine.",
                            "They forget that useful substances and most of the water are taken back (re-absorbed).")],
    },
    {
        "id": "urine_storage_and_regulation", "name": "Urine Storage and Regulation", "section_id": "5.5.1",
        "summary": "Urine passes from the kidneys through the ureters to the bladder, is stored, and is released through the urethra; the water re-absorbed depends on the body's needs.",
        "prerequisites": ["nephron_and_urine_formation"], "level": "recall",
        "facts": [
            ("The amount of water re-absorbed depends on how much excess water is in the body and how much dissolved waste has to be excreted.",
             "The amount of water re-absorbed depends on how much excess water there is in the body, and on how much of dissolved waste there is to be excreted."),
            ("Urine is stored in the urinary bladder until the pressure of the expanded bladder gives the urge to pass it out through the urethra.",
             "Urine is stored in the urinary bladder until the pressure of the expanded bladder leads to the urge to pass it out through the urethra.")],
        "misconceptions": [("urine_amount_fixed", "The kidneys make the same amount of urine whatever the body needs.",
                            "They do not link urine volume to how much water the body has to spare.")],
    },
    {
        "id": "artificial_kidney", "name": "Artificial Kidney (Dialysis)", "section_id": "5.5.1",
        "summary": "When kidneys fail, a dialysis machine removes nitrogenous waste from the blood, but without re-absorption.",
        "prerequisites": ["nephron_and_urine_formation"], "level": "recall",
        "facts": [
            ("An artificial kidney is a device that removes nitrogenous waste products from the blood through dialysis.",
             "An artificial kidney is a device to remove nitrogenous waste products from the blood through dialysis."),
            ("Dialysis is similar to the kidney's function but has no re-absorption.",
             "This is similar to the function of the kidney, but it is different since there is no re- absorption involved.")],
        "misconceptions": [("dialysis_same_as_kidney", "An artificial kidney works in exactly the same way as a real kidney.",
                            "They miss that dialysis has no re-absorption step.")],
    },
]


def _pdf_pages(pdf_path: str) -> dict[int, str]:
    """printed page number -> normalised page text, from the original chapter PDF."""
    doc = fitz.open(pdf_path)
    first_printed = content.chapter()["sections"][0]["printed_pages"][0]
    return {first_printed + i: norm(p.get_text()) for i, p in enumerate(doc)}


def pages_of(quote: str, pages: dict[int, str]) -> list[int]:
    words = norm(quote).split()
    hits = []
    for probe in (" ".join(words[:8]), " ".join(words[-8:])):  # a quote may start on one page and end on the next
        hits += [pg for pg, text in pages.items() if probe in text]
    return sorted(set(hits))


def run() -> None:
    g = ConceptGraph.model_validate_json(config.GRAPH_JSON.read_text(encoding="utf-8"))
    by_id = {c.id: c for c in g.concepts}
    rejected = []

    def accept(section_id, fact, quote, cid):
        if quote_in(content.section_text(section_id), quote):
            return Fact(fact=fact, source_quote=quote)
        rejected.append((cid, quote[:60]))
        return None

    for cid, fix in FACT_FIXES.items():
        c = by_id[cid]
        if "replace" in fix:
            c.must_stay_true = [f for f in c.must_stay_true if f.fact != fix["replace"]]
        have = {f.fact for f in c.must_stay_true}
        for fact, quote in fix["add"]:
            f = accept(c.section_id, fact, quote, cid)
            if f and f.fact not in have:
                c.must_stay_true.append(f)

    for n in NEW_CONCEPTS:
        if n["id"] in by_id:
            continue
        facts = [f for f in (accept(n["section_id"], a, b, n["id"]) for a, b in n["facts"]) if f]
        c = Concept(id=n["id"], name=n["name"], section_id=n["section_id"], summary=n["summary"],
                    prerequisites=n["prerequisites"], level=n["level"], must_stay_true=facts,
                    misconceptions=[Misconception(id=i, text=t, why_students_think_it=w) for i, t, w in n["misconceptions"]])
        g.concepts.append(c)
        by_id[c.id] = c

    # page references: where this concept's quotes really are, not the whole section
    pages = _pdf_pages(str(config.DATA / "life-processes.pdf"))
    for c in g.concepts:
        found = sorted({p for f in c.must_stay_true for p in pages_of(f.source_quote, pages)})
        if found:
            c.pages = found

    config.GRAPH_JSON.write_text(json.dumps(g.model_dump(), indent=2, ensure_ascii=False), encoding="utf-8")
    config.GRAPH_REVIEW_MD.write_text(review_markdown(g), encoding="utf-8")
    print(f"concepts: {len(g.concepts)} | quotes rejected: {rejected or 'none'}")


if __name__ == "__main__":
    run()
