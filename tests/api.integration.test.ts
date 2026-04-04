import { spawnSync } from "node:child_process";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  Forum: {
    findAll: vi.fn(),
    destroy: vi.fn(),
  },
  Sequelize: {
    fn: vi.fn((name: string, ...args: unknown[]) => ({ fn: name, args })),
    col: vi.fn((name: string) => ({ col: name })),
  },
  sequelize: {
    transaction: vi.fn(async (handler: (transaction: Record<string, unknown>) => Promise<void>) =>
      handler({ tx: true })),
  },
  Record: {
    count: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
    update: vi.fn(),
  },
  MappingOption: {
    count: vi.fn(),
    create: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
  },
  MappingQuestion: {
    count: vi.fn(),
    create: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
  },
  RecordMappingOption: {
    create: vi.fn(),
    destroy: vi.fn(),
    findOne: vi.fn(),
  },
}));

const enrichmentMock = vi.hoisted(() => ({
  createEnrichmentJob: vi.fn(),
  getEnrichmentJob: vi.fn(),
  cancelEnrichmentJob: vi.fn(),
  getEnrichmentQueueStatus: vi.fn(),
}));

const importPipelineMock = vi.hoisted(() => ({
  previewImportData: vi.fn(),
  createImportData: vi.fn(),
  listImports: vi.fn(),
  deleteImportWithRecords: vi.fn(),
}));

const recordDocumentsMock = vi.hoisted(() => ({
  listRecordDocuments: vi.fn(),
  getRecordDocument: vi.fn(),
  uploadRecordDocument: vi.fn(),
  deleteRecordDocument: vi.fn(),
  extractRecordDocument: vi.fn(),
}));

const keywordingMock = vi.hoisted(() => ({
  createKeywordingJob: vi.fn(),
  listKeywordingJobs: vi.fn(),
  getKeywordingJob: vi.fn(),
  cancelKeywordingJob: vi.fn(),
  deleteKeywordingJob: vi.fn(),
  getKeywordingReport: vi.fn(),
}));

vi.mock("../models", () => ({
  default: dbMock,
}));
vi.mock("../lib/recordEnrichment", () => enrichmentMock);
vi.mock("../lib/importPipeline", () => importPipelineMock);
vi.mock("../lib/recordDocuments", () => recordDocumentsMock);
vi.mock("../lib/keywording", () => keywordingMock);

import { createApp } from "../server";

const canListenToSocket = (() => {
  const result = spawnSync(process.execPath, [
    "-e",
    "require('node:net').createServer().listen(0,'127.0.0.1',function(){this.close(()=>process.exit(0))}).on('error',()=>process.exit(1))",
  ]);
  return result.status === 0;
})();

const describeWhenSocketAllowed = canListenToSocket ? describe : describe.skip;

