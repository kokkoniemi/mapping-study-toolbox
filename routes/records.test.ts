import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  Sequelize: {
    Op: {
      or: Symbol("or"),
      substring: Symbol("substring"),
    },
  },
  Record: {
    count: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
  },
  MappingOption: {
    findByPk: vi.fn(),
  },
  RecordMappingOption: {
    create: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock("../models", () => ({ default: dbMock }));

import { createOption, listing, removeOption, update } from "./records";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;

  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/records", () => {
  beforeEach(() => {
    dbMock.Record.count.mockReset();
    dbMock.Record.findAll.mockReset();
    dbMock.Record.findByPk.mockReset();
    dbMock.MappingOption.findByPk.mockReset();
    dbMock.RecordMappingOption.create.mockReset();
    dbMock.RecordMappingOption.destroy.mockReset();
  });

  it("listing returns count + records with applied filters", async () => {
    dbMock.Record.count.mockResolvedValue(2);
    dbMock.Record.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const req = {
      query: { offset: "5", limit: "10", status: "null", search: "programming" },
    } as unknown as Request;
    const res = mockResponse();

    await listing(req, res);

    expect(dbMock.Record.count).toHaveBeenCalledTimes(1);
    const where = dbMock.Record.count.mock.calls[0]?.[0]?.where as Record<PropertyKey, unknown>;
    expect(where.status).toBeNull();
    expect((where[dbMock.Sequelize.Op.or] as unknown[]).length).toBe(4);

    expect(dbMock.Record.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 5, limit: 10, include: ["Publication", "MappingOptions"] }),
    );
    expect(res.send).toHaveBeenCalledWith({ count: 2, records: [{ id: 1 }, { id: 2 }] });
  });

  it("update rejects invalid status", async () => {
    const req = {
      params: { id: "1" },
      body: { status: "bad-status" },
    } as unknown as Request;
    const res = mockResponse();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbMock.Record.findByPk).not.toHaveBeenCalled();
  });

  it("update writes allowed fields and returns updated record", async () => {
    const record = { update: vi.fn().mockResolvedValue(undefined), id: 1 };
    dbMock.Record.findByPk.mockResolvedValue(record);

    const req = {
      params: { id: "1" },
      body: { status: "included", comment: "ok", editedBy: "mk" },
    } as unknown as Request;
    const res = mockResponse();

    await update(req, res);

    expect(dbMock.Record.findByPk).toHaveBeenCalledWith(1, { include: ["Publication", "MappingOptions"] });
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "included", comment: "ok", editedBy: "mk" }),
    );
    expect(res.send).toHaveBeenCalledWith(record);
  });

  it("createOption links option to record and returns option", async () => {
    dbMock.RecordMappingOption.create.mockResolvedValue({});
    dbMock.MappingOption.findByPk.mockResolvedValue({ id: 55, title: "Tag" });

    const req = {
      params: { recordId: "42" },
      body: { mappingOptionId: "55", mappingQuestionId: "9" },
    } as unknown as Request;
    const res = mockResponse();

    await createOption(req, res);

    expect(dbMock.RecordMappingOption.create).toHaveBeenCalledWith({
      recordId: 42,
      mappingQuestionId: 9,
      mappingOptionId: 55,
    });
    expect(dbMock.MappingOption.findByPk).toHaveBeenCalledWith(55);
    expect(res.send).toHaveBeenCalledWith({ id: 55, title: "Tag" });
  });

  it("removeOption deletes relation and returns success message", async () => {
    dbMock.RecordMappingOption.destroy.mockResolvedValue(1);

    const req = {
      params: { mappingOptionId: "12", recordId: "3" },
    } as unknown as Request;
    const res = mockResponse();

    await removeOption(req, res);

    expect(dbMock.RecordMappingOption.destroy).toHaveBeenCalledWith({
      where: { mappingOptionId: 12, recordId: 3 },
    });
    expect(res.send).toHaveBeenCalledWith("12 deleted successfully");
  });
});
