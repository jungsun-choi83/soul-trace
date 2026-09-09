import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Courier_Prime,
  Inter,
  Marcellus,
  Nanum_Myeongjo,
  Noto_Serif_KR,
  Playfair_Display,
} from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const notoSerifKr = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  weight: ["200", "300"],
  display: "swap",
  preload: false,
});

const nanumMyeongjo = Nanum_Myeongjo({
  variable: "--font-nanum-myeongjo",
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://soultrace.eternalbeam.com";

/** 프로덕션에서 오래된 정적 HTML이 남지 않도록 (Vercel 엣지·프리렌더 갱신) */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    <html
      lang="ko"
      translate="no"
      suppressHydrationWarning
      className={`${marcellus.variable} ${playfair.variable} ${cormorant.variable} ${inter.variable} ${courierPrime.variable} ${notoSerifKr.variable} ${nanumMyeongjo.variable} notranslate h-full antialiased`}
    >
      <body className="font-ko min-h-full flex flex-col bg-black text-[#FFFFFF]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
