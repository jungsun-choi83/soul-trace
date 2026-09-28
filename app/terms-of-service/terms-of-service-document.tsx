"use client";

import { LegalDocument, type LegalDocumentContent } from "@/components/legal-document";
import { useLocale } from "@/components/locale-provider";
import englishTerms from "./terms-en.json";
import koreanTerms from "./terms-ko.json";

const terms = {
  en: englishTerms as LegalDocumentContent,
  ko: koreanTerms as LegalDocumentContent,
};

export function TermsOfServiceDocument() {
  const { lang } = useLocale();
  return <LegalDocument content={terms[lang]} lang={lang} />;
}
