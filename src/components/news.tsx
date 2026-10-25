"use client";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api, type ArticleDTO } from "@/lib/api-client";
import { stage } from "@/lib/motion";
import { NewsCards } from "./dashboard";
import { NavLink } from "./ui/nav-link";
import { HeadingSkeleton, NewsSkeleton } from "./ui/skeleton";
export function News({ id }: { id?: string }) {
  const [articles, setArticles] = useState<ArticleDTO[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    (id
      ? api<ArticleDTO>(`/news/${id}`).then((a) => [a])
      : api<ArticleDTO[]>("/news")
    )
      .then(setArticles)
      .catch((e) => setError(e.message));
  }, [id]);
  if (error)
    return (
      <p role="alert" className="error-box">
        {error}
      </p>
    );
  if (!articles.length)
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Загружаем материалы…</span>
        <HeadingSkeleton />
        {id ? (
          <div className="article-page">
            <div className="skeleton-stack" style={{ gap: 18 }}>
              <span className="skeleton" style={{ height: 38, width: "78%" }} />
              <span className="skeleton" style={{ height: 20, width: "92%" }} />
              <span
                className="skeleton"
                style={{ height: 320, borderRadius: 16 }}
              />
            </div>
          </div>
        ) : (
          <NewsSkeleton cards={6} />
        )}
      </div>
    );
  return id ? (
    <article className="article-page">
      <NavLink className="back-link" href="/news" direction="back">
        <ArrowLeft size={16} /> Полезное для бизнеса
      </NavLink>
      <span className="eyebrow">СПРАВОЧНЫЙ ДЕМОМАТЕРИАЛ</span>
      <h1>{articles[0].title}</h1>
      <p className="article-lead">{articles[0].summary}</p>
      <div className="article-body">
        {articles[0].body?.map((p, i) => (
          <p key={i} style={stage(i, 40)}>
            {p}
          </p>
        ))}
      </div>
      <p className="fine-print">
        Синтетический редакционный материал. Не новость и не официальная
        публикация банка.
      </p>
    </article>
  ) : (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЗНАНИЯ ДЛЯ РОСТА</span>
          <h1>На пользу вашему делу</h1>
          <p>
            Справочные демоматериалы, подобранные для вашей компании и текущего
            этапа.
          </p>
        </div>
      </div>
      <NewsCards items={articles} />
    </>
  );
}
