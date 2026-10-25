"use client";
import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSelectedLayoutSegments,
} from "next/navigation";
import {
  LayoutDashboard,
  Files,
  BookOpen,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { api } from "@/lib/api-client";
import { stage } from "@/lib/motion";
import {
  markNavigation,
  takeNavigationDirection,
  type NavigationDirection,
} from "@/lib/navigation-motion";
import { NavLink } from "./ui/nav-link";

const sections: {
  href: string;
  title: string;
  Icon: ComponentType<{ size?: number }>;
}[] = [
  { href: "/dashboard", title: "Обзор", Icon: LayoutDashboard },
  { href: "/applications", title: "Мои заявки", Icon: Files },
  { href: "/news", title: "Полезное для бизнеса", Icon: BookOpen },
];

const depth = (path: string) => path.split("/").filter(Boolean).length;

export function CabinetShell({
  children,
  companyName,
  inn,
}: {
  children: React.ReactNode;
  companyName: string;
  inn: string;
}) {
  const path = usePathname(),
    router = useRouter(),
    segments = useSelectedLayoutSegments();
  const [menu, setMenu] = useState(false),
    [error, setError] = useState("");
  // Route-tree identity. Unlike usePathname() it ignores the URL the draft form
  // rewrites with history.replaceState, so a screen is never remounted mid-edit.
  const routeKey = segments.join("/");
  const lastKey = useRef(routeKey),
    lastDepth = useRef(depth(path)),
    direction = useRef<NavigationDirection>("same");
  if (lastKey.current !== routeKey) {
    const marked = takeNavigationDirection(),
      now = depth(path);
    direction.current =
      marked ??
      (now > lastDepth.current
        ? "forward"
        : now < lastDepth.current
          ? "back"
          : "same");
    lastDepth.current = now;
    lastKey.current = routeKey;
  }
  const navRef = useRef<HTMLElement | null>(null),
    pillSeen = useRef(false),
    [pill, setPill] = useState<{
      top: number;
      height: number;
      still: boolean;
    } | null>(null);
  const isActive = (href: string) =>
    href === "/dashboard"
      ? path === "/dashboard"
      : path === href || path.startsWith(`${href}/`);
  const activeHref = sections.find((s) => isActive(s.href))?.href ?? null;
  useLayoutEffect(() => {
    const measure = () => {
      const el = navRef.current?.querySelector<HTMLAnchorElement>("a.active");
      if (!el) {
        setPill(null);
        return;
      }
      setPill({
        top: el.offsetTop,
        height: el.offsetHeight,
        still: !pillSeen.current,
      });
      pillSeen.current = true;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeHref]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);
  return (
    <div className="cabinet">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">д.</span>
          <span>
            дело<span className="brand-sub">кредитный кабинет</span>
          </span>
        </Link>
        <span className="workspace-label">МОЙ БИЗНЕС</span>
        <nav id="cabinet-nav" ref={navRef}>
          <span
            className="nav-pill"
            data-instant={pill?.still ? "true" : undefined}
            style={
              pill
                ? {
                    transform: `translateY(${pill.top}px)`,
                    height: pill.height,
                    opacity: 1,
                  }
                : undefined
            }
            aria-hidden="true"
          />
          {sections.map(({ href, title, Icon }, i) => (
            <NavLink
              key={href}
              href={href}
              direction="same"
              onClick={() => setMenu(false)}
              className={isActive(href) ? "active" : ""}
              style={stage(i)}
            >
              <Icon size={20} />
              {title}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <ShieldCheck size={21} />
          </span>
          <h3>Прозрачно на каждом шаге</h3>
          <p>Статус, условия и причины решения всегда под рукой.</p>
        </div>
        <div className="sidebar-foot">
          <span className="demo-dot" /> Демонстрационный режим
          <small>
            Прототип по кейсу Альфа-Банка.
            <br />
            Не является сервисом банка.
          </small>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Закрыть меню"
          tabIndex={-1}
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Меню"
            aria-expanded={menu}
            aria-controls="cabinet-nav"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <span className="topbar-label">Кабинет предпринимателя</span>
          <div className="company-menu">
            <span className="company-avatar">
              {companyName.replace("ООО «", "").slice(0, 1)}
            </span>
            <div>
              <strong>{companyName}</strong>
              <small>ИНН {inn}</small>
            </div>
            <button
              aria-label="Выйти"
              title="Выйти"
              onClick={async () => {
                try {
                  await api("/auth/logout", { method: "POST", body: "{}" });
                  router.push("/login");
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <main className="main-content">
          <div className="view" data-dir={direction.current} key={routeKey}>
            {children}
          </div>
        </main>
        <footer className="workspace-footer">
          <span>Дело · Умный кредитный кабинет</span>
          <span>
            Синтетические данные и условия <ArrowUpRight size={12} />
          </span>
        </footer>
      </div>
    </div>
  );
}
