import type {
  ChannelMessage,
  ChannelStatus,
  Choice,
  InboundMessage,
  MessageTransport,
} from "./types.js";

/**
 * One transport shared by several services (slice 0007): the conversation
 * and the check. A `MessageTransport` takes one message handler, so each
 * service gets its own view of the transport, and an inbound message goes to
 * the service that opened its conversation. Outbound calls pass straight
 * through. The services still know nothing of how messages are delivered.
 */
export function routeByConversation(transport: MessageTransport): () => MessageTransport {
  const owners = new Map<string, Route>();
  transport.onMessage((m) => owners.get(m.conversationId)?.message?.(m));
  transport.onRetry((id) => owners.get(id)?.retry?.(id));

  return () => {
    const route: Route = {};
    return {
      onMessage: (handler) => {
        route.message = handler;
      },
      onRetry: (handler) => {
        route.retry = handler;
      },
      open: (id: string, history: readonly ChannelMessage[], status: ChannelStatus, detail?) => {
        owners.set(id, route);
        transport.open(id, history, status, detail);
      },
      deliver: (id: string, text: string, choices?: readonly Choice[]) =>
        transport.deliver(id, text, choices),
      setStatus: (id: string, status: ChannelStatus, detail?: string) =>
        transport.setStatus(id, status, detail),
      close: (id: string) => {
        owners.delete(id);
        transport.close(id);
      },
    };
  };
}

interface Route {
  message?: (message: InboundMessage) => void;
  retry?: (conversationId: string) => void;
}
