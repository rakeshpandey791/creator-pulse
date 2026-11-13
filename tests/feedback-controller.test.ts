import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { FeedbackController } from "../apps/api/src/feedback/feedback.controller.js";
import {
  FeedbackService,
  InMemoryFeedbackStore,
} from "../apps/api/src/feedback/feedback.service.js";

function setup() {
  const store = new InMemoryFeedbackStore();
  store.ideas.add("idea-1");
  const service = new FeedbackService(
    store,
    () => new Date("2026-11-13T10:00:00.000Z"),
  );
  const identity = {
    authenticate: vi.fn(async (token: string) => {
      if (token !== "valid-token") throw new UnauthorizedException();
      return { id: "creator-a" };
    }),
  };
  return {
    controller: new FeedbackController(service, identity as never),
    identity,
  };
}

describe("IDE-02 feedback controller boundary", () => {
  it("rejects unauthenticated feedback before reaching persistence", async () => {
    const { controller, identity } = setup();
    await expect(
      controller.submit("idea-1", { rating: 5 }, undefined),
    ).rejects.toThrow(UnauthorizedException);
    expect(identity.authenticate).toHaveBeenCalledWith("");
  });

  it("authenticates the route and makes repeated submissions safe", async () => {
    const { controller } = setup();
    const first = await controller.submit(
      "idea-1",
      { rating: 4, reasonCodes: ["too_generic"] },
      "Bearer valid-token",
    );
    const second = await controller.submit(
      "idea-1",
      { rating: 4, reasonCodes: ["too_generic"] },
      "Bearer valid-token",
    );
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("blocks abusive distinct submissions at the API boundary", async () => {
    const { controller } = setup();
    for (let index = 0; index < 20; index += 1) {
      await controller.submit(
        "idea-1",
        { rating: (index % 5) + 1, comment: `feedback-${index}` },
        "Bearer valid-token",
      );
    }
    await expect(
      controller.submit(
        "idea-1",
        { rating: 5, comment: "one more" },
        "Bearer valid-token",
      ),
    ).rejects.toThrow("Feedback limit reached");
  });
});
