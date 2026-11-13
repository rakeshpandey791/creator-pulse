import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi, clearAuth, getAccessToken } from "../apps/web/lib/api";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("web authenticated API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearAuth();
  });

  it("rotates with the stored refresh token and retries the request", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
    localStorage.setItem("creatorpulse.accessToken", "expired-access");
    localStorage.setItem("creatorpulse.refreshToken", "refresh-one");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Invalid access token" }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "fresh-access",
            refreshToken: "refresh-two",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profileVersion: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await authApi.saveProfile("expired-access", {
      audience: { description: "Creators" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      refreshToken: "refresh-one",
    });
    expect(
      new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("Authorization"),
    ).toBe("Bearer fresh-access");
    expect(getAccessToken()).toBe("fresh-access");
  });
});
