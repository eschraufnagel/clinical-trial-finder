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
  return (
    <>
      <ol className="messages no-print" aria-live="polite">
        {(channel?.messages ?? []).map((m) => (
          <li key={m.seq} className={m.from}>
            {m.text}
          </li>
        ))}
      </ol>
      {status === "working" ? <p className="working no-print">{working}</p> : null}
      {status === "failed" || status === "unavailable" ? (
        <p className="problem no-print">
          {t.failed}{" "}
          <button type="button" onClick={() => void sendAgain(id).then(refresh)}>
            {t.tryAgain}
          </button>
        </p>
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
  const buttons = last?.choices?.map((c) => (
    <button key={c.id} type="button" onClick={() => void choose(c.id)}>
      {c.label}
    </button>
  ));

  return (
    <div className="no-print">
      {confirming ? (
        <div className="confirm">
          {buttons}
          {reader === undefined ? null : (
            <p className="note">
              {t.readBy(reader.model)} {reader.measured ? null : t.unmeasured} {readerExtra}
            </p>
          )}
        </div>
      ) : null}
      {!confirming && unfold ? <div className="choices">{buttons}</div> : null}

      <form className="reply" onSubmit={send}>
        <label>
          {t.reply}
          <textarea
            name="reply"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) void send(e);
            }}
          />
        </label>
        <p className="note">{reader?.hosted == null ? t.local : t.hosted(reader.hosted)}</p>
        <button type="submit">{t.send}</button>
        {!confirming && !unfold && (last?.choices?.length ?? 0) > 0 ? (
          <details
            open={open || choosing}
            onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary>{t.choose}</summary>
            <div className="choices">{buttons}</div>
          </details>
        ) : null}
      </form>
    </div>
  );
}
