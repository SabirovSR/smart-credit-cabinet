import type { CSSProperties } from "react";

const bar = (width: string | number, height: number, extra?: CSSProperties) => (
  <span
    className="skeleton"
    style={{ display: "block", width, height, ...extra }}
  />
);

/** Placeholder that mirrors the real list so content lands in place. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="application-list">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <span
            className="skeleton skeleton-circle"
            style={{ width: 43, height: 43, flexShrink: 0 }}
          />
          <span
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            {bar(`${45 + ((i * 13) % 30)}%`, 13)}
            {bar("38%", 9)}
          </span>
          {bar(86, 15)}
          {bar(74, 21, { borderRadius: 7 })}
        </div>
      ))}
    </div>
  );
}

/** Placeholder that borrows the real hero band so nothing jumps on swap. */
export function HeroSkeleton() {
  return (
    <section className="credit-hero" aria-hidden>
      <div className="hero-copy">
        <span className="skeleton" style={{ width: 150, height: 9 }} />
        <span
          className="skeleton"
          style={{ width: "68%", height: 34, marginTop: 20 }}
        />
        <span
          className="skeleton"
          style={{ width: "48%", height: 34, marginTop: 9 }}
        />
        <span
          className="skeleton"
          style={{ width: 230, height: 12, marginTop: 22 }}
        />
        <div className="hero-terms">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <span className="skeleton" style={{ width: 72, height: 17 }} />
              <span
                className="skeleton"
                style={{ width: 86, height: 9, marginTop: 5 }}
              />
            </div>
          ))}
        </div>
        <span
          className="skeleton"
          style={{ width: 168, height: 42, borderRadius: 10 }}
        />
      </div>
      <div className="hero-art">
        <div className="hero-ring" />
      </div>
    </section>
  );
}

export function HeadingSkeleton() {
  return (
    <div className="page-heading" aria-hidden>
      <div className="skeleton-stack" style={{ gap: 13 }}>
        {bar(118, 10)}
        {bar(320, 30)}
        {bar(260, 13)}
      </div>
    </div>
  );
}

/** Placeholder matching the news grid. */
export function NewsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="news-grid" aria-hidden>
      {Array.from({ length: cards }, (_, i) => (
        <div className="news-card" key={i}>
          <span className="skeleton" style={{ height: 124, borderRadius: 0 }} />
          <div className="news-copy skeleton-stack" style={{ gap: 11 }}>
            {bar("35%", 9)}
            {bar("88%", 15)}
            {bar("96%", 9)}
            {bar("96%", 9)}
            {bar("45%", 10, { marginTop: "auto" })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder for the two-column detail / form screens. */
export function PanelsSkeleton({ aside = true }: { aside?: boolean }) {
  return (
    <div className={aside ? "detail-layout" : undefined} aria-hidden>
      <div className="skeleton-stack" style={{ gap: 20 }}>
        <span className="skeleton" style={{ height: 168, borderRadius: 15 }} />
        <span className="skeleton" style={{ height: 140, borderRadius: 15 }} />
      </div>
      {aside && (
        <div className="skeleton-stack" style={{ gap: 20 }}>
          <span
            className="skeleton"
            style={{ height: 220, borderRadius: 15 }}
          />
        </div>
      )}
    </div>
  );
}
