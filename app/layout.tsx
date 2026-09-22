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
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site-url";
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

/** 프로덕션에서 오래된 정적 HTML이 남지 않도록 (Vercel 엣지·프리렌더 갱신) */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Soul Trace",
      alternateName: "소울트레이스",
      url: SITE_URL,
      inLanguage: ["ko", "en"],
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebApplication",
      name: "Soul Trace",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      isPartOf: { "@type": "Brand", name: "Eternal Beam" },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Soul Trace",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Soul Trace",
  keywords: [
    "Soul Trace",
    "소울트레이스",
    "반려동물 편지",
    "추억 편지",
    "이터널빔",
    "Eternal Beam",
  ],
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/",
    languages: {
      ko: "/",
      en: "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["en_US"],
    url: SITE_URL,
    siteName: "Soul Trace",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-cover.png",
        width: 1200,
        height: 630,
        alt: "Soul Trace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-cover.png"],
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
