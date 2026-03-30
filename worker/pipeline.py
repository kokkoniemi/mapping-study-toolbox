from __future__ import annotations

import io
import json
import os
import re
import subprocess
import tempfile
import textwrap
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

import fitz
import requests


OPENAI_API_ROOT = os.environ.get("OPENAI_API_ROOT", "https://api.openai.com/v1")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4")
OPENAI_TIMEOUT_SECONDS = int(os.environ.get("OPENAI_TIMEOUT_SECONDS", "120"))
GROBID_URL = os.environ.get("GROBID_URL", "http://grobid:8070")
ENABLE_OCR = os.environ.get("KEYWORDING_ENABLE_OCR", "true").lower() != "false"
EXTRACTOR_VERSION = "1.0"

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "its", "of", "on",
    "or", "our", "that", "the", "their", "this", "to", "using", "use", "with", "we", "within", "through", "study",
    "paper", "approach", "based", "results", "analysis", "system", "systems", "method", "methods", "article",
}


@dataclass
class Chunk:
    chunk_key: str
    chunk_index: int
    page_start: int | None
    page_end: int | None
    section_name: str | None
    heading_path: list[str]
    text: str
    char_count: int
    token_count: int
    embedding_reference: str | None
    quality_score: float | None
    quality_flags: list[str]


def normalize_text(value: str) -> str:
    return (
        value.replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\f", "\n")
        .replace("\0", " ")
        .replace("\u00ad", "")
    )


