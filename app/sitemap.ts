import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/choose`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/living`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/memorial`, lastModified, changeFrequency: "weekly", priority: 0.8 },
  ];
}
