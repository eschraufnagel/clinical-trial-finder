import { describe, expect, it } from "vitest";
import { type InboundMessage, MemoryTransport } from "../../src/transport/index.js";

/** Choices on the transport (slice 0004): buttons an agent message offers, besides free text. */
function opened(): { transport: MemoryTransport; received: InboundMessage[] } {
  const transport = new MemoryTransport();
  const received: InboundMessage[] = [];
  transport.onMessage((m) => received.push(m));
  transport.open("c1", [], "working");
  transport.deliver("c1", "Do you have HIV?", [
    { id: "no", label: "No" },
    { id: "unknown", label: "I don't know" },
  ]);
  transport.setStatus("c1", "idle");
  return { transport, received };
}

describe("choices", () => {
  it("are shown on the agent message that offers them, and only there", () => {
    const { transport } = opened();
    transport.deliver("c1", "No choices here.");
    const messages = transport.view("c1")?.messages ?? [];
    expect(messages[0]?.choices).toEqual([
      { id: "no", label: "No" },
      { id: "unknown", label: "I don't know" },
    ]);
    expect(messages[1]).not.toHaveProperty("choices");
  });

  it("are taken like text: recorded with their label, handed on with their id, then working", () => {
    const { transport, received } = opened();
    expect(transport.choose("c1", "unknown")).toEqual({ ok: true, text: "I don't know" });
    expect(received).toEqual([{ conversationId: "c1", text: "I don't know", choice: "unknown" }]);
    expect(transport.view("c1")?.messages.at(-1)).toEqual({
      seq: 1,
      from: "participant",
      text: "I don't know",
      choice: "unknown",
      state: "pending",
    });
    expect(transport.view("c1")?.status).toBe("working");
  });

  it("refuse a choice the last agent message didn't offer, changing nothing", () => {
    const { transport, received } = opened();
    transport.deliver("c1", "Next question, no buttons.");
    expect(transport.choose("c1", "no")).toEqual({ ok: false, code: 409, reason: "not-a-choice" });
    expect(transport.choose("c1", "maybe")).toMatchObject({ reason: "not-a-choice" });
    expect(received).toEqual([]);
    expect(transport.view("c1")?.status).toBe("idle");
  });

  it("follow the status rules: refused while working, after done, or for an unknown conversation", () => {
    const { transport } = opened();
    transport.setStatus("c1", "working");
    expect(transport.choose("c1", "no")).toMatchObject({ code: 409, reason: "working" });
    transport.setStatus("c1", "done");
    expect(transport.choose("c1", "no")).toMatchObject({ code: 409, reason: "done" });
    expect(transport.choose("nope", "no")).toMatchObject({ code: 404 });
  });

  it("leave text replies as they were", () => {
    const { transport, received } = opened();
    expect(transport.send("c1", "Never had it.").ok).toBe(true);
    expect(received).toEqual([{ conversationId: "c1", text: "Never had it." }]);
  });
});
