# Gate 1: spend on dev, and freeze the bar?

**Question:** run one dev reading on Claude Haiku 4.5 with the reader's schema enforced, paid, with the cap below; and fix now, before any of its output is seen, the bar that decides whether held-out is read (plan, Gate 1; spec §5.1, §5.2).

## What changed (steps 2 to 4)

- **The Anthropic request now carries the reader's answer schema** as structured output. The prompt's words are unchanged, so the prompt version is still `8cb01749`. The local model, OpenAI and xAI send exactly what they sent before.
- **A run that enforced the schema writes its own file,** `…-8cb01749-schema.json`, and records `schema: "enforced"`. 0004's Haiku file is never resumed or overwritten.
- **A run now prints the share read at all,** and every rejection and failure with its reason.
- **Settings counts only a run of the request the app sends now.** So Claude Haiku 4.5 reads "unmeasured" in Settings from step 4 until a held-out run with the schema is committed. `--fake` reads the local model's files only.
- `npm run check`, the browser test and every `--check` are as at step 1. The two `other:eval` checks fail on `main` too, on a label checksum from 0005, unrelated (plan Records, step 1).

### The request, for one reading

The body `anthropicBody` builds for the activity question, with a made-up reply. The system prompt is the reader's, unchanged.

```json
{
  "model": "claude-haiku-4-5",
  "max_tokens": 64,
  "system": "<READER_SYSTEM_PROMPT, unchanged>",
  "messages": [
    {
      "role": "user",
      "content": "Question: Which is closest to how you are day to day?\nAnswers:\n- \"ps0\": Fully active, as before the illness\n- \"ps1\": Up and about, but can't do heavy work\n- \"ps2\": Up more than half the day, can't work\n- \"ps3_4\": In bed or a chair half the day or more\n- \"unknown\": the reply doesn't say\n\nReply: \"I can do most things but I tire out by the afternoon.\""
    }
  ],
  "temperature": 0,
  "output_config": {
    "format": {
      "type": "json_schema",
      "schema": {
        "type": "object",
        "properties": { "answer": { "type": "string", "enum": ["ps0", "ps1", "ps2", "ps3_4", "unknown"] } },
        "required": ["answer"],
        "additionalProperties": false
      }
    }
  }
}
```

Without a schema, the body is byte for byte what it was (`tests/models/anthropic.test.ts`). The field names were checked against the live structured-outputs page: no beta header, Haiku 4.5 supported, `anthropic-version: 2023-06-01`.

## The run

```
npm run questions:read -- --set dev --model anthropic:claude-haiku-4-5 --spend --max-calls 150 --max-usd 0.10
```

The dry run, nothing sent:

```
reader on anthropic:claude-haiku-4-5: 3 patients' replies (dev)
  expected  93 calls, 39,824 input and 1,116 output tokens, about $0.045
  at most   $0.10: 150 calls (the cap) at the largest prompt and full output would be $0.12, and the run stops at $0.10 (--max-usd)
  prices as of 2026-09; spent so far on this project $0.63 over 5 paid run(s)
```

- The estimate runs high: on held-out it counts about twice the input 0004's run used on the same pairs. Expect about $0.02 to $0.03.
- Temperature 0, no seed (the Claude API has none), reasoning off, prompt `8cb01749`, schema enforced.
- **If the first call is refused as a bad request,** the body's field names are wrong. A 400 isn't retried or billed. I fix the body in its own commit and run again under this same go-ahead and cap.

For Gate 2, held-out's dry run is already printed: 527 calls, about $0.26 expected (0004's run cost $0.15), at most $0.48 under `--max-calls 600 --max-usd 0.50`.

## The bar for held-out, to freeze now

Held-out's one look is spent only if, on the 93 dev replies:
1. **at least 90% are read at all** (84 of 93): not failed, not cut off, not rejected;
2. **no reply stating an answer is read as a different answer;**
3. **no "don't know" reply is read as an answer.**

- **Why these:** the first is what 0004 failed (45%); the other two are what the schema could make worse, by holding the model to a list when it would rather explain.
- **What it can't do:** 93 replies make it coarse. It decides whether to look, not what the result is.
- **Below it,** Gate 2 chooses: revise the prompt on dev (a new prompt version, and the local model reread on both sets), raise the 64-token limit, or stop with the dev finding.
- **What 0004 showed on held-out for comparison:** 237 of 527 read, 45%. Of those, 217 of 217 stating an answer read exactly, and 0 of 20 "don't know" replies invented.

## Recommendation

- **Yes to the dev run,** with the command and cap above.
- **Freeze the bar as written.**
- If you'd rather the bar on 1 be lower, for example 80%, say so now: the point of freezing it here is that it isn't set after the numbers.

## Answer

(The owner's, at the gate.)
