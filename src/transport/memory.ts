import { ChannelLedger } from "./ledger.js";
import type { InboundCheck } from "./rules.js";

/**
 * A transport with no delivery at all: a test sends a message and reads what
 * came back. It exists so the conversation service can be shown to work
 * without HTTP, which is half of what makes the transport boundary real.
 */
export class MemoryTransport extends ChannelLedger {
  send(conversationId: string, text: string): InboundCheck {
    return this.accept(conversationId, text);
  }

  /** Picks one of the last agent message's choices (slice 0004). */
  choose(conversationId: string, choiceId: string): InboundCheck {
    return this.acceptChoice(conversationId, choiceId);
  }

  /** Agent messages delivered so far, in order. */
  delivered(conversationId: string): string[] {
    return (this.view(conversationId)?.messages ?? [])
      .filter((m) => m.from === "agent")
      .map((m) => m.text);
  }
}
