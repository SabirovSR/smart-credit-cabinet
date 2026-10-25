"use client";
import Link from "next/link";
import { markNavigation } from "@/lib/navigation-motion";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Which way the destination sits relative to the current screen. */
  direction?: "forward" | "back" | "same";
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

/** `<Link>` that also tells the cabinet shell how to animate the hand-off. */
export function NavLink({
  href,
  className,
  style,
  direction = "forward",
  onClick,
  children,
}: Props) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={(event) => {
        markNavigation(direction);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
