import { LoaderCircle } from "lucide-react";

/** Inline busy indicator. Decorative: the surrounding control carries the label. */
export function Spinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} className="spinner" aria-hidden="true" />;
}
