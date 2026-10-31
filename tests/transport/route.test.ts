import { describe, expect, it } from "vitest";
import type { InboundMessage } from "../../src/transport/index.js";
import { MemoryTransport, routeByConversation } from "../../src/transport/index.js";

/** Two services on one transport: each hears only the conversations it opened. */
describe("routeByConversation", () => {
  it("hands each message and retry to the service that opened the conversation", () => {
    const transport = new MemoryTransport();
    const route = routeByConversation(transport);
    const a = route();
    const b = route();
    const heard: Record<string, string[]> = { a: [], b: [] };
    a.onMessage((m: InboundMessage) => heard["a"]?.push(m.text));
    b.onMessage((m: InboundMessage) => heard["b"]?.push(m.text));
    const retried: string[] = [];
    b.onRetry((id) => retried.push(id));

    a.open("one", [], "idle");
    b.open("two", [], "idle");
    a.deliver("one", "Question one?");
    b.deliver("two", "Question two?");
    transport.send("one", "first");
    transport.send("two", "second");
    expect(heard).toEqual({ a: ["first"], b: ["second"] });

    b.setStatus("two", "failed");
    transport.retry("two");
    expect(retried).toEqual(["two"]);

    b.close("two");
    expect(transport.view("two")).toBeUndefined();
    expect(transport.send("two", "lost").ok).toBe(false);
    expect(heard["b"]).toEqual(["second"]);
  });
});
