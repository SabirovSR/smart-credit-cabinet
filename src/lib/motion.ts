import type { CSSProperties } from "react";

/**
 * Staging helper: pairs with the `.rise` / `.swap` utilities in globals.css,
 * which multiply `--step` (default var(--stagger)) by `--i` to build the delay.
 */
export function stage(index: number, stepMs?: number): CSSProperties {
  return {
    "--i": index,
    ...(stepMs === undefined ? {} : { "--step": `${stepMs}ms` }),
  } as CSSProperties;
}
