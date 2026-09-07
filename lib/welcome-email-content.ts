import { getEternalBeamMainUrl } from "./eternalbeam-urls.ts";

export type WelcomeEmailLocale = "ko" | "en";

export function displayNameFromEmail(email: string): string {
  const local = (email.split("@")[0] || "").trim();
  if (!local) return "";
  // 이메일 @ 앞부분을 이름으로 쓴다 (alex.kim+test → Alex Kim Test).
  return local
    .replace(/[._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildWelcomeEmail(
  locale: WelcomeEmailLocale,
  options?: { userName?: string; eternalBeamLink?: string },
): {
  subject: string;
  html: string;
  text: string;
} {
  const home = (options?.eternalBeamLink || getEternalBeamMainUrl()).replace(/\/$/, "");
  const rawName = (options?.userName || "").trim();
  const userName =
    rawName ||
    (locale === "ko" ? "고객" : "friend");

  if (locale === "ko") {
    const greeting = rawName ? `안녕하세요 ${userName}님,` : "안녕하세요,";
    return {
      subject: "Soul Trace 등록이 완료되었습니다",
      text: [
        greeting,
        "",
        "Soul Trace 등록이 완료되었습니다.",
        "",
        "이제 반려동물과 함께한 순간에서 영감을 받은 개인 편지를 만들 수 있습니다. 그 기억을 더 이어가고 싶을 때, 아래에서 Eternal Beam 경험을 만나보세요.",
        "",
        `Eternal Beam 둘러보기: ${home}`,
        "",
        "따뜻한 마음과 함께,",
        "Soul Trace 팀",
      ].join("\n"),
      html: `
        <div style="font-family:Georgia,'Apple SD Gothic Neo',sans-serif;line-height:1.65;color:#17130E;max-width:32rem;margin:0 auto;padding:1.5rem">
          <p style="font-size:1.05rem;margin:0 0 1rem">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 1rem">Soul Trace 등록이 완료되었습니다.</p>
          <p style="margin:0 0 1.25rem;color:#4a4035">이제 반려동물과 함께한 순간에서 영감을 받은 개인 편지를 만들 수 있습니다. 그 기억을 더 이어가고 싶을 때, 아래에서 Eternal Beam 경험을 만나보세요.</p>
          <p style="margin:0 0 1.5rem">
            <a href="${home}" style="display:inline-block;background:#17130E;color:#F3EAD8;text-decoration:none;padding:0.85rem 1.4rem;border-radius:999px">
              Eternal Beam 둘러보기
            </a>
          </p>
          <p style="margin:0;font-size:0.95rem;color:#4a4035">따뜻한 마음과 함께,<br/>Soul Trace 팀</p>
          <p style="margin:1.25rem 0 0;font-size:0.8rem;color:#8a7f72"><a href="${home}" style="color:#8a7f72">${home}</a></p>
        </div>
      `.trim(),
    };
  }

  const greeting = `Hello ${userName},`;
  return {
    subject: "Your Soul Trace registration is complete",
    text: [
      greeting,
      "",
      "Your Soul Trace registration is complete.",
      "",
      "You can now create personal letters inspired by the moments you share with your pet. When you’re ready to take those memories further, discover the Eternal Beam experience below.",
      "",
      `Explore Eternal Beam: ${home}`,
      "",
      "With warmth,",
      "The Soul Trace Team",
    ].join("\n"),
    html: `
      <div style="font-family:Georgia,serif;line-height:1.65;color:#17130E;max-width:32rem;margin:0 auto;padding:1.5rem">
        <p style="font-size:1.05rem;margin:0 0 1rem">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 1rem">Your Soul Trace registration is complete.</p>
        <p style="margin:0 0 1.25rem;color:#4a4035">You can now create personal letters inspired by the moments you share with your pet. When you’re ready to take those memories further, discover the Eternal Beam experience below.</p>
        <p style="margin:0 0 1.5rem">
          <a href="${home}" style="display:inline-block;background:#17130E;color:#F3EAD8;text-decoration:none;padding:0.85rem 1.4rem;border-radius:999px">
            Explore Eternal Beam
          </a>
        </p>
        <p style="margin:0;font-size:0.95rem;color:#4a4035">With warmth,<br/>The Soul Trace Team</p>
        <p style="margin:1.25rem 0 0;font-size:0.8rem;color:#8a7f72"><a href="${home}" style="color:#8a7f72">${home}</a></p>
      </div>
    `.trim(),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
