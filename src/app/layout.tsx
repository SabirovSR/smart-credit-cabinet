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
    <html lang="ru" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{let theme;try{theme=localStorage.getItem('credit-cabinet-theme')}catch{}document.documentElement.dataset.theme=theme==='dark'||theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
