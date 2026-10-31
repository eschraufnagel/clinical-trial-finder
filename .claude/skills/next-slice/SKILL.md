---
name: next-slice
description: Start the next slice of this repository, from the roadmap and the last slice's gate records, through intent and spec to a plan, and stop at the plan for the owner's review. Use when the owner says "/next-slice", "start the next slice", or names a slice number to start.
---

# Start the next slice

This repository is built in slices (`CLAUDE.md`, "How work is done here"). This skill does the opening of one, which is the same every time:
- find the slice;
- gather what the last one decided;
- write the intent and spec;
- plan it;
- stop.

It never crosses a gate. The plan's gates, and every decision `CLAUDE.md` says a person makes, stay with the owner.

If the owner names a slice (`/next-slice 0005`), start that one. Otherwise start the first slice in `work/ROADMAP.md` not marked **Done**.

## 1. Start from main

- Switch to `main` and pull. If the working tree isn't clean, stop and say what's there; don't stash or discard anyone's work.
- If another session may be using this checkout, say so before switching branches.

## 2. Read, in this order

1. `CLAUDE.md`, all of it: constraints, conventions, boundaries, and "Things Claude gets wrong".
2. `work/ROADMAP.md`: the slice's row, its open questions, and any row that names it.
3. `work/0000-product/intent.md`, and the sections of `research.md` the slice's row touches.
4. **The last merged slice's folder** (`work/NNNN-*/`):
   - `intent.md`;
   - the plan's Records section;
   - every `gate-*.md`, especially each **Answer** section, where the owner's decisions are.
5. The `docs/` file for each part the slice builds on, and its Limits.
6. The code the slice will build on, read as the plan will need it.

## 3. Collect what is carried in

Before writing anything, list for yourself:
- what earlier gates decided for this slice, quoted with the file it came from;
- what earlier slices said they left for this one;
- what this slice's roadmap row says it is measured by.

These go in the intent's Problem and Open questions, each with its source. If two records disagree, or a decision looks like it would break a constraint in `CLAUDE.md`, ask the owner before writing; don't choose between them.

## 4. Write the intent and spec

- **Branch:** create `NNNN-<short-name>` from `main`, and make the folder `work/NNNN-<short-name>/`.
- **`intent.md`:** in the shape of the last slice's: header, "In plain words", Problem, Proposed outcome, Affected users and systems, Constraints, Open questions. Each open question ends with a leaning.
- **`spec.md`:** answers each open question as a proposal, marked **(OQ n)**, and says where a gate can overturn one.
- **Dates:** months only (`2026-10`, from `monthStamp()`).
- **Data:** no PHI. Patient data is made up.
- **No code yet,** and nothing committed. Step 1 of the plan commits intent, spec and plan together.

## 5. Plan it in plan mode

Enter plan mode, read the codebase, and write the plan as `CLAUDE.md` describes:
- **Stages and gates:** the table at the top of "Order of work". Each gate names what's decided and what it costs to be wrong, justified by what the next stage spends.
- **Steps:** one commit each.
- **Sections:** Files that change, Reused not rebuilt, Risks, Verification, Records.
- **Model runs:** any that spend real resources are gates. A hosted run is dry without `--spend` and needs the owner's go-ahead.
- **Dependencies:** a new one is a plan-level decision, named in the plan.

When the owner approves it, copy the plan into `work/NNNN-*/plan.md` and stop.

## 6. Stop

End by saying, briefly:
- where the three files are;
- what the gates decide;
- the decisions the owner should check first, especially any proposal that leans against something an earlier gate decided.

Start no implementation until the owner says so.

## After the slice's PR merges

Offer to start the next one in a fresh session that runs `/next-slice`, so each slice begins with a clean context (the owner prefers a new chat per slice).
