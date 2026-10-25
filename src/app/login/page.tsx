"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowRight, ShieldCheck, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { demoScenario, demoScenarios } from "@/lib/demo-scenarios";
import { Spinner } from "@/components/ui/spinner";
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("full@demo.local"),
    [password, setPassword] = useState("DemoCredit2026!");
  const [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [busy, setBusy] = useState(false);
  const scenario = demoScenario(email);
  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <a className="brand" href="/login">
          <span className="brand-mark">д.</span>
          <span>
            дело<span className="brand-sub">кредитный кабинет</span>
          </span>
        </a>
        <div className="login-story-body">
          <span className="eyebrow light">БИЗНЕС ДВИЖЕТСЯ ВПЕРЁД</span>
          <h1>
            Ваш следующий
            <br />
            шаг —<br />
            <span>возможен.</span>
          </h1>
          <p>
            Финансирование оборота.
            <br />
            Понятные условия. Решение в одном кабинете.
          </p>
          <div className="login-visual">
            <div className="visual-line" />
            <div className="visual-block one" />
            <div className="visual-block two" />
            <div className="visual-block three" />
            <ArrowUpRight size={110} strokeWidth={1.1} />
            <span>
              Больше возможностей
              <br />
              для вашего дела
            </span>
          </div>
        </div>
        <div className="login-bottom">
          Хакатон · 2026 <span>Демонстрационный прототип</span>
        </div>
      </section>
      <section className="login-form-panel">
        <ThemeToggle />
        <span className="prototype-tag">
          Прототип по кейсу · не сервис банка
        </span>
        <div className="login-form-wrap">
          <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
          <h2>С возвращением</h2>
          <p className="muted">Войдите, чтобы продолжить работу с заявкой.</p>
          <form onSubmit={enter} className="form-stack">
            <label>
              Email
              <input
                autoComplete="username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Пароль
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p
                role="alert"
                className="error-box shake"
                key={`${error}-${attempt}`}
              >
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit" aria-busy={busy || undefined}>
              {busy && <Spinner size={18} />}
              {busy ? "Входим…" : "Войти в кабинет"}
              {!busy && <ArrowRight size={18} className="nudge" />}
            </Button>
          </form>
          <div className="demo-accounts">
            <h3>Попробуйте демо</h3>
            <p>Четыре компании, разные сценарии. Данные синтетические.</p>
            <div className="account-grid">
              {demoScenarios.map(({ alias: id, title, company }) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={email === `${id}@demo.local`}
                  className={email === `${id}@demo.local` ? "selected" : ""}
                  onClick={() => {
                    setEmail(`${id}@demo.local`);
                    setPassword("DemoCredit2026!");
                  }}
                >
                  <span>
                    <strong>{title}</strong>
                    <small>{company}</small>
                  </span>
                  {email === `${id}@demo.local` && <Check size={14} />}
                </button>
              ))}
            </div>
            {scenario && (
              <div className="scenario-preview" aria-live="polite">
                <strong>{scenario.title}</strong>
                <p>{scenario.description}</p>
                <p>{scenario.steps}</p>
              </div>
            )}
            <small>Пароль всех аккаунтов: DemoCredit2026!</small>
          </div>
          <p className="secure-note">
            <ShieldCheck size={18} /> Это учебный сценарий. Реальные деньги не
            выдаются.
          </p>
        </div>
        <footer>
          Независимый прототип. Не является официальным продуктом Альфа-Банка.
        </footer>
      </section>
    </main>
  );
}
