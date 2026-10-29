import type { FastifyInstance, FastifyReply } from "fastify";
import type { ChannelLedger } from "../ledger.js";
import type { Refusal } from "../rules.js";

/**
 * The participant's side of the API (spec §6.2). The only routes a participant
 * channel would ever have: send a message, see the conversation, try again.
 * Registered here, and only here, so that what a participant can reach is one
 * file's worth of code.
 */

interface Params {
  id: string;
}

function refuse(reply: FastifyReply, refusal: Refusal): FastifyReply {
  return reply.code(refusal.code).send({ error: refusal.reason });
}

function choiceOf(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const choice = (body as Record<string, unknown>)["choice"];
  return typeof choice === "string" ? choice : undefined;
}

function textOf(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const text = (body as Record<string, unknown>)["text"];
  return typeof text === "string" ? text : undefined;
}

export function registerMessageRoutes(app: FastifyInstance, ledger: ChannelLedger): void {
  app.get<{ Params: Params }>("/api/conversations/:id/messages", (request, reply) => {
    const view = ledger.view(request.params.id);
    return view === undefined
      ? refuse(reply, { code: 404, reason: "unknown-conversation" })
      : reply.send(view);
  });

  // Text the person typed, or since slice 0004 a choice they picked: `{ text }` or `{ choice }`.
  app.post<{ Params: Params }>("/api/conversations/:id/messages", (request, reply) => {
    const choice = choiceOf(request.body);
    const text = textOf(request.body);
    if (choice === undefined && text === undefined) {
      return refuse(reply, { code: 400, reason: "empty" });
    }
    const check =
      choice !== undefined
        ? ledger.acceptChoice(request.params.id, choice)
        : ledger.accept(request.params.id, text ?? "");
    return check.ok ? reply.code(202).send({ accepted: true }) : refuse(reply, check);
  });

  app.post<{ Params: Params }>("/api/conversations/:id/retry", (request, reply) => {
    const outcome = ledger.retry(request.params.id, textOf(request.body));
    return outcome.ok ? reply.code(202).send({ accepted: true }) : refuse(reply, outcome);
  });
}
