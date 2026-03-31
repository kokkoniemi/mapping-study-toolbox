from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from pipeline import extract_document, run_keywording, warm_start_advanced_components


logger = logging.getLogger("mapping-study-toolbox.keywording-worker")


class ExtractionRequest(BaseModel):
    recordId: int
    documentId: int
    absolutePdfPath: str
    appDataDir: str
    relativePdfPath: str | None = None


class KeywordingJobRequest(BaseModel):
    jobId: str
    appDataDir: str
    analysisMode: str = "standard"
    reuseEmbeddingCache: bool = True
    records: list[dict[str, Any]]
    mappingQuestions: list[dict[str, Any]]


app = FastAPI(title="mapping-study-toolbox keywording worker")


@app.on_event("startup")
def warm_start_models() -> None:
    warm_start_advanced_components()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract-document")
def extract_document_endpoint(payload: ExtractionRequest) -> dict[str, Any]:
    try:
        return extract_document(payload.model_dump())
    except Exception as error:
        logger.exception("Document extraction failed for record %s document %s", payload.recordId, payload.documentId)
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/keywording-jobs/run")
def run_keywording_endpoint(payload: KeywordingJobRequest) -> dict[str, Any]:
    try:
        return run_keywording(payload.model_dump())
    except Exception as error:
        logger.exception("Keywording job %s failed in %s mode", payload.jobId, payload.analysisMode)
        raise HTTPException(status_code=400, detail=str(error)) from error
