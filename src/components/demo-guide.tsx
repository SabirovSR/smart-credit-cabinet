"use client";
import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { demoScenario } from "@/lib/demo-scenarios";

export function DemoGuide({ email }: { email: string }) {
  const [expanded, setExpanded] = useState(true);
  const scenario = demoScenario(email);
  if (!scenario) return null;
  return (
    <section className="demo-guide" aria-label="Ваш демосценарий">
      <button
        className="demo-guide-heading"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="demo-guide-content"
      >
        <BookOpen size={20} aria-hidden="true" />
        <span>
          <small>ВАШ ДЕМОСЦЕНАРИЙ</small>
          <strong>{scenario.title}</strong>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={expanded ? "rotated" : ""}
        />
      </button>
      <div id="demo-guide-content" hidden={!expanded}>
        <p>{scenario.description}</p>
        <p>{scenario.steps} Примеры PDF можно скачать на шаге «Документы».</p>
        <small>
          Это инструкция для проверки прототипа. Решение рассчитывается по
          данным заявки; изменение показателей может изменить результат.
        </small>
      </div>
    </section>
  );
}