def compact_text(value: str) -> str:
    value = normalize_text(value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    value = re.sub(r"[^\S\n]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def tokenize(value: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9][a-z0-9_-]{1,}", value.lower())
    return [token for token in tokens if token not in STOP_WORDS]


def quality_metrics(value: str) -> dict[str, float]:
    if not value:
        return {
            "printable_text_ratio": 0.0,
            "weird_character_ratio": 1.0,
            "quality_score": 0.0,
        }

    visible_chars = [char for char in value if not char.isspace()]
    printable_count = sum(1 for char in visible_chars if char.isprintable())
    weird_count = sum(1 for char in visible_chars if char == "\ufffd" or ord(char) < 32)
    alnum_count = sum(1 for char in visible_chars if char.isalnum())

    visible_total = max(len(visible_chars), 1)
    printable_ratio = printable_count / visible_total
    weird_ratio = weird_count / visible_total
    alnum_ratio = alnum_count / visible_total
    quality_score = max(0.0, min(1.0, (printable_ratio * 0.5) + (alnum_ratio * 0.4) - (weird_ratio * 0.9)))

    return {
        "printable_text_ratio": round(printable_ratio, 4),
        "weird_character_ratio": round(weird_ratio, 4),
        "quality_score": round(quality_score, 4),
    }


def determine_quality_status(text: str, warnings: list[str], ocr_used: bool) -> str:
    metrics = quality_metrics(text)
    if len(text.strip()) < 200:
        warnings.append("Extracted text is very short.")
    if metrics["printable_text_ratio"] < 0.85:
        warnings.append("Printable text ratio is low.")
    if metrics["weird_character_ratio"] > 0.02:
        warnings.append("Weird character ratio is high.")

    if len(text.strip()) < 80 or metrics["quality_score"] < 0.35:
        return "failed"
    if warnings or ocr_used:
        return "needs_review"
    return "passed"


def relpath_from_app_data(app_data_dir: str, absolute_path: Path) -> str:
    return os.path.relpath(str(absolute_path), app_data_dir)


def extract_with_pymupdf(pdf_path: str) -> tuple[list[dict[str, Any]], int]:
    pages: list[dict[str, Any]] = []
    with fitz.open(pdf_path) as document:
        for index, page in enumerate(document, start=1):
            page_text = compact_text(page.get_text("text"))
            pages.append({
                "page": index,
                "text": page_text,
            })
        return pages, document.page_count


def call_grobid(pdf_path: str) -> dict[str, Any] | None:
    try:
        with open(pdf_path, "rb") as handle:
            response = requests.post(
                f"{GROBID_URL.rstrip('/')}/api/processFulltextDocument",
                files={"input": handle},
                timeout=90,
            )
        response.raise_for_status()
    except Exception:
        return None

    try:
        root = ET.fromstring(response.text)
    except ET.ParseError:
        return None

    ns = {"tei": "http://www.tei-c.org/ns/1.0"}
    title = root.findtext(".//tei:titleStmt/tei:title", default="", namespaces=ns).strip() or None
    abstract_parts = [
        compact_text("".join(paragraph.itertext()))
        for paragraph in root.findall(".//tei:profileDesc/tei:abstract//tei:p", ns)
    ]
    sections: list[dict[str, Any]] = []
    for index, div in enumerate(root.findall(".//tei:text/tei:body/tei:div", ns), start=1):
        head = div.findtext("./tei:head", default="", namespaces=ns).strip() or None
        paragraphs = [
            compact_text("".join(paragraph.itertext()))
            for paragraph in div.findall(".//tei:p", ns)
        ]
        sections.append({
            "index": index,
            "heading": head,
            "paragraphs": [paragraph for paragraph in paragraphs if paragraph],
        })

    return {
        "title": title,
        "abstract": [item for item in abstract_parts if item],
        "sections": sections,
    }


def run_ocr(pdf_path: str, page_count: int) -> tuple[list[dict[str, Any]], float | None]:
    pages: list[dict[str, Any]] = []
    confidence_values: list[float] = []

    with tempfile.TemporaryDirectory(prefix="mapping-study-toolbox-ocr-") as temp_dir:
        base = Path(temp_dir) / "page"
        subprocess.run(
            ["pdftoppm", "-r", "200", "-png", pdf_path, str(base)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        for page_index in range(1, page_count + 1):
            image_path = Path(temp_dir) / f"page-{page_index}.png"
            if not image_path.exists():
                continue

            output_base = Path(temp_dir) / f"ocr-{page_index}"
            subprocess.run(
                ["tesseract", str(image_path), str(output_base), "-l", "eng"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            txt_path = output_base.with_suffix(".txt")
            text = compact_text(txt_path.read_text("utf-8", errors="ignore")) if txt_path.exists() else ""
            pages.append({"page": page_index, "text": text})

            tsv_result = subprocess.run(
                ["tesseract", str(image_path), "stdout", "-l", "eng", "tsv"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            tsv_stream = io.StringIO(tsv_result.stdout)
            if tsv_result.stdout:
                confidences = []
                for line in tsv_stream.read().splitlines()[1:]:
                    parts = line.split("\t")
                    if len(parts) < 11:
                        continue
                    try:
                        confidence = float(parts[10])
                    except ValueError:
                        continue
                    if confidence >= 0:
                        confidences.append(confidence)
                if confidences:
                    confidence_values.append(sum(confidences) / len(confidences))

    average_confidence = None
    if confidence_values:
        average_confidence = round(sum(confidence_values) / len(confidence_values), 2)

    return pages, average_confidence


def merge_pages(primary_pages: list[dict[str, Any]], ocr_pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged = []
    ocr_by_page = {item["page"]: item.get("text", "") for item in ocr_pages}
    for page in primary_pages:
        primary_text = compact_text(page.get("text", ""))
        ocr_text = compact_text(ocr_by_page.get(page["page"], ""))
        chosen_text = primary_text if len(primary_text) >= max(100, len(ocr_text) // 2) else ocr_text
        merged.append({
            "page": page["page"],
            "text": chosen_text,
        })
    return merged


def infer_source_type(primary_pages: list[dict[str, Any]], ocr_used: bool) -> str:
    primary_non_empty = sum(1 for page in primary_pages if page.get("text"))
    if ocr_used and primary_non_empty == 0:
        return "scanned-pdf"
    if ocr_used and primary_non_empty > 0:
        return "mixed"
    if primary_non_empty > 0:
        return "text-pdf"
    return "unknown"


def build_sections(pages: list[dict[str, Any]], grobid: dict[str, Any] | None) -> list[dict[str, Any]]:
    if grobid and grobid.get("sections"):
        sections: list[dict[str, Any]] = []
        page_cursor = 1
        for section in grobid["sections"]:
            paragraphs = [paragraph for paragraph in section.get("paragraphs", []) if paragraph]
            if not paragraphs:
                continue
            sections.append({
                "heading": section.get("heading"),
                "paragraphs": paragraphs,
                "page": page_cursor,
            })
            page_cursor = min(page_cursor + 1, max(len(pages), 1))
        if sections:
            return sections

    fallback_sections = []
    for page in pages:
        paragraphs = [compact_text(item) for item in re.split(r"\n{2,}", page.get("text", ""))]
        paragraphs = [paragraph for paragraph in paragraphs if paragraph]
        if not paragraphs:
            continue
        fallback_sections.append({
            "heading": f"Page {page['page']}",
            "paragraphs": paragraphs,
            "page": page["page"],
        })
    return fallback_sections


def build_chunks(record_id: int, document_id: int, sections: list[dict[str, Any]]) -> list[Chunk]:
    chunks: list[Chunk] = []
    chunk_index = 0

    for section in sections:
        heading = section.get("heading")
        heading_path = [heading] if heading else []
        page = section.get("page")
        for paragraph in section.get("paragraphs", []):
            text = compact_text(paragraph)
            if len(text) < 40:
                continue
            tokens = tokenize(text)
            quality = quality_metrics(text)["quality_score"]
            chunks.append(
                Chunk(
                    chunk_key=f"record-{record_id}-document-{document_id}-chunk-{chunk_index}",
                    chunk_index=chunk_index,
                    page_start=page,
                    page_end=page,
                    section_name=heading,
                    heading_path=heading_path,
                    text=text,
                    char_count=len(text),
                    token_count=len(tokens),
                    embedding_reference=None,
                    quality_score=quality,
                    quality_flags=[],
                )
            )
            chunk_index += 1

    return chunks


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def extract_document(payload: dict[str, Any]) -> dict[str, Any]:
    record_id = int(payload["recordId"])
    document_id = int(payload["documentId"])
    pdf_path = str(payload["absolutePdfPath"])
    app_data_dir = str(payload["appDataDir"])

    primary_pages, page_count = extract_with_pymupdf(pdf_path)
    warnings: list[str] = []
    primary_text = compact_text("\n\n".join(page["text"] for page in primary_pages))
    primary_quality = quality_metrics(primary_text)

    ocr_used = False
    ocr_confidence = None
    merged_pages = primary_pages

    if ENABLE_OCR and (len(primary_text) < 500 or primary_quality["quality_score"] < 0.45):
        try:
            ocr_pages, ocr_confidence = run_ocr(pdf_path, page_count)
            if any(page.get("text") for page in ocr_pages):
                merged_pages = merge_pages(primary_pages, ocr_pages)
                ocr_used = True
        except Exception as error:
            warnings.append(f"OCR fallback failed: {error}")

    grobid = call_grobid(pdf_path)
    if grobid is None:
        warnings.append("GROBID structure extraction unavailable.")

    extracted_text = compact_text("\n\n".join(page["text"] for page in merged_pages))
    sections = build_sections(merged_pages, grobid)
    chunks = build_chunks(record_id, document_id, sections)
    quality_status = determine_quality_status(extracted_text, warnings, ocr_used)
    metrics = quality_metrics(extracted_text)
    if ocr_used and ocr_confidence is not None and ocr_confidence < 55:
        warnings.append("OCR confidence is low.")
        if quality_status == "passed":
            quality_status = "needs_review"

    text_path = Path(app_data_dir) / "storage" / "pdf-text" / f"record-{record_id}" / f"document-{document_id}.txt"
    structure_path = Path(app_data_dir) / "storage" / "pdf-structure" / f"record-{record_id}" / f"document-{document_id}.json"
    chunk_path = Path(app_data_dir) / "storage" / "pdf-chunks" / f"record-{record_id}" / f"document-{document_id}.json"

    ensure_parent(text_path)
    ensure_parent(structure_path)
    ensure_parent(chunk_path)

    text_path.write_text(f"{extracted_text}\n", encoding="utf-8")
    structure_payload = {
        "recordId": record_id,
        "documentId": document_id,
        "pageCount": page_count,
        "sourceType": infer_source_type(primary_pages, ocr_used),
        "grobid": grobid,
        "pages": merged_pages,
        "sections": sections,
        "quality": {
            "status": quality_status,
            "warnings": warnings,
            **metrics,
            "ocrUsed": ocr_used,
            "ocrConfidence": ocr_confidence,
        },
    }
    structure_path.write_text(json.dumps(structure_payload, indent=2) + "\n", encoding="utf-8")
    chunk_path.write_text(
        json.dumps(
            [
                {
                    "chunkKey": chunk.chunk_key,
                    "chunkIndex": chunk.chunk_index,
                    "pageStart": chunk.page_start,
                    "pageEnd": chunk.page_end,
                    "sectionName": chunk.section_name,
                    "headingPath": chunk.heading_path,
                    "text": chunk.text,
                    "charCount": chunk.char_count,
                    "tokenCount": chunk.token_count,
                    "embeddingReference": chunk.embedding_reference,
                    "qualityScore": chunk.quality_score,
                    "qualityFlags": chunk.quality_flags,
                }
                for chunk in chunks
            ],
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    return {
        "extractedCharacters": len(extracted_text),
        "pageCount": page_count,
        "sourceType": infer_source_type(primary_pages, ocr_used),
        "extractorKind": "pymupdf+grobid+ocr",
        "extractorVersion": EXTRACTOR_VERSION,
        "extractedTextPath": relpath_from_app_data(app_data_dir, text_path),
        "structuredDocumentPath": relpath_from_app_data(app_data_dir, structure_path),
        "chunkManifestPath": relpath_from_app_data(app_data_dir, chunk_path),
        "qualityStatus": quality_status,
        "qualityScore": metrics["quality_score"],
        "printableTextRatio": metrics["printable_text_ratio"],
        "weirdCharacterRatio": metrics["weird_character_ratio"],
        "ocrUsed": ocr_used,
        "ocrConfidence": ocr_confidence,
        "warnings": warnings,
        "chunks": [
            {
                "chunkKey": chunk.chunk_key,
                "chunkIndex": chunk.chunk_index,
                "pageStart": chunk.page_start,
                "pageEnd": chunk.page_end,
                "sectionName": chunk.section_name,
                "headingPath": chunk.heading_path,
                "text": chunk.text,
                "charCount": chunk.char_count,
                "tokenCount": chunk.token_count,
                "embeddingReference": chunk.embedding_reference,
                "qualityScore": chunk.quality_score,
                "qualityFlags": chunk.quality_flags,
            }
            for chunk in chunks
        ],
    }


def overlap_score(query: str, text: str) -> float:
    query_tokens = set(tokenize(query))
    text_tokens = set(tokenize(text))
    if not query_tokens or not text_tokens:
        return 0.0
    intersection = len(query_tokens & text_tokens)
    return intersection / max(len(query_tokens), 1)


def choose_best_chunks(question: dict[str, Any], chunks: list[dict[str, Any]], limit: int = 6) -> list[dict[str, Any]]:
    guidance_text = "\n".join(
        item
        for item in [
            question.get("title"),
            question.get("description"),
            question.get("decisionGuidance"),
            question.get("evidenceInstructions"),
            *(question.get("positiveExamples") or []),
            *(question.get("negativeExamples") or []),
        ]
        if item
    )
    ranked = sorted(
        (
            {
                **chunk,
                "_retrieval_score": overlap_score(guidance_text, chunk.get("text", "")),
            }
            for chunk in chunks
        ),
        key=lambda item: (item["_retrieval_score"], item.get("qualityScore") or 0, item.get("charCount") or 0),
        reverse=True,
    )
    selected = [item for item in ranked if item["_retrieval_score"] > 0][:limit]
    return selected or ranked[: min(limit, len(ranked))]


def parse_response_text(response_json: dict[str, Any]) -> str:
    if isinstance(response_json.get("output_text"), str) and response_json["output_text"].strip():
        return response_json["output_text"]

    texts: list[str] = []
    for item in response_json.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                texts.append(content["text"])
    return "\n".join(texts).strip()


def call_openai_structured(prompt: str, schema_name: str, schema: dict[str, Any]) -> dict[str, Any] | None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None

    response = requests.post(
        f"{OPENAI_API_ROOT.rstrip('/')}/responses",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENAI_MODEL,
            "input": [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "You are a careful mapping-study taxonomy analyst. Return only valid JSON that matches the schema.",
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": prompt}],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                }
            },
        },
        timeout=OPENAI_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    parsed_text = parse_response_text(payload)
    if not parsed_text:
        raise ValueError("OpenAI returned an empty structured response")
    return json.loads(parsed_text)


def heuristic_suggestion(record: dict[str, Any], question: dict[str, Any], chunks: list[dict[str, Any]]) -> dict[str, Any]:
    options = question.get("options", [])
    ranked_options = []
    text_blob = "\n".join(chunk.get("text", "") for chunk in chunks)
    lower_blob = text_blob.lower()
    blob_tokens = set(tokenize(text_blob))

    for option in options:
        option_tokens = set(tokenize(option.get("title", "")))
        if not option_tokens:
            continue
        overlap = len(blob_tokens & option_tokens) / max(len(option_tokens), 1)
        title_hit = option.get("title", "").lower() in lower_blob if option.get("title") else False
        score = round((overlap * 70) + (25 if title_hit else 0))
        ranked_options.append((score, option))

    ranked_options.sort(key=lambda item: item[0], reverse=True)
    best_score, best_option = ranked_options[0] if ranked_options else (0, None)

    if best_option and best_score >= 55:
        return {
            "actionType": "reuse_existing",
            "existingOptionId": best_option.get("id"),
            "proposedOptionLabel": None,
            "confidence": min(95, max(60, best_score)),
            "rationale": f'Heuristic fallback matched existing option "{best_option.get("title")}".',
            "reviewerNote": "OPENAI_API_KEY missing; heuristic fallback was used.",
            "evidenceChunkKeys": [chunk.get("chunkKey") for chunk in chunks[:2] if chunk.get("chunkKey")],
        }

    fallback_tokens = tokenize(record.get("title") or "") + tokenize(text_blob)
    unique_tokens = list(dict.fromkeys(fallback_tokens))
    proposed_label = " ".join(unique_tokens[:3]) if unique_tokens else "Emerging Topic"
    proposed_label = proposed_label.title() if proposed_label else "Emerging Topic"
    return {
        "actionType": "create_new",
        "existingOptionId": None,
        "proposedOptionLabel": proposed_label,
        "confidence": 50,
        "rationale": f'Heuristic fallback proposed "{proposed_label}".',
        "reviewerNote": "OPENAI_API_KEY missing; heuristic fallback was used.",
        "evidenceChunkKeys": [chunk.get("chunkKey") for chunk in chunks[:2] if chunk.get("chunkKey")],
    }


def validate_record_decision(decision: dict[str, Any], question: dict[str, Any], chunk_lookup: dict[str, dict[str, Any]]) -> dict[str, Any]:
    option_ids = {option.get("id") for option in question.get("options", [])}
    action_type = decision.get("actionType")
    if action_type not in {"reuse_existing", "create_new", "abstain"}:
        decision["actionType"] = "abstain"
        decision["reviewerNote"] = "Invalid action type was returned and downgraded to abstain."
    if decision.get("existingOptionId") not in option_ids:
        decision["existingOptionId"] = None
        if decision["actionType"] == "reuse_existing":
            decision["actionType"] = "abstain"
            decision["reviewerNote"] = "Model referenced an unknown option and was downgraded to abstain."
    evidence_chunk_keys = [
        chunk_key
        for chunk_key in decision.get("evidenceChunkKeys", [])
        if chunk_key in chunk_lookup
    ]
    if not evidence_chunk_keys:
        decision["actionType"] = "abstain"
        decision["reviewerNote"] = "Model returned no valid evidence spans and was downgraded to abstain."
        evidence_chunk_keys = []
    decision["evidenceChunkKeys"] = evidence_chunk_keys
    if decision.get("actionType") == "create_new" and not decision.get("proposedOptionLabel"):
        decision["actionType"] = "abstain"
        decision["reviewerNote"] = "Model proposed a new option without a label and was downgraded to abstain."
    return decision


def build_record_prompt(record: dict[str, Any], question: dict[str, Any], chunks: list[dict[str, Any]]) -> str:
    option_lines = [
        f'- {option.get("id")}: {option.get("title")}'
        for option in question.get("options", [])
    ]
    evidence_lines = []
    for chunk in chunks:
        label = chunk.get("sectionName") or f'Page {chunk.get("pageStart") or "?"}'
        evidence_lines.append(
            f'[{chunk.get("chunkKey")}] {label} p.{chunk.get("pageStart") or "?"}: {chunk.get("text")}'
        )

    return textwrap.dedent(
        f"""
        Mapping question title: {question.get("title") or ""}
        Mapping question description: {question.get("description") or ""}
        Decision guidance: {question.get("decisionGuidance") or ""}
        Positive examples: {json.dumps(question.get("positiveExamples") or [], ensure_ascii=False)}
        Negative examples: {json.dumps(question.get("negativeExamples") or [], ensure_ascii=False)}
        Evidence instructions: {question.get("evidenceInstructions") or ""}
        Allow new option: {question.get("allowNewOption", True)}

        Record title: {record.get("title") or ""}
        Record abstract: {record.get("abstract") or ""}

        Existing options:
        {os.linesep.join(option_lines) if option_lines else "- No existing options"}

        Evidence chunks:
        {os.linesep.join(evidence_lines)}

        Decide whether the record should reuse an existing option, create a new option, or abstain.
        Always cite the evidence chunk keys that support the decision.
        """
    ).strip()


def build_cluster_prompt(question: dict[str, Any], cluster: dict[str, Any], options: list[dict[str, Any]]) -> str:
    option_lines = [f'- {option.get("id")}: {option.get("title")}' for option in options]
    evidence_lines = [
        f'- record #{item.get("recordId")}: {item.get("excerptText")}'
        for item in cluster.get("supportingEvidence", [])
    ]
    return textwrap.dedent(
        f"""
        Mapping question title: {question.get("title") or ""}
        Mapping question description: {question.get("description") or ""}
        Decision guidance: {question.get("decisionGuidance") or ""}
        Existing options:
        {os.linesep.join(option_lines) if option_lines else "- No existing options"}

        Cluster label candidate: {cluster.get("label") or ""}
        Candidate topics: {json.dumps(cluster.get("tokens", []), ensure_ascii=False)}
        Supporting evidence:
        {os.linesep.join(evidence_lines)}

        Return one taxonomy action: create_new, split_existing, merge_existing, or abstain.
        Use split_existing only when one existing option should be divided into multiple new options.
        Use merge_existing only when two or more existing options are semantically overlapping and should be merged.
        """
    ).strip()


def collect_evidence(chunk_lookup: dict[str, dict[str, Any]], chunk_keys: list[str]) -> list[dict[str, Any]]:
    evidence = []
    for rank, chunk_key in enumerate(chunk_keys, start=1):
        chunk = chunk_lookup.get(chunk_key)
        if not chunk:
            continue
        evidence.append({
            "chunkKey": chunk.get("chunkKey"),
            "pageStart": chunk.get("pageStart"),
            "pageEnd": chunk.get("pageEnd"),
            "sectionName": chunk.get("sectionName"),
            "headingPath": chunk.get("headingPath", []),
            "excerptText": chunk.get("text", "")[:1000],
            "rank": rank,
            "score": chunk.get("_retrieval_score"),
        })
    return evidence


def propose_clusters(suggestions: list[dict[str, Any]], question_lookup: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    by_question: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for suggestion in suggestions:
        if suggestion["actionType"] != "create_new":
            continue
        by_question[suggestion["mappingQuestionId"]].append(suggestion)

    clusters: list[dict[str, Any]] = []
    for question_id, items in by_question.items():
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in items:
            label = (item.get("proposedOptionLabel") or "").lower()
            root = " ".join(tokenize(label)[:2]) or "misc"
            grouped[root].append(item)

        for cluster_index, (cluster_key, cluster_items) in enumerate(grouped.items(), start=1):
            tokens = Counter()
            supporting_evidence = []
            supporting_chunk_keys = []
            supporting_record_ids = []
            for item in cluster_items:
                supporting_record_ids.append(item["recordId"])
                supporting_chunk_keys.extend([e["chunkKey"] for e in item["evidence"] if e.get("chunkKey")])
                for evidence in item["evidence"]:
                    supporting_evidence.append({
                        "recordId": item["recordId"],
                        "excerptText": evidence.get("excerptText"),
                        "pageStart": evidence.get("pageStart"),
                        "sectionName": evidence.get("sectionName"),
                    })
                tokens.update(tokenize(item.get("proposedOptionLabel") or ""))

            question = question_lookup.get(question_id) or {}
            clusters.append({
                "mappingQuestionId": question_id,
                "clusterKey": f"question-{question_id}-cluster-{cluster_index}",
                "label": " ".join(token.title() for token, _count in tokens.most_common(3)) or "Emerging Topic",
                "tokens": [token for token, _count in tokens.most_common(8)],
                "supportingRecordIds": sorted(set(supporting_record_ids)),
                "supportingChunkKeys": sorted(set(supporting_chunk_keys)),
                "supportingEvidence": supporting_evidence[:6],
                "question": question,
            })
    return clusters


def heuristic_cluster_decision(cluster: dict[str, Any]) -> dict[str, Any]:
    return {
        "actionType": "create_new",
        "confidence": 58,
        "rationale": f'Heuristic fallback grouped similar proposed options under "{cluster.get("label")}".',
        "existingOptionIds": [],
        "proposedOptionLabels": [cluster.get("label") or "Emerging Topic"],
    }


def build_report_html(report_json: dict[str, Any]) -> str:
    records_html = []
    for record in report_json["records"]:
        suggestions_html = []
        for suggestion in record["suggestions"]:
            evidence = suggestion["evidenceSpans"][0] if suggestion["evidenceSpans"] else {}
            suggestions_html.append(
                f"""
                <div class="suggestion">
                  <div><strong>{escape(suggestion["actionType"])}</strong> confidence {suggestion["confidence"]}</div>
                  <div>{escape(suggestion["rationale"])}</div>
                  <div class="excerpt">{escape(evidence.get("excerptText", ""))}</div>
                </div>
                """
            )
        records_html.append(
            f"""
            <section class="record">
              <h3>#{record["id"]} {escape(record.get("title") or "(untitled)")}</h3>
              {''.join(suggestions_html)}
            </section>
            """
        )

    cluster_rows = []
    for cluster in report_json["clusters"]:
        cluster_rows.append(
            f"""
            <tr>
              <td>{escape(cluster.get("mappingQuestionTitle") or "")}</td>
              <td>{escape(cluster.get("actionType") or "")}</td>
              <td>{escape(cluster.get("label") or "")}</td>
              <td>{cluster.get("confidence")}</td>
            </tr>
            """
        )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{escape(report_json["title"])}</title>
  <style>
    body {{ font-family: sans-serif; margin: 2rem; color: #1f2937; }}
    h1, h2, h3 {{ margin-bottom: 0.5rem; }}
    .record {{ border-top: 1px solid #d1d5db; padding: 1rem 0; }}
    .suggestion {{ margin: 0.75rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 0.5rem; }}
    .excerpt {{ color: #374151; font-style: italic; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #d1d5db; padding: 0.5rem; text-align: left; }}
  </style>
</head>
<body>
  <h1>{escape(report_json["title"])}</h1>
  <p>Model: {escape(report_json["run"]["model"])}, extractor: {escape(report_json["run"]["extractor"])}</p>
  <p>Reuse existing: {report_json["summary"]["actionCounts"]["reuse_existing"]}, create new: {report_json["summary"]["actionCounts"]["create_new"]}, split: {report_json["summary"]["actionCounts"]["split_existing"]}, merge: {report_json["summary"]["actionCounts"]["merge_existing"]}, abstain: {report_json["summary"]["actionCounts"]["abstain"]}</p>
  <h2>Taxonomy Actions</h2>
  <table>
    <thead><tr><th>Question</th><th>Action</th><th>Label</th><th>Confidence</th></tr></thead>
    <tbody>{''.join(cluster_rows) or '<tr><td colspan="4">No cluster actions</td></tr>'}</tbody>
  </table>
  <h2>Records</h2>
  {''.join(records_html)}
</body>
</html>"""


def create_report(
    app_data_dir: str,
    job_id: str,
    records: list[dict[str, Any]],
    questions: list[dict[str, Any]],
    summary: dict[str, Any],
    suggestions: list[dict[str, Any]],
    clusters: list[dict[str, Any]],
) -> str:
    question_lookup = {question["id"]: question for question in questions}
    records_payload = []
    for record in records:
        records_payload.append({
            "id": record["id"],
            "title": record.get("title"),
            "suggestions": [
                suggestion
                for suggestion in suggestions
                if suggestion["recordId"] == record["id"]
            ],
        })

    report_json = {
        "title": f"Keywording audit report {job_id}",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "run": {
            "model": OPENAI_MODEL,
            "extractor": "pymupdf+grobid+ocr",
        },
        "summary": summary,
        "questions": questions,
        "records": records_payload,
        "clusters": [
            {
                **cluster,
                "mappingQuestionTitle": question_lookup.get(cluster["mappingQuestionId"], {}).get("title"),
            }
            for cluster in clusters
        ],
    }

    report_dir = Path(app_data_dir) / "storage" / "keywording-reports" / job_id
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = report_dir / "report.json"
    html_path = report_dir / "report.html"
    zip_path = report_dir / "keywording-report.zip"

    json_path.write_text(json.dumps(report_json, indent=2) + "\n", encoding="utf-8")
    html_path.write_text(build_report_html(report_json), encoding="utf-8")

    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as archive:
        archive.write(json_path, arcname="report.json")
        archive.write(html_path, arcname="report.html")

    return relpath_from_app_data(app_data_dir, zip_path)


def run_keywording(payload: dict[str, Any]) -> dict[str, Any]:
    app_data_dir = str(payload["appDataDir"])
    records = payload["records"]
    questions = payload["mappingQuestions"]
    question_lookup = {question["id"]: question for question in questions}
    suggestions: list[dict[str, Any]] = []
    action_counts = {
        "reuse_existing": 0,
        "create_new": 0,
        "split_existing": 0,
        "merge_existing": 0,
        "abstain": 0,
    }
    skipped_records = []
    failed_records = []
    low_confidence_count = 0
    manual_review_count = 0
    quality_failed_record_count = 0

    record_by_id = {record["id"]: record for record in records}

    decision_schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["actionType", "existingOptionId", "proposedOptionLabel", "confidence", "rationale", "reviewerNote", "evidenceChunkKeys"],
        "properties": {
            "actionType": {
                "type": "string",
                "enum": ["reuse_existing", "create_new", "abstain"],
            },
            "existingOptionId": {
                "type": ["integer", "null"],
            },
            "proposedOptionLabel": {
                "type": ["string", "null"],
            },
            "confidence": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
            },
            "rationale": {"type": "string"},
            "reviewerNote": {"type": ["string", "null"]},
            "evidenceChunkKeys": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
    }

    for record in records:
        document = record.get("document")
        if not document:
            skipped_records.append({
                "recordId": record["id"],
                "title": record.get("title"),
                "reason": "No extracted PDF available.",
            })
            continue
        if document.get("qualityStatus") == "failed":
            quality_failed_record_count += 1
            skipped_records.append({
                "recordId": record["id"],
                "title": record.get("title"),
                "reason": "Document extraction failed quality checks.",
            })
            continue

        chunk_manifest_path = Path(app_data_dir) / document["chunkManifestPath"]
        if not chunk_manifest_path.exists():
            failed_records.append({
                "recordId": record["id"],
                "title": record.get("title"),
                "reason": "Chunk manifest is missing from storage.",
            })
            continue

        chunks = json.loads(chunk_manifest_path.read_text("utf-8"))
        chunk_lookup = {chunk["chunkKey"]: chunk for chunk in chunks}

        for question in questions:
            selected_chunks = choose_best_chunks(question, chunks)
            prompt = build_record_prompt(record, question, selected_chunks)
            try:
                raw_decision = call_openai_structured(prompt, "mapping_record_decision", decision_schema)
            except Exception as error:
                raw_decision = heuristic_suggestion(record, question, selected_chunks)
                raw_decision["reviewerNote"] = f"{raw_decision.get('reviewerNote') or ''} GPT call failed: {error}".strip()

            if raw_decision is None:
                raw_decision = heuristic_suggestion(record, question, selected_chunks)

            decision = validate_record_decision(raw_decision, question, chunk_lookup)
            evidence = collect_evidence(chunk_lookup, decision.get("evidenceChunkKeys", []))
            suggestion = {
                "recordId": record["id"],
                "mappingQuestionId": question["id"],
                "actionType": decision["actionType"],
                "decisionType": "existing-option" if decision["actionType"] == "reuse_existing" else "new-option",
                "existingOptionId": decision.get("existingOptionId"),
                "proposedOptionLabel": decision.get("proposedOptionLabel"),
                "confidence": int(decision.get("confidence") or 0),
                "rationale": decision.get("rationale") or "",
                "reviewerNote": decision.get("reviewerNote"),
                "evidence": evidence,
            }
            suggestions.append(suggestion)
            action_counts[suggestion["actionType"]] += 1
            if suggestion["confidence"] < 60:
                low_confidence_count += 1
            if suggestion["actionType"] == "abstain" or suggestion.get("reviewerNote"):
                manual_review_count += 1

    proposed_clusters = propose_clusters(suggestions, question_lookup)
    cluster_schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["actionType", "confidence", "rationale", "existingOptionIds", "proposedOptionLabels"],
        "properties": {
            "actionType": {
                "type": "string",
                "enum": ["create_new", "split_existing", "merge_existing", "abstain"],
            },
            "confidence": {"type": "integer", "minimum": 0, "maximum": 100},
            "rationale": {"type": "string"},
            "existingOptionIds": {
                "type": "array",
                "items": {"type": "integer"},
            },
            "proposedOptionLabels": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
    }
    clusters = []
    for cluster in proposed_clusters:
        question = question_lookup.get(cluster["mappingQuestionId"], {})
        try:
            cluster_decision = call_openai_structured(
                build_cluster_prompt(question, cluster, question.get("options", [])),
                "mapping_cluster_decision",
                cluster_schema,
            )
        except Exception:
            cluster_decision = heuristic_cluster_decision(cluster)

        if cluster_decision is None:
            cluster_decision = heuristic_cluster_decision(cluster)

        action_type = cluster_decision.get("actionType")
        if action_type not in {"create_new", "split_existing", "merge_existing", "abstain"}:
            action_type = "abstain"

        clusters.append({
            "mappingQuestionId": cluster["mappingQuestionId"],
            "clusterKey": cluster["clusterKey"],
            "label": cluster["label"],
            "actionType": action_type,
            "confidence": int(cluster_decision.get("confidence") or 0),
            "rationale": cluster_decision.get("rationale") or "",
            "existingOptionIds": cluster_decision.get("existingOptionIds", []),
            "proposedOptionLabels": cluster_decision.get("proposedOptionLabels", []),
            "supportingRecordIds": cluster["supportingRecordIds"],
            "supportingChunkKeys": cluster["supportingChunkKeys"],
            "supportingEvidence": cluster["supportingEvidence"],
        })
        action_counts[action_type] += 1
        if int(cluster_decision.get("confidence") or 0) < 60:
            low_confidence_count += 1
            manual_review_count += 1

    summary = {
        "existingSuggestionCount": sum(1 for item in suggestions if item["actionType"] == "reuse_existing"),
        "newSuggestionCount": sum(1 for item in suggestions if item["actionType"] == "create_new"),
        "lowConfidenceCount": low_confidence_count,
        "clusterDecisionCount": len(clusters),
        "manualReviewCount": manual_review_count,
        "qualityFailedRecordCount": quality_failed_record_count,
        "actionCounts": action_counts,
        "skippedRecords": skipped_records,
        "failedRecords": failed_records,
    }

    report_path = create_report(app_data_dir, payload["jobId"], records, questions, summary, suggestions, clusters)
    for suggestion in suggestions:
        record = record_by_id.get(suggestion["recordId"]) or {}
        suggestion["mappingQuestionTitle"] = question_lookup.get(suggestion["mappingQuestionId"], {}).get("title")
        suggestion["recordTitle"] = record.get("title")

    return {
        "reportPath": report_path,
        "summary": summary,
        "suggestions": suggestions,
        "clusters": clusters,
    }
