import type { Metadata } from "next";
import { Marcellus } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://soultrace.eternalbeam.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Soul Trace | Eternal Beam",
  description: "아이의 성향을 담은 추억 편지를 생성하는 Soul Trace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${marcellus.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&family=Noto+Serif+KR:wght@200;300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-ko min-h-full flex flex-col bg-black text-[#FFFFFF]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