describeWhenSocketAllowed("API integration", () => {
  beforeEach(() => {
    dbMock.Forum.findAll.mockReset();
    dbMock.Forum.destroy.mockReset();
    dbMock.sequelize.transaction.mockClear();
    dbMock.Record.count.mockReset();
    dbMock.Record.findAll.mockReset();
    dbMock.Record.findByPk.mockReset();
    dbMock.Record.update.mockReset();

    dbMock.MappingOption.count.mockReset();
    dbMock.MappingOption.create.mockReset();
    dbMock.MappingOption.findAll.mockReset();
    dbMock.MappingOption.findByPk.mockReset();

    dbMock.MappingQuestion.count.mockReset();
    dbMock.MappingQuestion.create.mockReset();
    dbMock.MappingQuestion.findAll.mockReset();
    dbMock.MappingQuestion.findByPk.mockReset();

    dbMock.RecordMappingOption.create.mockReset();
    dbMock.RecordMappingOption.destroy.mockReset();
    dbMock.RecordMappingOption.findOne.mockReset();
    enrichmentMock.createEnrichmentJob.mockReset();
    enrichmentMock.getEnrichmentJob.mockReset();
    enrichmentMock.cancelEnrichmentJob.mockReset();
    enrichmentMock.getEnrichmentQueueStatus.mockReset();
    enrichmentMock.getEnrichmentQueueStatus.mockReturnValue({
      queuedJobs: 0,
      runningJobs: 0,
      maxQueuedJobs: 20,
    });
    importPipelineMock.previewImportData.mockReset();
    importPipelineMock.createImportData.mockReset();
    importPipelineMock.listImports.mockReset();
    importPipelineMock.deleteImportWithRecords.mockReset();
    recordDocumentsMock.listRecordDocuments.mockReset();
    recordDocumentsMock.getRecordDocument.mockReset();
    recordDocumentsMock.uploadRecordDocument.mockReset();
    recordDocumentsMock.deleteRecordDocument.mockReset();
    recordDocumentsMock.extractRecordDocument.mockReset();
    keywordingMock.createKeywordingJob.mockReset();
    keywordingMock.listKeywordingJobs.mockReset();
    keywordingMock.getKeywordingJob.mockReset();
    keywordingMock.cancelKeywordingJob.mockReset();
    keywordingMock.deleteKeywordingJob.mockReset();
    keywordingMock.getKeywordingReport.mockReset();
  });

  it("GET /api/health returns ok", async () => {
    const app = createApp();

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("GET /api/records returns contract shape", async () => {
    dbMock.Record.count.mockResolvedValue(2);
    dbMock.Record.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const app = createApp();
    const response = await request(app).get("/api/records").query({ offset: 0, limit: 25 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 2, records: [{ id: 1 }, { id: 2 }] });
  });

  it("GET /api/records with invalid limit returns standardized validation error", async () => {
    const app = createApp();

    const response = await request(app).get("/api/records").query({ limit: -5 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("POST /api/records/export returns csv attachment", async () => {
    dbMock.Record.findAll.mockResolvedValue([{ id: 1, title: "Exported record" }]);

    const app = createApp();
    const response = await request(app)
      .post("/api/records/export")
      .send({
        format: "csv",
        scope: "all_filtered",
        fields: ["id", "title"],
        filters: {},
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(response.text).toContain("\"ID\",\"Title\"");
    expect(response.text).toContain("\"1\",\"Exported record\"");
  });

  it("PUT /api/records/:id with invalid status returns standardized validation error", async () => {
    const app = createApp();

    const response = await request(app).put("/api/records/1").send({ status: "bad" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("PATCH /api/records/:id updates record fields", async () => {
    const record = {
      id: 1,
      status: "uncertain",
      title: "Updated",
      update: vi.fn().mockResolvedValue(undefined),
    };
    dbMock.Record.findByPk.mockResolvedValue(record);

    const app = createApp();
    const response = await request(app).patch("/api/records/1").send({
      title: "Updated",
      status: "uncertain",
      databases: ["scopus"],
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 1,
      title: "Updated",
      status: "uncertain",
    });
    expect(record.update).toHaveBeenCalledWith({
      title: "Updated",
      status: "uncertain",
      databases: ["scopus"],
    });
  });

  it("PATCH /api/records/:id with invalid alternateUrls returns standardized validation error", async () => {
    const app = createApp();

    const response = await request(app).patch("/api/records/1").send({
      alternateUrls: "https://example.com",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("GET /api/records/:id missing record returns NOT_FOUND", async () => {
    dbMock.Record.findByPk.mockResolvedValue(null);

    const app = createApp();
    const response = await request(app).get("/api/records/999");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
      },
    });
  });

  it("POST /api/records/enrichment-jobs creates enrichment job", async () => {
    enrichmentMock.createEnrichmentJob.mockReturnValue({
      jobId: "job-1",
      status: "queued",
      total: 2,
      processed: 0,
      createdAt: "2026-03-09T00:00:00.000Z",
      startedAt: null,
      finishedAt: null,
      results: [],
      updatedRecords: [],
    });

    const app = createApp();
    const response = await request(app).post("/api/records/enrichment-jobs").send({ recordIds: [1, 2] });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      jobId: "job-1",
      status: "queued",
      total: 2,
      processed: 0,
    });
  });

  it("POST /api/records/:recordId/documents accepts multipart PDF uploads", async () => {
    recordDocumentsMock.uploadRecordDocument.mockResolvedValue({
      id: 7,
      recordId: 1,
      originalFileName: "paper.pdf",
      extractionStatus: "pending",
    });

    const app = createApp();
    const response = await request(app)
      .post("/api/records/1/documents")
      .attach("file", Buffer.from("%PDF-1.4 test"), { filename: "paper.pdf", contentType: "application/pdf" });

    expect(response.status).toBe(201);
    expect(recordDocumentsMock.uploadRecordDocument).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        fileName: "paper.pdf",
        contentType: "application/pdf",
      }),
    );
    expect(response.body).toMatchObject({
      id: 7,
      recordId: 1,
      originalFileName: "paper.pdf",
    });
  });

  it("GET /api/records/:recordId/documents returns contract shape", async () => {
    recordDocumentsMock.listRecordDocuments.mockResolvedValue({
      count: 1,
      documents: [{ id: 3, recordId: 1 }],
    });

    const app = createApp();
    const response = await request(app).get("/api/records/1/documents");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      count: 1,
      documents: [{ id: 3, recordId: 1 }],
    });
  });

  it("GET /api/forums/duplicates returns grouped duplicate payload", async () => {
    dbMock.Forum.findAll.mockResolvedValue([
      {
        id: 1,
        name: "Forum A",
        alternateNames: [],
        issn: "1234-5678",
        publisher: "Pub",
        jufoLevel: 2,
      },
      {
        id: 2,
        name: "forum a",
        alternateNames: [],
        issn: "1234-5678",
        publisher: "Pub",
        jufoLevel: 2,
      },
    ]);
    dbMock.Record.findAll.mockResolvedValue([
      { forumId: 1, recordCount: 5 },
      { forumId: 2, recordCount: 3 },
    ]);

    const app = createApp();
    const response = await request(app).get("/api/forums/duplicates").query({ offset: 0, limit: 25 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      count: 1,
      groups: [
        {
          count: 2,
        },
      ],
    });
  });

  it("POST /api/forums/merge supports dryRun", async () => {
    dbMock.Forum.findAll.mockResolvedValue([
      {
        id: 10,
        name: "Target",
        alternateNames: [],
        issn: null,
        publisher: null,
        jufoLevel: null,
        jufoId: null,
        enrichmentProvenance: null,
        update: vi.fn().mockResolvedValue(undefined),
      },
      {
        id: 11,
        name: "Source",
        alternateNames: ["Source Alias"],
        issn: "1111-1111",
        publisher: "Pub",
        jufoLevel: 2,
        jufoId: 200,
        enrichmentProvenance: null,
      },
    ]);
    dbMock.Record.findAll.mockResolvedValue([{ id: 501 }, { id: 502 }]);

    const app = createApp();
    const response = await request(app).post("/api/forums/merge").send({
      targetForumId: 10,
      sourceForumIds: [11],
      dryRun: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      dryRun: true,
      targetForumId: 10,
      sourceForumIds: [11],
      movedRecordCount: 2,
      updatedRecordIds: [501, 502],
    });
  });

  it("POST /api/imports/preview returns preview payload", async () => {
    importPipelineMock.previewImportData.mockResolvedValue({
      detectedFormat: "csv",
      detectedSource: "scopus",
      databaseLabel: "SCOPUS",
      csvColumns: ["Title", "Year"],
      suggestedCsvMapping: { title: "Title", year: "Year", doi: null, url: null, author: null },
      appliedCsvMapping: { title: "Title", year: "Year", doi: null, url: null, author: null },
      total: 2,
      parsed: 2,
      newRecords: 1,
      duplicates: 1,
      invalid: 0,
      warnings: [],
      records: [],
    });

    const app = createApp();
    const response = await request(app).post("/api/imports/preview").send({
      fileName: "scopus.csv",
      content: "Title,Year\nOne,2024",
      source: "auto",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      detectedFormat: "csv",
      detectedSource: "scopus",
      total: 2,
    });
  });

  it("POST /api/imports creates import and returns summary", async () => {
    importPipelineMock.createImportData.mockResolvedValue({
      import: {
        id: 10,
        database: "SCOPUS",
        source: "scopus",
        format: "csv",
        fileName: "scopus.csv",
        total: 2,
        imported: 1,
        dublicates: 1,
        namesakes: null,
        query: null,
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z",
        recordCount: 1,
      },
      summary: {
        detectedFormat: "csv",
        detectedSource: "scopus",
        databaseLabel: "SCOPUS",
        csvColumns: ["Title", "Year"],
        suggestedCsvMapping: { title: "Title", year: "Year", doi: null, url: null, author: null },
        appliedCsvMapping: { title: "Title", year: "Year", doi: null, url: null, author: null },
        total: 2,
        parsed: 1,
        newRecords: 1,
        duplicates: 1,
        invalid: 0,
        warnings: [],
        records: [],
      },
      createdRecordIds: [100],
    });

    const app = createApp();
    const response = await request(app).post("/api/imports").send({
      fileName: "scopus.csv",
      content: "Title,Year\nOne,2024",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      import: {
        id: 10,
        imported: 1,
      },
      createdRecordIds: [100],
    });
  });

  it("GET /api/imports returns import history", async () => {
    importPipelineMock.listImports.mockResolvedValue({
      count: 1,
      imports: [
        {
          id: 10,
          database: "SCOPUS",
          source: "scopus",
          format: "csv",
          fileName: "scopus.csv",
          total: 2,
          imported: 1,
          dublicates: 1,
          namesakes: null,
          query: null,
          createdAt: "2026-03-11T00:00:00.000Z",
          updatedAt: "2026-03-11T00:00:00.000Z",
          recordCount: 1,
        },
      ],
    });

    const app = createApp();
    const response = await request(app).get("/api/imports").query({ offset: 0, limit: 25 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      count: 1,
      imports: [{ id: 10 }],
    });
  });

  it("DELETE /api/imports/:id deletes import and imported records", async () => {
    importPipelineMock.deleteImportWithRecords.mockResolvedValue({
      importId: 10,
      deletedImport: true,
      deletedRecords: 7,
    });

    const app = createApp();
    const response = await request(app).delete("/api/imports/10");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      importId: 10,
      deletedImport: true,
      deletedRecords: 7,
    });
  });

  it("POST /api/keywording-jobs creates a keywording job", async () => {
    keywordingMock.createKeywordingJob.mockResolvedValue({
      id: 1,
      jobId: "kw-1",
      status: "queued",
      cancelRequested: false,
      total: 2,
      processed: 0,
      recordIds: [1, 2],
      mappingQuestionIds: [5],
      analysisMode: "standard",
      reuseEmbeddingCache: true,
      embeddingModel: null,
      representationModel: null,
      bertopicVersion: null,
      topicReductionApplied: false,
      topicCountBeforeReduction: null,
      topicCountAfterReduction: null,
      downgradedTopicCount: 0,
      topicArtifactPath: null,
      cacheSummary: { hits: 0, misses: 0, writes: 0 },
      reportPath: null,
      reportReady: false,
      createdAt: "2026-03-30T00:00:00.000Z",
      startedAt: null,
      finishedAt: null,
      latestError: null,
      summary: {
        existingSuggestionCount: 0,
        newSuggestionCount: 0,
        lowConfidenceCount: 0,
        clusterDecisionCount: 0,
        manualReviewCount: 0,
        qualityFailedRecordCount: 0,
        outlierTopicCount: 0,
        actionCounts: {
          reuse_existing: 0,
          create_new: 0,
          split_existing: 0,
          merge_existing: 0,
          abstain: 0,
        },
        skippedRecords: [],
        failedRecords: [],
      },
    });

    const app = createApp();
    const response = await request(app).post("/api/keywording-jobs").send({
      recordIds: [1, 2],
      mappingQuestionIds: [5],
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      jobId: "kw-1",
      status: "queued",
      total: 2,
      processed: 0,
    });
  });

  it("GET /api/keywording-jobs/:jobId/report returns a zip attachment", async () => {
    keywordingMock.getKeywordingReport.mockResolvedValue({
      fileName: "keywording-report-kw-1.zip",
      contentType: "application/zip",
      content: Buffer.from("zip"),
    });

    const app = createApp();
    const response = await request(app).get("/api/keywording-jobs/kw-1/report");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/zip");
    expect(response.headers["content-disposition"]).toContain("keywording-report-kw-1.zip");
  });

  it("DELETE /api/keywording-jobs/:jobId deletes a terminal job", async () => {
    keywordingMock.deleteKeywordingJob.mockResolvedValue({
      jobId: "kw-1",
      status: "completed",
    });

    const app = createApp();
    const response = await request(app).delete("/api/keywording-jobs/kw-1");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId: "kw-1",
      status: "completed",
    });
  });

  it("GET /api/records/enrichment-jobs/:id returns created job", async () => {
    enrichmentMock.getEnrichmentJob.mockReturnValue({
      jobId: "job-2",
      status: "completed",
      total: 1,
      processed: 1,
      createdAt: "2026-03-09T00:00:00.000Z",
      startedAt: "2026-03-09T00:00:01.000Z",
      finishedAt: "2026-03-09T00:00:02.000Z",
      results: [{ recordId: 1, status: "enriched", doi: "10.1016/x" }],
      updatedRecords: [{ id: 1 }],
    });

    const app = createApp();
    const response = await request(app).get("/api/records/enrichment-jobs/job-2");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId: "job-2",
      status: "completed",
      processed: 1,
    });
  });

  it("POST /api/records/enrichment-jobs/:id/cancel cancels job", async () => {
    enrichmentMock.cancelEnrichmentJob.mockReturnValue({
      jobId: "job-3",
      status: "cancelled",
      total: 5,
      processed: 2,
      createdAt: "2026-03-09T00:00:00.000Z",
      startedAt: "2026-03-09T00:00:01.000Z",
      finishedAt: "2026-03-09T00:00:02.000Z",
      results: [],
      updatedRecords: [],
    });

    const app = createApp();
    const response = await request(app).post("/api/records/enrichment-jobs/job-3/cancel").send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId: "job-3",
      status: "cancelled",
    });
  });

  it("GET unknown route returns standardized NOT_FOUND error", async () => {
    const app = createApp();

    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  it("unhandled server errors are wrapped into INTERNAL_ERROR", async () => {
    dbMock.MappingQuestion.count.mockRejectedValue(new Error("db down"));

    const app = createApp();
    const response = await request(app).get("/api/mapping-questions");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  });
});
