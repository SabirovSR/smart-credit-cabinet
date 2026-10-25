"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Clock3,
  Wallet,
  FileText,
  ChevronRight,
  CircleCheck,
} from "lucide-react";
import {
  api,
  type ListItem,
  type CompanyDTO,
  type ArticleDTO,
} from "@/lib/api-client";
import { rub, statusLabel, date } from "@/lib/format";
import { stage } from "@/lib/motion";
import { Button } from "./ui/button";
import { NavLink } from "./ui/nav-link";
import { Spinner } from "./ui/spinner";
import {
  HeadingSkeleton,
  HeroSkeleton,
  ListSkeleton,
  NewsSkeleton,
} from "./ui/skeleton";
export function ApplicationList({ items }: { items: ListItem[] }) {
  return (
    <div className="application-list">
      {items.length ? (
        items.map((item, i) => (
          <NavLink
            className="application-row"
            style={stage(i, 55)}
            key={item.id}
            href={`/applications/${item.id}`}
          >
            <span className="file-icon">
              <FileText size={22} />
            </span>
            <div className="app-row-name">
              <strong>{item.purpose || "Оборотное финансирование"}</strong>
              <small>
                № {item.id.slice(0, 8).toUpperCase()} · {date(item.updatedAt)}
              </small>
            </div>
            <strong className="app-amount">
              {rub(item.requestedAmountRub)}
            </strong>
            <span className={`status status-${item.status.toLowerCase()}`}>
              {statusLabel[item.status]}
            </span>
            <ChevronRight size={18} />
          </NavLink>
        ))
      ) : (
        <div className="empty-apps">
          <span className="file-icon">
            <FileText size={25} />
          </span>
          <div>
            <h3>Здесь начнётся ваша история</h3>
            <p>
              Создайте первую заявку. Черновик можно сохранить и заполнить
              позже.
            </p>
          </div>
          <NavLink href="/applications/new">
            Создать заявку <ArrowRight size={17} className="nudge" />
          </NavLink>
        </div>
      )}
    </div>
  );
}
export function NewsCards({ items }: { items: ArticleDTO[] }) {
  return (
    <div className="news-grid">
      {items.map((article, i) => (
        <NavLink
          href={`/news/${article.id}`}
          key={article.id}
          className="news-card"
          style={stage(i, 70)}
        >
          <div className={`article-art art-${i % 4}`}>
            <span>ДЛЯ ВАШЕГО БИЗНЕСА</span>
            {i % 3 === 0 ? (
              <Wallet size={52} strokeWidth={1.3} />
            ) : i % 3 === 1 ? (
              <FileText size={52} strokeWidth={1.3} />
            ) : (
              <ArrowUpRight size={64} strokeWidth={1.3} />
            )}
            <span className="article-number">0{i + 1}</span>
          </div>
          <div className="news-copy">
            <small>{article.relevanceReason}</small>
            <h3>{article.title}</h3>
            <p>{article.summary}</p>
            <span className="article-link">
              Читать материал <ArrowUpRight size={16} />
            </span>
          </div>
        </NavLink>
      ))}
    </div>
  );
}
export function Dashboard({
  onlyApplications = false,
}: {
  onlyApplications?: boolean;
}) {
  const [items, setItems] = useState<ListItem[]>([]),
    [company, setCompany] = useState<CompanyDTO | null>(null),
    [articles, setArticles] = useState<ArticleDTO[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [cursor, setCursor] = useState<string | null>(null),
    [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    Promise.all([
      api<{ items: ListItem[]; nextCursor: string | null }>("/applications"),
      api<CompanyDTO>("/company"),
      api<ArticleDTO[]>("/news"),
    ])
      .then(([apps, c, n]) => {
        setItems(apps.items);
        setCursor(apps.nextCursor);
        setCompany(c);
        setArticles(n);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <div role="alert" className="error-box">
        {error}
        <Button variant="secondary" onClick={() => location.reload()}>
          Повторить
        </Button>
      </div>
    );
  if (!loaded)
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Загружаем ваш кабинет…</span>
        <HeadingSkeleton />
        {!onlyApplications && (
          <>
            <HeroSkeleton />
            <div className="section">
              <div className="section-heading">
                <h2>
                  Ваши заявки{" "}
                  <span
                    className="skeleton"
                    style={{ width: 34, height: 22, borderRadius: 6 }}
                  />
                </h2>
              </div>
              <ListSkeleton rows={3} />
            </div>
            <div className="section">
              <div className="section-heading">
                <h2>На пользу вашему делу</h2>
              </div>
              <NewsSkeleton cards={3} />
            </div>
          </>
        )}
        {onlyApplications && (
          <div className="section">
            <div className="section-heading">
              <h2>
                История заявок{" "}
                <span
                  className="skeleton"
                  style={{ width: 34, height: 22, borderRadius: 6 }}
                />
              </h2>
            </div>
            <ListSkeleton rows={4} />
          </div>
        )}
      </div>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {onlyApplications ? "ФИНАНСИРОВАНИЕ" : "ОБЗОР БИЗНЕСА"}
          </span>
          <h1>
            {onlyApplications ? "Мои заявки" : "Большие планы. Понятный путь."}
          </h1>
          <p>
            {onlyApplications
              ? "Все этапы финансирования — в одном месте."
              : `${company?.legalName} — всё готово к следующему шагу.`}
          </p>
        </div>
        {onlyApplications && (
          <Button asChild>
            <NavLink href="/applications/new">
              <Plus size={18} /> Новая заявка
            </NavLink>
          </Button>
        )}
      </div>
      {!onlyApplications && (
        <>
          <section className="credit-hero">
            <div className="hero-copy">
              <span className="hero-tag">
                <span /> ОБОРОТНОЕ ФИНАНСИРОВАНИЕ
              </span>
              <h2>
                Вашему делу —<br />
                пространство для роста
              </h2>
              <p>
                Пополните запасы, расширьте ассортимент
                <br />
                или подготовьтесь к новому сезону.
              </p>
              <div className="hero-terms">
                <div>
                  <strong>до 5 млн ₽</strong>
                  <span>сумма кредита</span>
                </div>
                <div>
                  <strong>6–24 мес.</strong>
                  <span>срок финансирования</span>
                </div>
                <div>
                  <strong>20% годовых</strong>
                  <span>демонстрационная ставка</span>
                </div>
              </div>
              <Button asChild>
                <NavLink href="/applications/new">
                  Подать заявку <ArrowRight size={19} className="nudge" />
                </NavLink>
              </Button>
              <small className="hero-disclaimer">
                Демонстрационные условия · без выдачи реальных денег
              </small>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-ring" />
              <div className="growth-bar bar-one" />
              <div className="growth-bar bar-two" />
              <div className="growth-bar bar-three" />
              <div className="growth-arrow">
                <ArrowUpRight size={140} strokeWidth={1.3} />
              </div>
              <div className="floating-label">
                <CircleCheck size={20} /> На шаг ближе к цели
              </div>
            </div>
          </section>
          <div className="benefit-row">
            <div>
              <Clock3 size={21} />
              <span>Без визита в отделение</span>
            </div>
            <div>
              <FileText size={21} />
              <span>Всего два PDF-документа</span>
            </div>
            <div>
              <CircleCheck size={21} />
              <span>Решение с объяснением</span>
            </div>
          </div>
        </>
      )}
      <section className="section">
        <div className="section-heading">
          <h2>
            {onlyApplications ? "История заявок" : "Ваши заявки"}
            <span className={`count-pill ${loaded ? "pop" : ""}`}>
              {items.length}
              {cursor ? "+" : ""}
            </span>
          </h2>
          {!onlyApplications && (
            <NavLink href="/applications">
              Все заявки <ArrowRight size={16} className="nudge" />
            </NavLink>
          )}
        </div>
        <div aria-busy={loadingMore || undefined}>
          <ApplicationList
            items={onlyApplications ? items : items.slice(0, 3)}
          />
          {onlyApplications && cursor && (
            <Button
              variant="secondary"
              disabled={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                try {
                  const result = await api<{
                    items: ListItem[];
                    nextCursor: string | null;
                  }>(`/applications?cursor=${cursor}`);
                  setItems([...items, ...result.items]);
                  setCursor(result.nextCursor);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setLoadingMore(false);
                }
              }}
            >
              {loadingMore && <Spinner />}
              {loadingMore ? "Загружаем…" : "Загрузить ещё"}
            </Button>
          )}
        </div>
      </section>
      {!onlyApplications && (
        <section className="section">
          <div className="section-heading">
            <div>
              <h2>На пользу вашему делу</h2>
              <p>Справочные демоматериалы с учётом вашей ситуации</p>
            </div>
            <NavLink href="/news">
              Все материалы <ArrowRight size={16} className="nudge" />
            </NavLink>
          </div>
          <NewsCards items={articles.slice(0, 3)} />
        </section>
      )}
    </>
  );
}
