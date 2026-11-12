import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ClearPendingFreeTrial } from "@/components/clear-pending-free-trial";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { listDurableFreeTrialResults } from "@/lib/free-trial-persistence-server";
import type { ServerSearchParams } from "@/lib/search-params";
import { AUTH_LOCALE_COOKIE, normalizeAuthLocale } from "@/lib/passwordless-auth";

export default async function FreeTrialResultsPage({ searchParams }: { searchParams: Promise<ServerSearchParams> }) {
  const params = await searchParams;
  const claimedParam = Array.isArray(params.claimed) ? params.claimed[0] : params.claimed;
  const locale = normalizeAuthLocale((await cookies()).get(AUTH_LOCALE_COOKIE)?.value);
  const isKorean = locale === "ko";
  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;
  if (!user) redirect("/auth?mode=signin&returnTo=%2Fmy%2Ffree-trial-results");

  const outcome = await listDurableFreeTrialResults(user.id);
  return (
    <main className="min-h-screen bg-[#f7f1e8] px-4 py-10 text-[#5c4636] sm:px-8">
      <section className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="text-sm text-[#8a6248] underline underline-offset-4">{isKorean ? "대시보드로" : "Back to dashboard"}</Link>
        <ClearPendingFreeTrial active={claimedParam === "1"} />
        <h1 className="mt-6 font-serif text-3xl">{isKorean ? "저장된 무료 체험 일러스트" : "My Free Trial illustrations"}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8d7363]">
          {isKorean ? "AI 일러스트는 반려동물 추억 타임라인과 별도로 저장됩니다." : "These AI illustrations are saved separately from your Pet Memories timeline."}
        </p>

        {outcome.status === "disabled" ? (
          <div role="status" className="mt-8 rounded-3xl border border-[#eadfd2] bg-white p-6 text-sm leading-6">
            {isKorean ? "이 환경에서는 무료 체험 결과를 영구 저장할 수 없습니다. 데이터베이스 설정을 검토하고 활성화하기 전까지 미리보기는 임시 상태입니다. 보관하려면 미리보기에서 다운로드해 주세요." : "Permanent Free Trial saving is not enabled in this environment yet. A generated preview is temporary until the database setup is reviewed and enabled. Download a copy from the preview to keep it."}
          </div>
        ) : outcome.status === "unavailable" ? (
          <div role="alert" className="mt-8 rounded-3xl border border-[#eadfd2] bg-white p-6 text-sm leading-6">
            {isKorean ? "저장된 일러스트를 불러오지 못했습니다. 현재 결과를 저장 완료로 표시하지 않았습니다." : "Saved illustrations could not be loaded. No result is being reported as saved right now."}
          </div>
        ) : outcome.results.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-[#eadfd2] bg-white p-6 text-sm leading-6">
            {isKorean ? "아직 영구 저장된 무료 체험 일러스트가 없습니다." : "You do not have any permanently saved Free Trial illustrations yet."}
          </div>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {outcome.results.map((result) => {
              const imageUrl = `/api/try/results/${encodeURIComponent(result.resultId)}`;
              return (
                <li key={result.resultId} className="overflow-hidden rounded-3xl border border-[#eadfd2] bg-white p-3 shadow-[0_10px_30px_rgba(120,80,50,0.05)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={`Saved ${result.style} illustration`} className="aspect-[3/2] w-full rounded-2xl bg-[#f6efe6] object-cover" />
                  <p className="mt-3 text-sm font-medium capitalize">{result.style.replaceAll("-", " ")}</p>
                  <p className="mt-1 text-xs text-[#8d7363]">{result.theme} · {new Date(result.createdAt).toLocaleDateString(isKorean ? "ko-KR" : "en-US")}</p>
                  <a href={imageUrl} download={`soultrace-free-trial-${result.resultId}.jpg`} className="mt-4 block rounded-full border border-[#f0d5c4] py-3 text-center text-sm text-[#8a6248]">
                    {isKorean ? "일러스트 다운로드" : "Download illustration"}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
