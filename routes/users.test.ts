import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/http";

const dbMock = vi.hoisted(() => ({
  UserProfile: {
    findAll: vi.fn(),
    findByPk: vi.fn(),
    findOne: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../models", () => ({ default: dbMock }));

import { create, listing, update } from "./users";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;

  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/users", () => {
  beforeEach(() => {
    dbMock.UserProfile.findAll.mockReset();
    dbMock.UserProfile.findByPk.mockReset();
    dbMock.UserProfile.findOne.mockReset();
    dbMock.UserProfile.count.mockReset();
    dbMock.UserProfile.create.mockReset();
  });

  it("listing returns profile list and count", async () => {
    dbMock.UserProfile.findAll.mockResolvedValue([
      { id: 1, name: "Alice", isActive: true },
      { id: 2, name: "Bob", isActive: false },
    ]);
    const res = mockResponse();

    await listing({} as Request, res);

    expect(dbMock.UserProfile.findAll).toHaveBeenCalledWith({ order: [["name", "ASC"]] });
    expect(res.send).toHaveBeenCalledWith({
      count: 2,
      users: [{ id: 1, name: "Alice", isActive: true }, { id: 2, name: "Bob", isActive: false }],
    });
  });

  it("create persists a new profile", async () => {
    dbMock.UserProfile.findAll.mockResolvedValue([]);
    dbMock.UserProfile.create.mockResolvedValue({ id: 3, name: "Charlie", isActive: true });
    const req = {
      body: { name: "Charlie" },
    } as unknown as Request;
    const res = mockResponse();

    await create(req, res);

    expect(dbMock.UserProfile.create).toHaveBeenCalledWith({ name: "Charlie", isActive: true });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith({ id: 3, name: "Charlie", isActive: true });
  });

  it("update rejects deactivating the last active profile", async () => {
    const user = {
      id: 1,
      isActive: true,
      update: vi.fn(),
    };
    dbMock.UserProfile.findByPk.mockResolvedValue(user);
    dbMock.UserProfile.count.mockResolvedValue(1);

    const req = {
      params: { id: "1" },
      body: { isActive: false },
    } as unknown as Request;
    const res = mockResponse();

    await expect(update(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(user.update).not.toHaveBeenCalled();
  });
});
