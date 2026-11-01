/**
 * The page's logic with no DOM in it, so `tests/web/` can hold it: which view
 * the URL names, and what a message's choices are for.
 */

export type Route =
  | { view: "start" }
  | { view: "conversation"; id: string }
  | { view: "list"; id: string }
  | { view: "sheet"; id: string }
  | { view: "check"; id: string; check: string }
  | { view: "settings" };

/** The view a URL hash names, so a reload lands where it was and no router is needed. */
export function routeFrom(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/");
  const [view, id] = parts;
  if (view === "settings") return { view: "settings" };
  const check = parts[2];
  if (view === "check" && id !== undefined && id !== "" && check !== undefined && check !== "")
    return { view: "check", id, check };
  if ((view === "c" || view === "list" || view === "sheet") && id !== undefined && id !== "")
    return view === "c" ? { view: "conversation", id } : { view, id };
  return { view: "start" };
}

export function hashOf(route: Route): string {
  switch (route.view) {
    case "start":
      return "#/";
    case "settings":
      return "#/settings";
    case "conversation":
      return `#/c/${route.id}`;
    case "check":
      return `#/check/${route.id}/${route.check}`;
    default:
      return `#/${route.view}/${route.id}`;
  }
}

/** The confirm step's two choices, as the server offers them. */
export const CONFIRM_IDS = ["confirm", "change"] as const;

/** Whether a message's choices are the confirm step's, rather than a question's answers. */
export function isConfirm(choices: readonly { id: string }[] | undefined): boolean {
  return (
    choices !== undefined &&
    choices.length === CONFIRM_IDS.length &&
    choices.every((c, i) => c.id === CONFIRM_IDS[i])
  );
}

/** Dollars, to the cent, or to a tenth of a cent under a cent. */
export function formatUsd(usd: number): string {
  return usd < 0.01 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`;
}

/**
 * How the server's fallback messages end ("I couldn't tell from that. Which
 * is closest?"). After one, the answers are what the person needs, so the
 * page shows them unfolded. `tests/web/logic.test.ts` holds it to the
 * server's words.
 */
export const CLOSEST = "Which is closest?";
/** How the check's fallback messages end (slice 0007). */
export const CHOOSE = "Please choose an answer.";

export function asksToChoose(text: string | undefined): boolean {
  return (text?.endsWith(CLOSEST) || text?.endsWith(CHOOSE)) ?? false;
}

/** How many trials one check takes (slice 0007), as the server holds it. */
export const MAX_TICKED = 3;

/** Ticks or unticks a trial for the check; a fourth tick is refused, leaving the ticks as they were. */
export function toggleTick(ticked: readonly string[], nctId: string): string[] {
  if (ticked.includes(nctId)) return ticked.filter((id) => id !== nctId);
  return ticked.length >= MAX_TICKED ? [...ticked] : [...ticked, nctId];
}
