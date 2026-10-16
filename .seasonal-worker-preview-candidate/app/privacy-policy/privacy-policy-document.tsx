"use client";

import { LegalDocument, type LegalDocumentContent } from "@/components/legal-document";
import { useLocale } from "@/components/locale-provider";
import englishPolicy from "./policy-en.json";
import koreanPolicy from "./policy-ko.json";

const policies = {
  en: englishPolicy as LegalDocumentContent,
  ko: koreanPolicy as LegalDocumentContent,
};

export function PrivacyPolicyDocument() {
  const { lang } = useLocale();
  return <LegalDocument content={policies[lang]} lang={lang} />;
}
