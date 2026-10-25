/**
 * Where the next route change should visually come from.
 *
 * The cabinet shell reads this when the pathname changes, so the new screen
 * slides in from the side the user was already looking at: entering a deeper
 * route arrives from the right, a "back" link arrives from the left.
 */
export type NavigationDirection = "forward" | "back" | "same";

let pending: NavigationDirection | null = null;

export function markNavigation(direction: NavigationDirection) {
  pending = direction;
}

/**
 * Reads (and clears) the direction tagged on the navigation that is about to
 * happen, or `null` when nothing tagged it — the shell then falls back to
 * comparing route depth.
 */
export function takeNavigationDirection(): NavigationDirection | null {
  const direction = pending;
  pending = null;
  return direction;
}
