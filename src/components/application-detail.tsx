"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  FileText,
  CircleCheck,
  Info,
  Pencil,
  Download,
} from "lucide-react";
import { api, ClientError } from "@/lib/api-client";
import { rub, date, statusLabel } from "@/lib/format";
import type { ApplicationDTO } from "@/contracts/application";
import { Button } from "./ui/button";
export function ApplicationDetail({ id }: { id: string }) {
  const [app, setApp] = useState<ApplicationDTO | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false);
  const acceptance = useRef<{
    key: string;
    version: number;
    offerId: string;
  } | null>(null);
  useEffect(() => {
    api<ApplicationDTO>(`/applications/${id}`)
      .then(setApp)
      .catch((e) => setError(e.message));
  }, [id]);
  async function action(kind: "reopen" | "accept") {
    if (!app) return;
    setBusy(true);
    setError("");
    try {
      const pending = acceptance.current ?? {
        key: crypto.randomUUID(),
        version: app.version,
        offerId: app.offer?.id ?? "",
      };
      if (kind === "accept") acceptance.current = pending;
      await api<ApplicationDTO>(
        `/applications/${id}/${kind === "reopen" ? "reopen" : `offers/${pending.offerId}/accept`}`,
        {
          method: "POST",
          headers: kind === "accept" ? { "Idempotency-Key": pending.key } : {},
          body: JSON.stringify({
            expectedVersion: kind === "accept" ? pending.version : app.version,
          }),
        },
      );
      setApp(await api<ApplicationDTO>(`/applications/${id}`));
      acceptance.current = null;
      setConsent(false);
    } catch (e) {
      setError((e as Error).message);
      if (
        e instanceof ClientError &&
        ["VERSION_CONFLICT", "INVALID_STATE", "OFFER_EXPIRED"].includes(e.code)
      ) {
        setApp(await api<ApplicationDTO>(`/applications/${id}`));
        acceptance.current = null;
        setConsent(false);
      }
    } finally {
      setBusy(false);
    }
  }
  if (!app)
    return (
      <div
        className={error ? "error-box" : "loading"}
        role={error ? "alert" : "status"}
      >
        {error || "Загружаем заявку…"}
      </div>
    );
  const offered = app.status === "OFFERED",
    accepted = app.status === "ACCEPTED",
    offer = app.offer;
  const title = accepted
    ? "Следующий шаг сделан"
    : offered
      ? "Для вашего дела есть предложение"
      : app.status === "NEEDS_INFO"
        ? "Добавим немного ясности"
        : app.status === "REJECTED"
          ? "Пока не можем предложить кредит"
          : "Ваша заявка ждёт продолжения";
  return (
    <>
      <Link className="back-link" href="/applications">
        <ArrowLeft size={16} /> Мои заявки
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            ЗАЯВКА № {id.slice(0, 8).toUpperCase()}
          </span>
          <h1>{title}</h1>
          <p>Оборотное финансирование · {date(app.createdAt)} · время Москвы</p>
        </div>
        <span className={`status status-${app.status.toLowerCase()}`}>
          {statusLabel[app.status]}
        </span>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="detail-layout">
        <div>
          {offer && (
            <section className={`offer-card ${accepted ? "accepted" : ""}`}>
              <div className="offer-heading">
                <span className="offer-icon">
                  <CircleCheck size={27} />
                </span>
                <div>
                  <span className="eyebrow">
                    {accepted
                      ? "УСЛОВИЯ ПРИНЯТЫ"
                      : offer.kind === "REDUCED"
                        ? "ПРЕДЛОЖЕНИЕ МЕНЬШЕЙ СУММЫ"
                        : "ПРЕДЛОЖЕНИЕ ПОЛНОЙ СУММЫ"}
                  </span>
                  <h2>{rub(offer.amountRub)}</h2>
                </div>
              </div>
              {offer.kind === "REDUCED" && (
                <p className="reduced-explanation">
                  Вы запросили {rub(app.requestedAmountRub)}. Предлагаем{" "}
                  {rub(offer.amountRub)}, чтобы платёж соответствовал денежному
                  потоку компании.
                </p>
              )}
              <div className="offer-terms">
                <div>
                  <span>Ежемесячный платёж</span>
                  <strong>{rub(offer.monthlyPaymentRub)}</strong>
                </div>
                <div>
                  <span>Срок</span>
                  <strong>{offer.termMonths} мес.</strong>
                </div>
                <div>
                  <span>Ставка</span>
                  <strong>{offer.annualRateBps / 100}%</strong>
                </div>
              </div>
              <div className="total-payment">
                <span>Расчётная сумма всех платежей</span>
                <strong>{rub(offer.totalRepaymentRub)}</strong>
              </div>
              {accepted ? (
                <div className="info-note">
                  <Check size={20} />
                  <p>
                    Вы приняли демонстрационные условия{" "}
                    {date(offer.acceptedAt!)}. Сценарий завершён. Договор не
                    заключён, деньги не выдаются.
                  </p>
                </div>
              ) : (
                <>
                  <p className="offer-expiry">
                    <Clock3 size={16} />
                    {offer.expired
                      ? "Срок предложения истёк"
                      : `Действует до ${date(offer.expiresAt)} (МСК)`}
                  </p>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={consent}
                      disabled={busy || offer.expired}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      Я ознакомился с предложением на {rub(offer.amountRub)} и
                      принимаю демонстрационные условия. Это не электронная
                      подпись.
                    </span>
                  </label>
                  <div className="offer-actions">
                    <Button
                      disabled={busy || !consent || offer.expired}
                      onClick={() => action("accept")}
                    >
                      {busy ? "Сохраняем…" : "Принять условия"}
                      <ArrowRight size={17} />
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => action("reopen")}
                    >
                      Изменить заявку
                    </Button>
                  </div>
                </>
              )}
              <p className="fine-print">
                Синтетические условия. Расчёт без комиссий и календарного
                начисления процентов. Не предложение реального банка.
              </p>
            </section>
          )}
          {!offer && (
            <section className="panel result-panel">
              <Info size={30} />
              <h2>
                {app.status === "DRAFT"
                  ? "Продолжите с того места, где остановились"
                  : app.status === "NEEDS_INFO"
                    ? "Не хватает документов"
                    : "Причина решения"}
              </h2>
              {app.status !== "DRAFT" &&
                app.latestEvaluation?.reasons.map((r) => (
                  <p key={r.code}>{r.message}</p>
                ))}
              {app.status === "NEEDS_INFO" && (
                <ul>
                  {["BANK_STATEMENT", "FINANCIAL_REPORT"]
                    .filter((t) => !app.documents.some((d) => d.type === t))
                    .map((t) => (
                      <li key={t}>
                        {t === "BANK_STATEMENT"
                          ? "Выписка по счёту"
                          : "Финансовый отчёт"}
                      </li>
                    ))}
                </ul>
              )}
              {["DRAFT", "NEEDS_INFO"].includes(app.status) ? (
                <Button asChild>
                  <Link href={`/applications/${id}/edit`}>
                    {app.status === "DRAFT"
                      ? "Продолжить заполнение"
                      : "Добавить документы"}
                    <ArrowRight size={17} />
                  </Link>
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => action("reopen")}>
                  <Pencil size={17} /> Вернуться к редактированию
                </Button>
              )}
            </section>
          )}
          <section className="panel">
            <h2>Параметры заявки</h2>
            <p className="purpose-text">
              {app.purpose || "Цель пока не указана"}
            </p>
            <dl className="detail-dl">
              <div>
                <dt>Запрошенная сумма</dt>
                <dd>{rub(app.requestedAmountRub)}</dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>{app.termMonths ?? "—"} мес.</dd>
              </div>
              <div>
                <dt>Поступления в месяц</dt>
                <dd>{rub(app.monthlyRevenueRub)}</dd>
              </div>
              <div>
                <dt>Операционные расходы</dt>
                <dd>{rub(app.monthlyOperatingExpensesRub)}</dd>
              </div>
            </dl>
          </section>
          <section className="panel">
            <h2>
              Документы{" "}
              <span className="count-pill">{app.documents.length}/2</span>
            </h2>
            {app.documents.length ? (
              app.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={`/api/v1/documents/${doc.id}`}
                  className="document-row"
                  download
                >
                  <FileText size={22} />
                  <div>
                    <strong>
                      {doc.type === "BANK_STATEMENT"
                        ? "Выписка по счёту"
                        : "Финансовый отчёт"}
                    </strong>
                    <small>
                      {doc.originalName} · {Math.ceil(doc.sizeBytes / 1024)} КБ
                    </small>
                  </div>
                  <Download size={17} />
                </a>
              ))
            ) : (
              <p className="muted">Документы ещё не загружены.</p>
            )}
          </section>
        </div>
        <aside>
          <section className="panel timeline-panel">
            <h2>История заявки</h2>
            <p className="muted">Каждый шаг сохранён · МСК</p>
            <ol className="timeline">
              {app.events
                .slice()
                .reverse()
                .map((e) => (
                  <li key={e.id}>
                    <span
                      className={`timeline-dot ${e.actor === "SYSTEM" ? "system" : ""}`}
                    />
                    <small>
                      {date(e.createdAt)} ·{" "}
                      {e.actor === "SYSTEM" ? "Система" : "Вы"}
                    </small>
                    <p>{e.message}</p>
                  </li>
                ))}
            </ol>
          </section>
          {app.latestEvaluation && (
            <section className="panel">
              <h3>Последняя проверка</h3>
              <p className="fine-print">
                Редакция {app.latestEvaluation.inputVersion} ·{" "}
                {app.status === "DRAFT"
                  ? "Исторический результат, не актуальное решение"
                  : app.latestEvaluation.policyVersion}
              </p>
              {app.latestEvaluation.checks.map((c) => (
                <div key={c.type} className="check-row">
                  <span>
                    {
                      (
                        {
                          COMPLETENESS: "Документы",
                          REGISTRY: "Компания",
                          CREDIT_HISTORY: "Обязательства",
                          AFFORDABILITY: "Доступность платежа",
                        } as Record<string, string>
                      )[c.type]
                    }
                  </span>
                  <span
                    className={
                      c.status === "PASS" ? "check-pass" : "check-attention"
                    }
                  >
                    {c.message}
                  </span>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
