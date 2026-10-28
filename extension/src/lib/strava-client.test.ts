import { describe, expect, it, vi } from "vitest";
import { fakeGpx, fakeModel, HTML_PAGE, jsonResponse, textResponse } from "../test/fixtures";
import {
  backoffMs,
  DEFAULT_BACKOFF_MS,
  fetchGpx,
  fetchListPage,
  RateLimitError,
  SignInError,
  StravaError,
  type Fetch,
} from "./strava-client";

const noWait = vi.fn(() => Promise.resolve());

function redirectedTo(url: string, body: string): Response {
  const response = textResponse(body, { headers: { "Content-Type": "text/html" } });
  Object.defineProperty(response, "redirected", { value: true });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("fetchListPage", () => {
  it("sends cookies and the XHR headers and reads the page", async () => {
    const fetchFn = vi.fn<Fetch>(() =>
      Promise.resolve(
        jsonResponse({ models: [fakeModel({ id: 1 })], page: 1, perPage: 20, total: 1 }),
      ),
    );
    const page = await fetchListPage(fetchFn, 1, "session-1", noWait);
    expect(page.total).toBe(1);
    expect(page.models).toHaveLength(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toContain("page=1");
    expect(url).toContain("search_session_id=session-1");
    expect(init?.credentials).toBe("include");
    expect(init?.headers).toEqual({
      Accept: "application/json, text/javascript",
      "X-Requested-With": "XMLHttpRequest",
    });
  });

  it.each([
    ["a 401", () => textResponse("", { status: 401 })],
    ["a 403", () => textResponse("", { status: 403 })],
    [
      "a redirect to the sign-in page",
      () => redirectedTo("https://www.strava.com/login", HTML_PAGE),
    ],
    ["an HTML page", () => textResponse(HTML_PAGE, { headers: { "Content-Type": "text/html" } })],
    ["JSON without models", () => jsonResponse({ error: "nope" })],
  ])("asks to sign in after %s", async (_, response) => {
    await expect(
      fetchListPage(() => Promise.resolve(response()), 1, "s", noWait),
    ).rejects.toBeInstanceOf(SignInError);
  });

  it("reports other errors", async () => {
    await expect(
      fetchListPage(() => Promise.resolve(textResponse("", { status: 502 })), 1, "s", noWait),
    ).rejects.toBeInstanceOf(StravaError);
    await expect(
      fetchListPage(() => Promise.reject(new TypeError("Failed to fetch")), 1, "s", noWait),
    ).rejects.toBeInstanceOf(StravaError);
  });

  it("waits and retries once on 429", async () => {
    const wait = vi.fn(() => Promise.resolve());
    const fetchFn = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(textResponse("", { status: 429, headers: { "Retry-After": "5" } }))
      .mockResolvedValueOnce(jsonResponse({ models: [], total: 0 }));
    await fetchListPage(fetchFn, 1, "s", wait);
    expect(wait).toHaveBeenCalledWith(5000, undefined);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("gives up after a second 429", async () => {
    const fetchFn = vi.fn<Fetch>(() => Promise.resolve(textResponse("", { status: 429 })));
    await expect(fetchListPage(fetchFn, 1, "s", noWait)).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("backoffMs", () => {
  it("uses Retry-After, capped, or a default", () => {
    expect(backoffMs(textResponse("", { headers: { "Retry-After": "2" } }))).toBe(2000);
    expect(backoffMs(textResponse("", { headers: { "Retry-After": "99999" } }))).toBe(900_000);
    expect(backoffMs(textResponse(""))).toBe(DEFAULT_BACKOFF_MS);
  });
});

describe("fetchGpx", () => {
  const respond = (response: Response) => () => Promise.resolve(response);

  it("downloads the GPX of the activity with cookies", async () => {
    const fetchFn = vi.fn<Fetch>(respond(textResponse(fakeGpx([{ t: 0, lat: 1, lon: 2 }]))));
    const result = await fetchGpx(fetchFn, 42, noWait);
    expect(result.kind).toBe("gpx");
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://www.strava.com/activities/42/export_gpx");
    expect(fetchFn.mock.calls[0]?.[1]?.credentials).toBe("include");
  });

  it.each([
    ["a GPX without track points", () => textResponse(fakeGpx([]))],
    ["an HTML page", () => textResponse(HTML_PAGE)],
    ["a 404", () => textResponse("Not found", { status: 404 })],
  ])("is no_gpx for %s", async (_, response) => {
    expect(await fetchGpx(() => Promise.resolve(response()), 1, noWait)).toEqual({
      kind: "no_gpx",
    });
  });

  it("throws for 5xx and network errors (the ride is marked failed)", async () => {
    await expect(
      fetchGpx(respond(textResponse("", { status: 503 })), 1, noWait),
    ).rejects.toBeInstanceOf(StravaError);
    await expect(
      fetchGpx(() => Promise.reject(new TypeError("offline")), 1, noWait),
    ).rejects.toBeInstanceOf(StravaError);
  });

  it("asks to sign in after a redirect to the sign-in page", async () => {
    await expect(
      fetchGpx(respond(redirectedTo("https://www.strava.com/login", HTML_PAGE)), 1, noWait),
    ).rejects.toBeInstanceOf(SignInError);
  });
});
