from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from pipeline import extract_document, run_keywording


class ExtractionRequest(BaseModel):
    recordId: int
    documentId: int
    absolutePdfPath: str
    appDataDir: str
    relativePdfPath: str | None = None


class KeywordingJobRequest(BaseModel):
    jobId: str
    appDataDir: str
    records: list[dict[str, Any]]
    mappingQuestions: list[dict[str, Any]]


app = FastAPI(title="mapping-study-toolbox keywording worker")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract-document")
def extract_document_endpoint(payload: ExtractionRequest) -> dict[str, Any]:
    try:
        return extract_document(payload.model_dump())
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/keywording-jobs/run")
def run_keywording_endpoint(payload: KeywordingJobRequest) -> dict[str, Any]:
    try:
        return run_keywording(payload.model_dump())
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
