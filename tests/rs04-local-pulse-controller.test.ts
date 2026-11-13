import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { LocalPulseController } from "../apps/api/src/research/local-pulse.controller.js";

describe("RS-04 local pulse controller boundary", () => {
  it("requires authentication before reading creator-scoped context", async () => {
    const identity = {
      authenticate: vi.fn(async () => {
        throw new UnauthorizedException();
      }),
    };
    const pulse = { getForCreator: vi.fn() };
    const controller = new LocalPulseController(
      pulse as never,
      identity as never,
    );

    await expect(controller.get(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(pulse.getForCreator).not.toHaveBeenCalled();
    expect(identity.authenticate).toHaveBeenCalledWith("");
  });

  it("passes the authenticated creator identity to the pulse service", async () => {
    const identity = {
      authenticate: vi.fn(async () => ({ id: "creator-a" })),
    };
    const pulse = {
      getForCreator: vi.fn(async () => ({ coverage: "unavailable" })),
    };
    const controller = new LocalPulseController(
      pulse as never,
      identity as never,
    );

    await expect(controller.get("Bearer valid-token")).resolves.toEqual({
      coverage: "unavailable",
    });
    expect(pulse.getForCreator).toHaveBeenCalledWith("creator-a");
  });
});
