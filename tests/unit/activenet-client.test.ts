import { describe, expect, it, vi } from "vitest";
import { ActiveNetError, createActiveNetClient, DEFAULT_BASE_URL } from "@/lib/activenet/client";
import { createThrottle } from "@/lib/activenet/throttle";
import { ActiveNetShapeError } from "@/lib/activenet/validate";
import { fixture } from "./fixtures";

/** A client whose fetch returns `response` and records each call. */
function clientReturning(response: unknown, init: { status?: number } = {}) {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(typeof response === "string" ? response : JSON.stringify(response), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = createActiveNetClient({
    fetch: fetchMock,
    throttle: createThrottle({ minIntervalMs: 0 }),
  });
  const call = (i = 0) => {
    const [url, options] = fetchMock.mock.calls[i];
    return {
      url: String(url),
      options: options!,
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
    };
  };
  return { client, fetchMock, call };
}

describe("ActiveNet client requests", () => {
  it("getFilters posts calendar_id as a string", async () => {
    const { client, call } = clientReturning(fixture("filters.3.json"));
    const body = await client.getFilters(3);
    expect(call().url).toBe(`${DEFAULT_BASE_URL}/onlinecalendar/filters?locale=en-US`);
    expect(call().options.method).toBe("POST");
    expect(call().body).toEqual({ calendar_id: "3" });
    expect(body.center.length).toBeGreaterThan(0);
    expect(body.center[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
  });

  it("getEvents posts calendar_id as a number with the centre ids", async () => {
    const { client, call } = clientReturning(fixture("events.3.json"));
    const body = await client.getEvents(3, [290, 248]);
    expect(call().url).toBe(`${DEFAULT_BASE_URL}/onlinecalendar/multicenter/events`);
    expect(call().body).toMatchObject({
      calendar_id: 3,
      center_ids: [290, 248],
      search_start_time: "",
      search_end_time: "",
    });
    expect(body.center_events[0].events.length).toBeGreaterThan(0);
  });

  it("getActivityDetail requests the activity by id", async () => {
    const { client, call } = clientReturning(fixture("detail.3.open.json"));
    const { detail } = await client.getActivityDetail(166860);
    expect(call().url).toBe(`${DEFAULT_BASE_URL}/activity/detail/166860?locale=en-US`);
    expect(call().options.method).toBe("GET");
    expect(detail.space_status).toMatch(/^\d+ openings? remaining$/);
  });

  it("getButtonStatus URL-encodes the session start", async () => {
    const { client, call } = clientReturning(fixture("buttonstatus.3.enroll.json"));
    await client.getButtonStatus(166860, "2026-11-14 16:30:00");
    expect(call().url).toBe(
      `${DEFAULT_BASE_URL}/activity/detail/buttonstatus/166860?selected_date=2026-11-14+16%3A30%3A00&locale=en-US`,
    );
  });

  it("sends a User-Agent only when one is configured", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(fixture("filters.1.json"))));
    const throttle = createThrottle({ minIntervalMs: 0 });
    await createActiveNetClient({ fetch: fetchMock as never, throttle }).getFilters(1);
    await createActiveNetClient({
      fetch: fetchMock as never,
      throttle,
      userAgent: "test-agent",
    }).getFilters(1);
    const headers = fetchMock.mock.calls.map(
      (c) => (c as unknown[])[1] as { headers: Record<string, string> },
    );
    expect(headers[0].headers["User-Agent"]).toBeUndefined();
    expect(headers[1].headers["User-Agent"]).toBe("test-agent");
  });

  it("validates arguments before making a request", () => {
    const { client, fetchMock } = clientReturning({});
    expect(() => client.getFilters(2 as never)).toThrow(RangeError);
    expect(() => client.getEvents(1, [])).toThrow(RangeError);
    expect(() => client.getEvents(1, [1.5])).toThrow(RangeError);
    expect(() => client.getActivityDetail(0)).toThrow(RangeError);
    expect(() => client.getButtonStatus(1, "2026-11-14")).toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ActiveNet client errors", () => {
  it("throws ActiveNetError on an HTTP error", async () => {
    const { client } = clientReturning("Service Unavailable", { status: 503 });
    await expect(client.getFilters(1)).rejects.toMatchObject({
      name: "ActiveNetError",
      status: 503,
    });
  });

  it("throws ActiveNetError when the body is not JSON", async () => {
    const { client } = clientReturning("<html>maintenance</html>");
    await expect(client.getFilters(1)).rejects.toThrow(ActiveNetError);
  });

  it("throws ActiveNetError when response_code is not 0000", async () => {
    const { client } = clientReturning({
      headers: { response_code: "0001", response_message: "Something went wrong" },
      body: {},
    });
    await expect(client.getFilters(1)).rejects.toMatchObject({
      responseCode: "0001",
      message: expect.stringContaining("Something went wrong"),
    });
  });

  it("throws ActiveNetShapeError naming the field when the shape changes", async () => {
    const changed = fixture("events.1.json");
    const events = (
      changed.body.center_events as Array<{ events: Array<Record<string, unknown>> }>
    )[0].events;
    events[1].start_time = "2026-11-14T09:00:00Z";
    const { client } = clientReturning(changed);
    await expect(client.getEvents(1, [290])).rejects.toThrow(ActiveNetShapeError);
    await expect(client.getEvents(1, [290])).rejects.toThrow(
      "body.center_events[0].events[1].start_time",
    );
  });
});
