/**
 * Soul Trace 첫 등록(프로필 최초 저장) 환영 메일.
 *
 * 편지 생성과 같은 요청에서 보내되, **실패해도 편지 저장을 막지 않는다.**
 * RESEND_API_KEY 가 없으면 조용히 건너뛴다(로컬·미설정 배포).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildWelcomeEmail,
  displayNameFromEmail,
  type WelcomeEmailLocale,
} from "@/lib/welcome-email-content";

function fromAddress(): string | null {
  const raw = (process.env.WELCOME_EMAIL_FROM || "").trim();
  return raw || null;
}

function resendApiKey(): string | null {
  const raw = (process.env.RESEND_API_KEY || "").trim();
  return raw || null;
}

async function deliverWelcomeEmail(
  email: string,
  locale: WelcomeEmailLocale,
): Promise<boolean> {
  const apiKey = resendApiKey();
  const from = fromAddress();
  if (!apiKey || !from) {
    return false;
  }

  const content = buildWelcomeEmail(locale, {
    userName: displayNameFromEmail(email),
  });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      "[welcome-email] Resend 거절 — status=%s body=%s",
      res.status,
      detail.slice(0, 200),
    );
    return false;
  }
  return true;
}

/**
 * 프로필이 막 생긴 사용자에게만 한 번 보낸다.
 *
 * `welcome_email_sent_at` 을 먼저 잡아 두고(경합 방지), 전송 실패 시 풀어
 * 다음 생성 요청에서 다시 시도한다. 컬럼/키가 없으면 편지 흐름은 그대로 둔다.
 */
export async function maybeSendWelcomeEmailForNewProfile(
  supabase: SupabaseClient,
  *,
  email: string,
  locale: WelcomeEmailLocale,
  isNewProfile: boolean,
): Promise<void> {
  // Frozen by default — turn on only with WELCOME_EMAIL_ENABLED=1|true.
  const enabled = (process.env.WELCOME_EMAIL_ENABLED || "").trim().toLowerCase();
  if (enabled !== "1" && enabled !== "true") {
    return;
  }
  if (!isNewProfile) return;
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return;
  if (!resendApiKey() || !fromAddress()) {
    console.warn(
      "[welcome-email] RESEND_API_KEY 또는 WELCOME_EMAIL_FROM 미설정 — 환영 메일 생략",
    );
    return;
  }

  const stamped = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("soul_trace_profiles")
    .update({ welcome_email_sent_at: stamped })
    .eq("user_email", normalized)
    .is("welcome_email_sent_at", null)
    .select("user_email")
    .maybeSingle();

  if (claimError) {
    // 마이그레이션 전 배포에서도 편지 생성은 살아야 한다.
    console.error("[welcome-email] 발송 표시 실패:", claimError.message);
    return;
  }
  if (!claimed) {
    return;
  }

  const ok = await deliverWelcomeEmail(normalized, locale);
  if (!ok) {
    const { error: clearError } = await supabase
      .from("soul_trace_profiles")
      .update({ welcome_email_sent_at: null })
      .eq("user_email", normalized)
      .eq("welcome_email_sent_at", stamped);
    if (clearError) {
      console.error("[welcome-email] 발송 실패 후 표시 해제 실패:", clearError.message);
    }
    return;
  }

  console.warn("[welcome-email] 환영 메일 발송 — %s", normalized);
}
