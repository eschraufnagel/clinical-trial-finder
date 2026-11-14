import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { ChannelView } from "../transport/ledger.js";
import { poll, sendAgain, sendChoice, sendMessage } from "../transport/web/client.js";
import { COPY } from "./copy.js";
import { asksToChoose, isConfirm } from "./logic.js";

const POLL_MS = 400;

/**
 * The parts of a conversation on the transport that the questions and the
 * check share (slice 0007): the messages, polled, and the reply box with its
 * choices and the confirm step. Neither knows which service is answering.
 */

/** Where a typed reply goes, and who reads it, as the server's view says. */
export interface ReaderNote {
  model: string;
  measured: boolean;
  hosted: string | null;
}

export function useChannel(id: string) {
  const [channel, setChannel] = useState<ChannelView | undefined>();
  const [gone, setGone] = useState(false);

  const refresh = useCallback(async () => {
    const next = await poll(id).catch(() => undefined);
    if (next === undefined) setGone(true);
    else setChannel(next);
  }, [id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { channel, gone, refresh };
}

type Refresh = ReturnType<typeof useChannel>["refresh"];

export function Messages({
  id,
  channel,
  refresh,
  working,
}: {
  id: string;
  channel: ChannelView | undefined;
  refresh: Refresh;
  /** What to say while the server works. */
  working: string;
}) {
  const t = COPY.conversation;
  const status = channel?.status;
  const messages = channel?.messages ?? [];
  const lastAgent = messages.findLast((m) => m.from === "agent")?.seq;
  // A question is an agent message offering answers other than a confirm. Its
  // number is drawn by CSS from `data-label`, so the message's own text, which
  // the browser test reads, stays as it arrived (slice 0011).
  let asked = 0;
  return (
    <>
      <ol className="messages no-print" aria-live="polite">
        {messages.map((m) => {
          const reading = m.from === "agent" && isConfirm(m.choices);
          const question = m.from === "agent" && !reading && (m.choices?.length ?? 0) > 0;
          if (question) asked += 1;
          const current = m.seq === lastAgent;
          const classes = [m.from, reading ? "reading" : "", current ? "current" : ""];
          return (
            <li
              key={m.seq}
              className={classes.filter((c) => c !== "").join(" ")}
              data-label={current && question ? t.question(asked) : undefined}
            >
              {m.text}
            </li>
          );
        })}
      </ol>
      {status === "working" ? <p className="working no-print">{working}</p> : null}
      {status === "failed" || status === "unavailable" ? (
        <div className="no-print chooser">
          <p className="error-line" role="alert">
            {t.failed}
          </p>
          <div>
            <button
              type="button"
              className="secondary"
              onClick={() => void sendAgain(id).then(refresh)}
            >
              {t.tryAgain}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function Reply({
  id,
  channel,
  refresh,
  reader,
  unfold = false,
  readerExtra = null,
}: {
  id: string;
  channel: ChannelView | undefined;
  refresh: Refresh;
  reader: ReaderNote | undefined;
  /** Show the choices as buttons, not folded under "Choose an answer". */
  unfold?: boolean;
  /** A further note beside "Read by …". */
  readerExtra?: string | null;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const t = COPY.conversation;
  const last = channel?.messages.findLast((m) => m.from === "agent");
  const confirming = isConfirm(last?.choices);
  const choosing = asksToChoose(last?.text);

  // A new question closes the answer list again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the last message is the trigger
  useEffect(() => setOpen(false), [last?.seq]);

  if (channel?.status !== "idle") return null;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() === "") return;
    const outcome = await sendMessage(id, text);
    if (outcome.ok) setText("");
    await refresh();
  };
  const choose = async (choice: string) => {
    await sendChoice(id, choice);
    await refresh();
  };
  // The confirm's first choice is the primary action; every answer to a
  // question is the same quiet button, "I don't know" among them.
  const buttons = last?.choices?.map((c, i) => (
    <button
      key={c.id}
      type="button"
      className={confirming && i === 0 ? undefined : "secondary"}
      onClick={() => void choose(c.id)}
    >
      {c.label}
    </button>
  ));

  return (
    <div className="no-print">
      {confirming ? (
        <div className="confirm">
          <div className="confirm-actions">{buttons}</div>
          {reader === undefined ? null : (
            <p className="confirm-meta">
              {t.readBy(reader.model)} {reader.measured ? null : t.unmeasured} {readerExtra}
            </p>
          )}
        </div>
      ) : null}
      {!confirming && unfold ? <div className="answers chooser">{buttons}</div> : null}

      <form className="composer reply" onSubmit={send}>
        <label className="field-label" htmlFor={`reply-${id}`}>
          {t.reply}
        </label>
        <textarea
          id={`reply-${id}`}
          className="composer-input"
          name="reply"
          rows={unfold ? 2 : 3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) void send(e);
          }}
        />
        <div className="composer-footer">
          <p className="composer-note">
            {reader?.hosted == null ? t.local : t.hosted(reader.hosted)}
          </p>
          <button type="submit">{t.send}</button>
        </div>
        {!confirming && !unfold && (last?.choices?.length ?? 0) > 0 ? (
          <details
            className="chooser"
            open={open || choosing}
            onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="chooser-label">{t.choose}</summary>
            <div className="answers">{buttons}</div>
          </details>
        ) : null}
      </form>
    </div>
  );
}
