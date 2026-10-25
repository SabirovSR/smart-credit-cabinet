"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, type ArticleDTO } from "@/lib/api-client";
import { NewsCards } from "./dashboard";
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
      <p role="status" className="loading">
        Загружаем материалы…
      </p>
    );
  return id ? (
    <article className="article-page">
      <Link className="back-link" href="/news">
        <ArrowLeft size={16} /> Полезное для бизнеса
      </Link>
      <span className="eyebrow">СПРАВОЧНЫЙ ДЕМОМАТЕРИАЛ</span>
      <h1>{articles[0].title}</h1>
      <p className="article-lead">{articles[0].summary}</p>
      <div className="article-body">
        {articles[0].body?.map((p, i) => (
          <p key={i}>{p}</p>
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
