"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { useState } from "react";
import { api } from "@/lib/api-client";
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
    router = useRouter();
  const [menu, setMenu] = useState(false),
    [error, setError] = useState("");
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
        <nav>
          {[
            ["/dashboard", "Обзор", LayoutDashboard],
            ["/applications", "Мои заявки", Files],
            ["/news", "Полезное для бизнеса", BookOpen],
          ].map(([href, title, Icon]) => {
            const I = Icon as typeof Files;
            return (
              <Link
                onClick={() => setMenu(false)}
                key={href as string}
                href={href as string}
                className={
                  path === href ||
                  (href !== "/dashboard" && path.startsWith(href as string))
                    ? "active"
                    : ""
                }
              >
                <I size={20} />
                {title as string}
              </Link>
            );
          })}
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
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Меню"
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
        <main className="main-content">{children}</main>
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
