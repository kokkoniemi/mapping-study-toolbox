from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


sys.modules.setdefault("fitz", types.SimpleNamespace())

PIPELINE_PATH = Path(__file__).with_name("pipeline.py")
SPEC = importlib.util.spec_from_file_location("worker_pipeline_under_test", PIPELINE_PATH)
assert SPEC and SPEC.loader
pipeline = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = pipeline
SPEC.loader.exec_module(pipeline)


class AdvancedKeywordingReportTests(unittest.TestCase):
    def test_advanced_keywording_is_record_first_and_report_driven(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            app_data_dir = Path(temp_dir)
            chunk_manifest = app_data_dir / "chunks.json"
            chunk_manifest.write_text(json.dumps([
                {
                    "chunkKey": "chunk-1",
                    "pageStart": 1,
                    "pageEnd": 1,
                    "sectionName": "Abstract",
                    "headingPath": ["Abstract"],
                    "text": "CTMTC shapes course design and teamwork assessment.",
                    "charCount": 52,
                    "tokenCount": 8,
                    "qualityScore": 0.98,
                },
                {
                    "chunkKey": "chunk-2",
                    "pageStart": 2,
                    "pageEnd": 2,
                    "sectionName": "Findings",
                    "headingPath": ["Findings"],
                    "text": "Students use a team communication space during the exercise.",
                    "charCount": 61,
                    "tokenCount": 10,
                    "qualityScore": 0.95,
                },
            ]), encoding="utf-8")

            payload = {
                "jobId": "job-advanced-record-first",
                "appDataDir": str(app_data_dir),
                "analysisMode": "advanced",
                "reuseEmbeddingCache": True,
                "records": [
                    {
                        "id": 1,
                        "title": "Record A",
                        "abstract": "Abstract",
                        "document": {
                            "id": 11,
                            "chunkManifestPath": "chunks.json",
                            "qualityStatus": "passed",
                        },
                    }
                ],
                "mappingQuestions": [
                    {
                        "id": 101,
                        "title": "Pedagogical use",
                        "description": "",
                        "decisionGuidance": "",
                        "positiveExamples": [],
                        "negativeExamples": [],
                        "evidenceInstructions": "",
                        "options": [{"id": 201, "title": "Affected course design"}],
                    },
                    {
                        "id": 102,
                        "title": "Usage (teaching vechile)",
                        "description": "",
                        "decisionGuidance": "",
                        "positiveExamples": [],
                        "negativeExamples": [],
                        "evidenceInstructions": "",
                        "options": [],
                    },
                    {
                        "id": 103,
                        "title": "Theories as teaching vechile",
                        "description": "",
                        "decisionGuidance": "",
                        "positiveExamples": [],
                        "negativeExamples": [],
                        "evidenceInstructions": "",
                        "options": [],
                    },
                ],
            }

            def fake_decision(prompt: str, _schema_name: str, _schema: dict[str, object]) -> dict[str, object]:
                if "Mapping question title: Pedagogical use" in prompt:
                    return {
                        "actionType": "reuse_existing",
                        "existingOptionId": 201,
                        "proposedOptionLabel": None,
                        "confidence": 92,
                        "rationale": "This should keep the existing option.",
                        "reviewerNote": None,
                        "evidenceChunkKeys": ["chunk-1"],
                    }
                if "Mapping question title: Usage (teaching vechile)" in prompt:
                    return {
                        "actionType": "create_new",
                        "existingOptionId": None,
                        "proposedOptionLabel": "Team communication space",
                        "confidence": 84,
                        "rationale": "This should create a new option.",
                        "reviewerNote": "Generalize if more tools appear.",
                        "evidenceChunkKeys": ["chunk-2"],
                    }
                return {
                    "actionType": "abstain",
                    "existingOptionId": None,
                    "proposedOptionLabel": None,
                    "confidence": 73,
                    "rationale": "This should be left out.",
                    "reviewerNote": "Insufficient evidence for a direct mapping.",
                    "evidenceChunkKeys": ["chunk-1"],
                }

            with patch.object(pipeline, "call_openai_structured", side_effect=fake_decision):
                result = pipeline.run_keywording_advanced(payload)

            self.assertEqual(result["analysisMode"], "advanced")
            self.assertIsNone(result["embeddingModel"])
            self.assertIsNone(result["representationModel"])
            self.assertIsNone(result["bertopicVersion"])
            self.assertFalse(result["topicReductionApplied"])
            self.assertEqual(result["clusters"], [])
            self.assertEqual(result["cacheSummary"], {"hits": 0, "misses": 0, "writes": 0})

            report_json_path = app_data_dir / "storage" / "keywording-reports" / payload["jobId"] / "report.json"
            report_html_path = app_data_dir / "storage" / "keywording-reports" / payload["jobId"] / "report.html"
            report_json = json.loads(report_json_path.read_text(encoding="utf-8"))
            report_html = report_html_path.read_text(encoding="utf-8")

            self.assertEqual(len(report_json["suggestions"]), 3)
            self.assertEqual(len(report_json["records"][0]["suggestions"]), 3)
            self.assertEqual(report_json["clusters"], [])
            self.assertEqual(report_json["run"]["analysisMode"], "advanced")
            self.assertIsNone(report_json["run"]["embeddingModel"])
            self.assertIsNone(report_json["run"]["representationModel"])
            self.assertIsNone(report_json["run"]["bertopicVersion"])
            self.assertEqual(report_json["summary"]["clusterDecisionCount"], 0)

            question_summaries = {item["mappingQuestionId"]: item for item in report_json["questionSummaries"]}
            self.assertEqual(question_summaries[101]["keep"][0]["existingOptionTitle"], "Affected course design")
            self.assertEqual(question_summaries[102]["create"][0]["proposedOptionLabel"], "Team communication space")
            self.assertEqual(question_summaries[103]["leaveOut"][0]["summary"], "Insufficient evidence for a direct mapping.")

            self.assertIn("Record Decisions", report_html)
            self.assertIn("Question Summaries", report_html)
            self.assertNotIn("Topic Appendix", report_html)


if __name__ == "__main__":
    unittest.main()
