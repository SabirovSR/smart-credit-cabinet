export const rub = (amount: number | null) =>
  amount === null
    ? "—"
    : new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
      }).format(amount);
export const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
export const statusLabel: Record<string, string> = {
  DRAFT: "Черновик",
  NEEDS_INFO: "Нужны документы",
  OFFERED: "Есть предложение",
  REJECTED: "Не одобрено",
  ACCEPTED: "Условия приняты",
};
