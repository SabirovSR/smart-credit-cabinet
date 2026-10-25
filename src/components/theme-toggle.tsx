"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const key = "credit-cabinet-theme";
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
  const label = dark ? "Включить светлую тему" : "Включить тёмную тему";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        const theme = dark ? "light" : "dark";
        const root = document.documentElement;
        root.classList.add("theme-transition");
        root.dataset.theme = theme;
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => {
          root.classList.remove("theme-transition");
        }, 400);
        try {
          localStorage.setItem(key, theme);
        } catch {
          /* Theme still works when storage is unavailable. */
        }
      }}
    >
      <span
        key={dark ? "dark" : "light"}
        className="theme-toggle-icon"
        aria-hidden="true"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </span>
      <span>{dark ? "Светлая тема" : "Тёмная тема"}</span>
    </button>
  );
}
