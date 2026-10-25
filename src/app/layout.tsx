import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Дело — кредитный кабинет",
  description:
    "Умный кредитный кабинет предпринимателя. Демонстрационный прототип.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
