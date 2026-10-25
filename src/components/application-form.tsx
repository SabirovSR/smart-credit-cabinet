"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  Upload,
  Download,
  FileCheck2,
  Info,
  Trash2,
} from "lucide-react";
import { api, ClientError, type CompanyDTO } from "@/lib/api-client";
import type { ApplicationDTO } from "@/contracts/application";
import { rub } from "@/lib/format";
import { stage } from "@/lib/motion";
import { Button } from "./ui/button";
import { NavLink } from "./ui/nav-link";
import { Spinner } from "./ui/spinner";
import { HeadingSkeleton, PanelsSkeleton } from "./ui/skeleton";
type Fields = {
  purpose: string;
  requestedAmountRub: number | null;
  termMonths: number | null;
  monthlyRevenueRub: number | null;
  monthlyOperatingExpensesRub: number | null;
};
const steps = ["Потребность", "Параметры", "Финансы", "Документы и отправка"];
export function ApplicationForm({ id }: { id?: string }) {
  const router = useRouter(),
    [app, setApp] = useState<ApplicationDTO | null>(null),
    [company, setCompany] = useState<CompanyDTO | null>(null),
    [step, setStep] = useState(0),
    [stepDir, setStepDir] = useState<"forward" | "back">("forward"),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [payment, setPayment] = useState<number | null>(null),
    [calculating, setCalculating] = useState(false);
  const pendingSubmit = useRef<{ key: string; version: number } | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    getValues,
    setError: setFieldError,
    trigger,
    formState: { errors, isDirty },
  } = useForm<Fields>({
    defaultValues: {
      purpose: "",
      requestedAmountRub: 2_000_000,
      termMonths: 12,
      monthlyRevenueRub: null,
      monthlyOperatingExpensesRub: null,
    },
  });
  const amount = watch("requestedAmountRub"),
    term = watch("termMonths");
  useEffect(() => {
    let active = true;
    Promise.all([
      api<CompanyDTO>("/company"),
      id ? api<ApplicationDTO>(`/applications/${id}`) : Promise.resolve(null),
    ])
      .then(([c, a]) => {
        if (!active) return;
        setCompany(c);
        setApp(a);
        if (a && !["DRAFT", "NEEDS_INFO"].includes(a.status)) {
          router.replace(`/applications/${a.id}`);
          return;
        }
        reset(
          a
            ? {
                purpose: a.purpose,
                requestedAmountRub: a.requestedAmountRub,
                termMonths: a.termMonths,
                monthlyRevenueRub: a.monthlyRevenueRub,
                monthlyOperatingExpensesRub: a.monthlyOperatingExpensesRub,
              }
            : {
                purpose: "",
                requestedAmountRub: 2_000_000,
                termMonths: 12,
                monthlyRevenueRub: c.demoDefaults?.monthlyRevenueRub ?? null,
                monthlyOperatingExpensesRub:
                  c.demoDefaults?.monthlyOperatingExpensesRub ?? null,
              },
        );
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [id, reset, router]);
  useEffect(() => {
    if (
      !amount ||
      !term ||
      amount < 500_000 ||
      amount > 5_000_000 ||
      term < 6 ||
      term > 24
    ) {
      setPayment(null);
      setCalculating(false);
      return;
    }
    setCalculating(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      api<{ monthlyPaymentRub: number }>("/calculations", {
        method: "POST",
        body: JSON.stringify({ amountRub: amount, termMonths: term }),
        signal: controller.signal,
      })
        .then((r) => setPayment(r.monthlyPaymentRub))
        .catch(() => setPayment(null))
        .finally(() => setCalculating(false));
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [amount, term]);
  useEffect(() => {
    if (!isDirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const navigate = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (
        link &&
        !link.hasAttribute("download") &&
        link.target !== "_blank" &&
        !window.confirm("Есть несохранённые изменения. Покинуть страницу?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", navigate, true);
    };
  }, [isDirty]);
  async function onError(e: unknown) {
    setError(e instanceof Error ? e.message : "Не удалось выполнить запрос.");
    if (e instanceof ClientError) {
      e.fieldErrors.forEach((f) =>
        setFieldError(f.field as keyof Fields, { message: f.message }),
      );
      if (["VERSION_CONFLICT", "INVALID_STATE"].includes(e.code) && app) {
        pendingSubmit.current = null;
        const fresh = await api<ApplicationDTO>(`/applications/${app.id}`);
        setApp(fresh);
        reset(fresh);
      }
    }
  }
  async function save(values = getValues()) {
    let current = app;
    if (!current) {
      current = await api<ApplicationDTO>("/applications", {
        method: "POST",
        body: JSON.stringify({ productCode: "WORKING_CAPITAL" }),
      });
      setApp(current);
      window.history.replaceState(null, "", `/applications/${current.id}/edit`);
    }
    const saved = await api<ApplicationDTO>(`/applications/${current.id}`, {
      method: "PATCH",
      body: JSON.stringify({ expectedVersion: current.version, ...values }),
    });
    setApp(saved);
    reset(values);
    pendingSubmit.current = null;
    setNotice("Черновик сохранён");
    return saved;
  }
  async function saveDraft() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await save();
    } catch (e) {
      await onError(e);
    } finally {
      setBusy(false);
    }
  }
  async function send(values: Fields) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const current =
        pendingSubmit.current && !isDirty && app ? app : await save(values);
      const pending = pendingSubmit.current ?? {
        key: crypto.randomUUID(),
        version: current.version,
      };
      pendingSubmit.current = pending;
      const result = await api<ApplicationDTO>(
        `/applications/${current.id}/submit`,
        {
          method: "POST",
          headers: { "Idempotency-Key": pending.key },
          body: JSON.stringify({ expectedVersion: pending.version }),
        },
      );
      setApp(result);
      pendingSubmit.current = null;
      router.push(`/applications/${current.id}`);
    } catch (e) {
      await onError(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(type: string, file?: File) {
    if (!file) return;
    setBusy(true);
    setUploading(type);
    setError("");
    try {
      const current = !app || isDirty ? await save() : app;
      const form = new FormData();
      form.set("expectedVersion", String(current.version));
      form.set("type", type);
      form.set("file", file);
      await api(`/applications/${current.id}/documents`, {
        method: "POST",
        body: form,
      });
      setApp(await api<ApplicationDTO>(`/applications/${current.id}`));
      pendingSubmit.current = null;
    } catch (e) {
      await onError(e);
    } finally {
      setUploading(null);
      setBusy(false);
    }
  }
  const numberOptions = (min: number, max: number) => ({
    setValueAs: (v: string) => (v === "" ? null : Number(v)),
    validate: (v: number | null) =>
      (v !== null && Number.isInteger(v) && v >= min && v <= max) ||
      `Введите целое число от ${min.toLocaleString("ru-RU")} до ${max.toLocaleString("ru-RU")}`,
  });
  async function next() {
    const fields: (keyof Fields)[][] = [
      ["purpose"],
      ["requestedAmountRub", "termMonths"],
      ["monthlyRevenueRub", "monthlyOperatingExpensesRub"],
    ];
    if (await trigger(fields[step])) goStep(step + 1);
  }
  function goStep(index: number) {
    setStepDir(index > step ? "forward" : "back");
    setStep(index);
  }
  if (!company)
    return error ? (
      <div className="error-box shake" role="alert" key={error}>
        {error}
      </div>
    ) : (
      <div role="status" aria-busy="true">
        <span className="sr-only">Загружаем данные компании…</span>
        <HeadingSkeleton />
        <PanelsSkeleton />
      </div>
    );
  return (
    <>
      <NavLink className="back-link" href="/applications" direction="back">
        <ArrowLeft size={16} /> Мои заявки
      </NavLink>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ОБОРОТНОЕ ФИНАНСИРОВАНИЕ</span>
          <h1>{app ? "Продолжим вашу заявку" : "Дайте планам зелёный свет"}</h1>
          <p>Четыре простых шага. Можно сохранить и вернуться позже.</p>
        </div>
        <span
          className={`status status-draft ${notice ? "pop" : ""}`}
          key={`badge-${notice}`}
        >
          {app ? `Черновик № ${app.id.slice(0, 8)}` : "Новая заявка"}
        </span>
      </div>
      <div className="stepper">
        {steps.map((title, index) => (
          <button
            key={title}
            disabled={busy || index > step}
            onClick={() => goStep(index)}
            aria-current={index === step ? "step" : undefined}
            className={`${index === step ? "current" : ""} ${index < step ? "complete" : ""}`}
          >
            <span>{index < step ? <Check size={16} /> : index + 1}</span>
            {title}
          </button>
        ))}
      </div>
      <div className="form-layout">
        <form
          onSubmit={handleSubmit(send, () => {
            setError("Проверьте поля заявки на предыдущих шагах.");
            goStep(0);
          })}
          className="form-card"
          noValidate
        >
          <div className="form-card-heading swap" key={`heading-${step}`}>
            <span className="eyebrow">ШАГ {step + 1} ИЗ 4</span>
            <h2>
              {
                [
                  "Для чего нужно финансирование?",
                  "Выберите удобные параметры",
                  "Посмотрим на финансы бизнеса",
                  "Осталось добавить документы",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  "Расскажите о задаче — это поможет сохранить контекст вашей заявки.",
                  "Расчёт предварительный. Итоговые условия появятся после проверки.",
                  "Укажите средние показатели за месяц, в рублях.",
                  "PDF до 5 МБ каждый. Мы проверяем формат, но не анализируем содержимое.",
                ][step]
              }
            </p>
          </div>
          <div className="step-body" key={`body-${step}`} data-dir={stepDir}>
            {step === 0 && (
              <div className="form-stack">
                <div className="company-summary">
                  <span className="company-avatar">
                    {company?.legalName.replace("ООО «", "").slice(0, 1) ?? "Д"}
                  </span>
                  <div>
                    <strong>
                      {company?.legalName ?? "Загружаем компанию…"}
                    </strong>
                    <small>ИНН {company?.inn} · Торговля</small>
                  </div>
                  <Check size={18} />
                </div>
                <label>
                  Цель финансирования
                  <textarea
                    placeholder="Например, закупка новой партии товаров к зимнему сезону"
                    rows={4}
                    {...register("purpose", {
                      validate: (v) =>
                        (v.trim().length >= 10 && v.length <= 1000) ||
                        "Опишите цель: от 10 до 1000 символов",
                    })}
                    aria-invalid={!!errors.purpose}
                  />
                  {errors.purpose && (
                    <span className="field-error">
                      {errors.purpose.message}
                    </span>
                  )}
                </label>
                <div className="info-note">
                  <Info size={20} />
                  <p>
                    Один продукт — пополнение оборотных средств. Укажите
                    конкретную цель внутри этого продукта.
                  </p>
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="form-stack">
                <label>
                  Сумма кредита, ₽
                  <input
                    type="number"
                    step="1"
                    {...register(
                      "requestedAmountRub",
                      numberOptions(500_000, 5_000_000),
                    )}
                    aria-invalid={!!errors.requestedAmountRub}
                  />
                  <small>От 500 000 до 5 000 000 ₽</small>
                  {errors.requestedAmountRub && (
                    <span className="field-error">
                      {errors.requestedAmountRub.message}
                    </span>
                  )}
                </label>
                <label>
                  Срок, месяцев
                  <input
                    type="number"
                    step="1"
                    {...register("termMonths", numberOptions(6, 24))}
                    aria-invalid={!!errors.termMonths}
                  />
                  <small>Любое целое число от 6 до 24 месяцев</small>
                  {errors.termMonths && (
                    <span className="field-error">
                      {errors.termMonths.message}
                    </span>
                  )}
                </label>
                <div className="info-note">
                  <Info size={20} />
                  <p>
                    Ставка демонстрационного продукта — 20% годовых. Модель не
                    учитывает комиссии и календарное начисление процентов.
                  </p>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="form-stack">
                <label>
                  Среднемесячные поступления, ₽
                  <input
                    type="number"
                    step="1"
                    {...register(
                      "monthlyRevenueRub",
                      numberOptions(0, 1_000_000_000),
                    )}
                  />
                  {errors.monthlyRevenueRub && (
                    <span className="field-error">
                      {errors.monthlyRevenueRub.message}
                    </span>
                  )}
                </label>
                <label>
                  Операционные расходы в месяц, ₽
                  <input
                    type="number"
                    step="1"
                    {...register(
                      "monthlyOperatingExpensesRub",
                      numberOptions(0, 1_000_000_000),
                    )}
                  />
                  <small>
                    Без платежей по действующим кредитам — их учтёт система.
                  </small>
                  {errors.monthlyOperatingExpensesRub && (
                    <span className="field-error">
                      {errors.monthlyOperatingExpensesRub.message}
                    </span>
                  )}
                </label>
                <div className="info-note">
                  <Info size={20} />
                  <p>
                    Показатели предзаполнены для синтетической компании. Их
                    можно изменить. Данные из PDF автоматически не извлекаются.
                  </p>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="form-stack">
                {[
                  ["BANK_STATEMENT", "Выписка по счёту", "bank-statement"],
                  ["FINANCIAL_REPORT", "Финансовый отчёт", "financial-report"],
                ].map(([type, title, example]) => {
                  const doc = app?.documents.find((d) => d.type === type);
                  const pending = uploading === type;
                  return (
                    <div
                      className={`upload-card ${doc ? "uploaded" : ""}`}
                      data-busy={pending || undefined}
                      key={type}
                    >
                      <div className="upload-top">
                        {doc ? (
                          <FileCheck2 size={24} className="pop" />
                        ) : pending ? (
                          <Spinner size={24} />
                        ) : (
                          <Upload size={24} />
                        )}
                        <div>
                          <h3>{title}</h3>
                          <p aria-live="polite">
                            {pending
                              ? "Загружаем файл…"
                              : (doc?.originalName ?? "PDF · до 5 МБ")}
                          </p>
                        </div>
                        {doc && (
                          <button
                            disabled={busy}
                            type="button"
                            aria-label={`Удалить: ${title}`}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await api(`/documents/${doc.id}`, {
                                  method: "DELETE",
                                  body: JSON.stringify({
                                    expectedVersion: app!.version,
                                  }),
                                });
                                setApp(
                                  await api<ApplicationDTO>(
                                    `/applications/${app!.id}`,
                                  ),
                                );
                                pendingSubmit.current = null;
                              } catch (e) {
                                await onError(e);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                      <div className="upload-actions">
                        <label className="upload-button">
                          {doc ? "Заменить файл" : "Выбрать файл"}
                          <input
                            aria-label={title}
                            disabled={busy}
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) => {
                              void upload(type, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <a download href={`/demo-documents/${example}.pdf`}>
                          <Download size={14} /> Скачать пример
                        </a>
                      </div>
                      {pending && <div className="upload-progress" />}
                    </div>
                  );
                })}
                <div className="info-note">
                  <Info size={20} />
                  <p>
                    Можно отправить неполный комплект: кабинет покажет, какой
                    документ нужно добавить. Используйте синтетические примеры.
                  </p>
                </div>
              </div>
            )}
          </div>
          {error && (
            <div className="error-box shake" role="alert" key={error}>
              {error}
            </div>
          )}
          {notice && (
            <p className="success-text" role="status" key={notice}>
              <Check size={16} /> {notice}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={saveDraft}
            >
              {busy ? <Spinner size={17} /> : <Save size={17} />} Сохранить
            </Button>
            <div>
              {step > 0 && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  type="button"
                  onClick={() => goStep(step - 1)}
                >
                  Назад
                </Button>
              )}
              {step < 3 ? (
                <Button
                  key="continue"
                  disabled={busy || !company}
                  type="button"
                  onClick={next}
                >
                  Продолжить <ArrowRight size={17} className="nudge" />
                </Button>
              ) : (
                <Button
                  key="submit"
                  disabled={busy}
                  type="submit"
                  aria-busy={busy || undefined}
                >
                  {busy && <Spinner size={17} />}
                  {busy ? "Обрабатываем…" : "Отправить заявку"}
                  <ArrowRight size={17} className="nudge" />
                </Button>
              )}
            </div>
          </div>
          <span className="sr-only" role="status">
            {busy ? "Выполняем запрос" : ""}
          </span>
        </form>
        <aside className="calculation-card rise" style={stage(1)}>
          <span className="eyebrow">ВАШ РАСЧЁТ</span>
          <h3>Оборотный кредит</h3>
          <div
            className="monthly-payment"
            data-pending={calculating || undefined}
          >
            <span>Предварительный платёж</span>
            <strong className="flip" key={`pay-${payment}`}>
              {rub(payment)}
            </strong>
            <small>в месяц</small>
          </div>
          <dl>
            <div>
              <dt>Сумма</dt>
              <dd>
                <span className="flip" key={`sum-${amount}`}>
                  {rub(amount)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Срок</dt>
              <dd>
                <span className="flip" key={`term-${term}`}>
                  {term ?? "—"} мес.
                </span>
              </dd>
            </div>
            <div>
              <dt>Ставка</dt>
              <dd>20% годовых</dd>
            </div>
          </dl>
          <p>
            Расчёт выполняется на сервере. Окончательная сумма зависит от
            результата демонстрационной проверки.
          </p>
          <div className="calculation-footer">
            <Info size={16} /> Не является офертой банка
          </div>
        </aside>
      </div>
    </>
  );
}
