"use client";

import { useLocale } from "@/components/locale-provider";
import { CollarProvider, useCollar } from "@/components/collar/collar-provider";
import { storyTabProps } from "@/components/pet-first-home";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import {
  canSendToDevice,
  COLLAR_FACES,
  collarLabels,
  OVERLAY_METRICS,
  WAKE_POLICIES,
  type CollarConfig,
  type OverlayMetric,
} from "@/lib/collar-config";
import { petFirstCopy } from "@/lib/pet-first-archive";
import { UIUX_GARDEN_HERO } from "@/lib/uiux-art";
import Image from "next/image";
import Link from "next/link";

export type CollarStep = "hub" | "face" | "info" | "send";

const PATHS = {
  hub: "/my/collar",
  face: "/my/collar/face",
  info: "/my/collar/info",
  send: "/my/collar/send",
} as const;

function withPet(path: string, petId: string | null) {
  return petId ? `${path}?pet=${encodeURIComponent(petId)}` : path;
}

const COPY = {
  ko: {
    demo: "시뮬레이션 · 실제 블루투스 기기는 연결되지 않았어요",
    hubEyebrow: "SOULTRACE / SMART COLLAR",
    hubTitle: "%NAME%의 스마트 목걸이",
    hubBody: "사진과 일상을 작고 특별한 원형 화면에 담아주세요.",
    screenCardTitle: "%NAME%만의 작은 화면",
    screenCardBody: "사진 · 시간 · 활동 · 보호자 정보",
    beforeConnect: "기기 연결 전",
    deviceCardTitle: "%NAME%의 목걸이",
    beforeConnectBody: "배터리와 동기화 정보는 실제 연결 이후 확인할 수 있어요.",
    howToConnect: "다음 화면 보기",
    connectTitle: "아직 기기를 찾을 수 없어요",
    connectBody: "블루투스 페어링은 목걸이 펌웨어가 준비된 뒤에 열려요. 지금은 화면 꾸미기만 미리 볼 수 있고, 연결되었다고 표시하지 않아요.",
    todayTitle: "오늘은 무엇을 할까요?",
    todayCount: "4가지 핵심 기능",
    faceTile: "원형 화면 꾸미기",
    faceTileBody: "사진 · 시계 · 활동량 페이스",
    photoTile: "추억 사진 보내기",
    photoTileBody: "아카이브의 사진 고르기",
    activityTile: "활동 기록",
    activityTileBody: "Sense 움직임 센서",
    contactTile: "분실 연락처",
    contactTileBody: "이름과 연락처 화면",
    moreTitle: "더 많은 기능",
    animTile: "움직이는 사진 설정",
    notifyTile: "휴대폰 알림",
    unavailable: "이 기능은 기기가 연결된 뒤에 열려요. 지금은 측정값이나 알림을 만들어 보여주지 않아요.",
    previewNote: "디자인 미리보기입니다. 현재 웹 화면에서는 실제 BLE 페어링이나 기기 동기화를 수행하지 않습니다.",
    deviceStatus: "기기 상태",
    link: "연결 상태",
    battery: "배터리",
    lastSync: "마지막 동기화",
    noRecord: "기록 없음",
    recentWalk: "최근 산책",
    walkSoon: "휴대폰 GPS 산책 기록은 준비 중이에요. 기록이 없으면 숫자를 만들어 보여주지 않아요.",
    design: "화면 꾸미기",
    simulateConnect: "시뮬레이션으로 연결해 보기",
    disconnect: "연결 끊기",
    connecting: "연결하는 중",
    noDeviceNote: "기기가 연결되지 않으면 배터리와 동기화 시각은 추측해서 표시하지 않아요.",
    steps: ["페이스", "표시 정보", "목걸이로 보내기"],
    faceEyebrow: "CHOOSE A FACE",
    faceTitle: "우리 아이에게 어울리는\n페이스를 골라요",
    faceBody: "아래 스타일을 누르면 원형 화면이 바로 바뀌어요. 고른 값은 다음 화면에도 그대로 남아요.",
    faceList: "페이스 스타일 5가지",
    videoNote: "영상형은 움직이는 모습을 보여주는 콘셉트예요. 1.28인치 화면의 실제 영상 재생은 프레임 형식·저장 공간·전력·BLE 전송량을 검증한 뒤 정해져요.",
    toInfo: "보여줄 정보 정하기",
    infoEyebrow: "MAKE IT YOURS",
    infoTitle: "필요한 정보를\n예쁘게 배치해요",
    infoBody: "위·아래 정보와 밝기를 바꾸면 원형 미리보기에 바로 반영돼요.",
    top: "위쪽에 보여줄 정보",
    bottom: "아래쪽에 보여줄 정보",
    brightness: "화면 밝기",
    wake: "화면 켜짐 방식",
    wakeNote: "항상 켜짐은 배터리 소모가 커요. 움직임 감지는 실제 착용 조건에서 펌웨어를 검증한 뒤 지원 여부를 정해요.",
    toSend: "설정 요약 보기",
    sendEyebrow: "READY TO SEND",
    sendTitle: "이 화면을\n목걸이에 보내기",
    sendBody: "앞에서 고른 설정이 그대로 요약돼요. 적용됨은 기기가 받았다는 확인이 온 뒤에만 표시해요.",
    summary: "내가 고른 설정",
    face: "페이스",
    content: "보여줄 콘텐츠",
    contentSample: "고야 일러스트 (예시)",
    transfer: "전송 상태",
    sendButton: "목걸이로 보내기",
    sending: "보내는 중",
    cancelSend: "보내기 취소",
    sendDisabled: "먼저 기기 상태에서 시뮬레이션 연결을 해 주세요. 실제 전송은 나중에 블루투스 어댑터로 바꿉니다.",
    ackNote: "기기가 받았다는 확인(ACK)이 오기 전에는 '적용됨'으로 표시하지 않아요.",
    previewCaption: "1.28″ 원형 화면 구성 미리보기 · 걸음·거리 숫자는 예시이며 실제 색·움직임과 다를 수 있어요",
    back: "홈",
  },
  en: {
    demo: "Simulation · no real Bluetooth device is connected",
    hubEyebrow: "SOULTRACE / SMART COLLAR",
    hubTitle: "%NAME%'s smart collar",
    hubBody: "Keep photos and daily moments on a small round screen.",
    screenCardTitle: "A small screen for %NAME%",
    screenCardBody: "Photo · time · activity · caregiver",
    beforeConnect: "Before the device connects",
    deviceCardTitle: "%NAME%'s collar",
    beforeConnectBody: "Battery and sync appear only after a real connection.",
    howToConnect: "Open the next screen",
    connectTitle: "No device to find yet",
    connectBody: "Bluetooth pairing opens after the collar firmware is ready. You can preview the screen now. This page will not say it is connected.",
    todayTitle: "What shall we do today?",
    todayCount: "4 main tools",
    faceTile: "Design the round face",
    faceTileBody: "Photo, clock, and activity faces",
    photoTile: "Send a memory photo",
    photoTileBody: "Choose a photo from the archive",
    activityTile: "Activity",
    activityTileBody: "Sense motion sensor",
    contactTile: "Lost-pet contact",
    contactTileBody: "Name and phone on the face",
    moreTitle: "More",
    animTile: "Motion photo settings",
    notifyTile: "Phone notifications",
    unavailable: "This opens after a device is connected. No measurements or alerts are invented now.",
    previewNote: "This is a design preview. This web page does not pair over BLE or sync a device.",
    deviceStatus: "Device status",
    link: "Connection",
    battery: "Battery",
    lastSync: "Last sync",
    noRecord: "No record",
    recentWalk: "Recent walk",
    walkSoon: "Phone-GPS walk records are in preparation. Without records, no numbers are invented.",
    design: "Design the screen",
    simulateConnect: "Connect in simulation",
    disconnect: "Disconnect",
    connecting: "Connecting",
    noDeviceNote: "Without a connected device, battery and sync time are never guessed.",
    steps: ["Face", "Information", "Send"],
    faceEyebrow: "CHOOSE A FACE",
    faceTitle: "Pick a face\nthat suits your pet",
    faceBody: "Tap a style and the round preview changes right away. The choice stays on the next screens.",
    faceList: "5 face styles",
    videoNote: "Motion is a concept for showing your pet moving. Real playback on the 1.28-inch screen depends on verified frame format, storage, power and BLE throughput.",
    toInfo: "Choose what to show",
    infoEyebrow: "MAKE IT YOURS",
    infoTitle: "Arrange the details\nyou need",
    infoBody: "Changes to top, bottom and brightness appear in the preview immediately.",
    top: "Top information",
    bottom: "Bottom information",
    brightness: "Brightness",
    wake: "Screen wake",
    wakeNote: "Always-on uses much more battery. Motion wake will be confirmed after firmware testing on a worn collar.",
    toSend: "Review settings",
    sendEyebrow: "READY TO SEND",
    sendTitle: "Send this screen\nto the collar",
    sendBody: "The summary uses the settings you chose. Applied appears only after the device confirms it.",
    summary: "Your settings",
    face: "Face",
    content: "Content",
    contentSample: "Goya illustration (sample)",
    transfer: "Transfer status",
    sendButton: "Send to collar",
    sending: "Sending",
    cancelSend: "Cancel send",
    sendDisabled: "Connect in simulation from the device status screen first. Real sending will later use a Bluetooth adapter.",
    ackNote: "Nothing is shown as applied until the device confirms it (ACK).",
    previewCaption: "1.28″ round screen layout preview · step and distance numbers are samples; real colors and motion may differ",
    back: "Home",
  },
} as const;

export function CollarStudioRoute({
  step,
  pet = null,
}: {
  step: CollarStep;
  pet?: { petId: string; petName: string } | null;
}) {
  return (
    <CollarProvider pet={pet}>
      <CollarStudio step={step} />
    </CollarProvider>
  );
}

export function CollarStudio({ step }: { step: CollarStep }) {
  const { lang } = useLocale();
  const t = COPY[lang === "en" ? "en" : "ko"];
  const labels = collarLabels(lang === "en" ? "en" : "ko");
  const copy = petFirstCopy(lang);
  const collar = useCollar();
  const name = collar.pet?.petName || (lang === "en" ? "Your pet" : "우리 아이");
  const sendable = canSendToDevice(collar.device.link, { ...collar.config, deviceId: collar.device.deviceId });
  const busy = collar.transfer === "queued" || collar.transfer === "transferring" || collar.transfer === "awaiting_ack";
  const petId = collar.pet?.petId ?? null;
  const faceHref = withPet(PATHS.face, petId);
  const infoHref = withPet(PATHS.info, petId);
  const sendHref = withPet(PATHS.send, petId);
  const hubHref = withPet("/my/device", petId);

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader
          backHref={step === "hub" ? "/dashboard/living" : step === "face" ? hubHref : step === "info" ? faceHref : infoHref}
          backLabel={step === "hub" ? t.back : undefined}
          settingsHref="/settings"
          settingsLabel={copy.settingsTitle}
        />
        {step === "hub" ? (
          <section className="st-rise mt-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#ad8655]">{t.hubEyebrow}</p>
            <h1 id="collar-title" className="st-headline mt-2 text-[1.7rem]">{t.hubTitle.replaceAll("%NAME%", name)}</h1>
            <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{t.hubBody}</p>
          </section>
        ) : (
          <p role="note" className="mt-3 rounded-full bg-[color:var(--st-beige)] px-4 py-2 text-center text-xs">{t.demo}</p>
        )}

        {step !== "hub" ? (
          <ol className="mt-5 grid grid-cols-3 gap-2" aria-label={t.design}>
            {(["face", "info", "send"] as const).map((value, index) => (
              <li key={value}>
                <Link
                  href={withPet(PATHS[value], petId)}
                  aria-current={step === value ? "step" : undefined}
                  className={`st-btn min-h-11 w-full px-2 text-xs ${step === value ? "st-btn-sage" : "st-btn-quiet"}`}
                >
                  {index + 1} · {t.steps[index]}
                </Link>
              </li>
            ))}
          </ol>
        ) : null}

        {step === "hub" ? null : (
          <section className="st-rise mt-6" aria-labelledby="collar-title">
            <p className="st-eyebrow">{step === "face" ? t.faceEyebrow : step === "info" ? t.infoEyebrow : t.sendEyebrow}</p>
            <h1 id="collar-title" className="st-headline mt-2 whitespace-pre-line text-[1.75rem]">
              {step === "face" ? t.faceTitle : step === "info" ? t.infoTitle : t.sendTitle}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">
              {step === "face" ? t.faceBody : step === "info" ? t.infoBody : t.sendBody}
            </p>
          </section>
        )}

        {step === "hub" ? <HubPanel t={t} name={name} petId={petId} faceHref={faceHref} /> : (
          <CollarPreview
            config={collar.config}
            name={name}
            labels={labels}
            caption={t.previewCaption}
            connected={collar.device.link === "connected"}
          />
        )}

        {step === "face" ? <FacePanel t={t} labels={labels} nextHref={infoHref} /> : null}
        {step === "info" ? <InfoPanel t={t} labels={labels} nextHref={sendHref} /> : null}
        {step === "send" ? <SendPanel t={t} labels={labels} sendable={sendable} busy={busy} /> : null}
      </main>
      <StoryTabbar current="context" {...storyTabProps(copy, collar.pet?.petId ?? null, true, "living")} />
    </div>
  );
}

type CollarCopy = (typeof COPY)[keyof typeof COPY];

function HubPanel({ t, name, petId, faceHref }: { t: CollarCopy; name: string; petId: string | null; faceHref: string }) {
  const album = petId ? `/my/pets/${petId}#album` : "/my/pets";
  return (
    <>
      <article className="relative mt-5 overflow-hidden rounded-[22px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={UIUX_GARDEN_HERO} alt="" className="aspect-[16/9] w-full object-cover object-[center_28%]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2f2618]/80 to-transparent px-5 pb-4 pt-12 text-[#fff7ea]">
          <p className="text-lg font-medium">{t.screenCardTitle.replaceAll("%NAME%", name)}</p>
          <p className="mt-1 text-xs text-[#fff7ea]/85">{t.screenCardBody}</p>
        </div>
      </article>

      <div className="mt-4 grid grid-cols-[7.5rem_1fr] items-center gap-3">
        <img src="/images/collar/face-photo-240.png" alt="" width={240} height={240} className="aspect-square w-full rounded-full bg-[#1d1916] object-cover ring-4 ring-[#efe4d2]" />
        <div className="min-w-0">
          <p className="text-xs text-[#ad8655]">{t.beforeConnect}</p>
          <p className="mt-1 font-medium">{t.deviceCardTitle.replaceAll("%NAME%", name)}</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--st-text-soft)]">{t.beforeConnectBody}</p>
          <Link href={faceHref} className="st-btn st-btn-primary mt-3 w-full text-sm">{t.howToConnect}</Link>
        </div>
      </div>

      <div className="mt-8 flex items-end justify-between gap-3">
        <h2 className="st-headline text-xl">{t.todayTitle}</h2>
        <p className="text-xs text-[color:var(--st-text-soft)]">{t.todayCount}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <HubTile href={faceHref} title={t.faceTile} body={t.faceTileBody} />
        <HubTile href={album} title={t.photoTile} body={t.photoTileBody} />
        <HubTile href="/walks" title={t.activityTile} body={t.activityTileBody} />
        <HubTile href="#collar-contact" title={t.contactTile} body={t.contactTileBody} />
      </div>

      <h2 className="st-headline mt-8 text-xl">{t.moreTitle}</h2>
      <div className="mt-3 grid gap-3">
        <HubRow href="#collar-motion" title={t.animTile} />
        <HubRow href="#collar-alerts" title={t.notifyTile} />
      </div>

      <div className="mt-4 grid gap-3">
        <p id="collar-connect" className="st-card scroll-mt-6 px-5 py-4 text-sm"><strong className="block font-medium">{t.connectTitle}</strong><span className="mt-1 block text-[color:var(--st-text-soft)]">{t.connectBody}</span></p>
        <p id="collar-activity" className="st-card scroll-mt-6 px-5 py-4 text-sm text-[color:var(--st-text-soft)]">{t.unavailable}</p>
        <p id="collar-contact" className="st-card scroll-mt-6 px-5 py-4 text-sm text-[color:var(--st-text-soft)]">{t.unavailable}</p>
        <p id="collar-motion" className="st-card scroll-mt-6 px-5 py-4 text-sm text-[color:var(--st-text-soft)]">{t.unavailable}</p>
        <p id="collar-alerts" className="st-card scroll-mt-6 px-5 py-4 text-sm text-[color:var(--st-text-soft)]">{t.unavailable}</p>
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-[color:var(--st-text-soft)]">{t.previewNote}</p>
    </>
  );
}

function HubTile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="st-card flex min-h-28 flex-col justify-center px-4 py-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--st-text-soft)]">{body}</p>
    </Link>
  );
}

function HubRow({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className="st-card flex min-h-14 items-center justify-between px-5 py-3">
      <span className="font-medium">{title}</span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}

function FacePanel({ t, labels, nextHref }: { t: CollarCopy; labels: ReturnType<typeof collarLabels>; nextHref: string }) {
  const collar = useCollar();
  return (
    <>
      <h2 className="st-headline mt-8 text-xl">{t.faceList}</h2>
      <div className="mt-3 grid grid-cols-3 gap-3" role="group" aria-label={t.faceList}>
        {COLLAR_FACES.map((face) => (
          <button
            key={face}
            type="button"
            aria-pressed={collar.config.face === face}
            onClick={() => collar.edit({ type: "face", value: face })}
            className={`st-card flex min-h-20 flex-col items-center justify-center gap-1 px-2 py-3 text-sm ${collar.config.face === face ? "ring-2 ring-[color:var(--st-sage-deep)]" : ""}`}
          >
            <FaceGlyph face={face} />
            {labels.faces[face]}
          </button>
        ))}
      </div>
      {collar.config.face === "video" ? <p className="st-card mt-4 px-5 py-4 text-sm">{t.videoNote}</p> : null}
      <Link href={nextHref} className="st-btn st-btn-primary mt-6 w-full">{t.toInfo}</Link>
    </>
  );
}

function InfoPanel({ t, labels, nextHref }: { t: CollarCopy; labels: ReturnType<typeof collarLabels>; nextHref: string }) {
  const collar = useCollar();
  return (
    <div className="mt-8 space-y-5">
      <MetricSelect id="collar-top" label={t.top} value={collar.config.top} labels={labels.metrics} onChange={(value) => collar.edit({ type: "top", value })} />
      <MetricSelect id="collar-bottom" label={t.bottom} value={collar.config.bottom} labels={labels.metrics} onChange={(value) => collar.edit({ type: "bottom", value })} />
      <div>
        <label htmlFor="collar-brightness" className="mb-1.5 block text-sm font-medium">{t.brightness} <strong>{collar.config.brightness}%</strong></label>
        <input id="collar-brightness" type="range" min={10} max={100} step={5} value={collar.config.brightness} onChange={(event) => collar.edit({ type: "brightness", value: Number(event.target.value) })} className="w-full accent-[color:var(--st-sage-deep)]" />
      </div>
      <div>
        <label htmlFor="collar-wake" className="mb-1.5 block text-sm font-medium">{t.wake}</label>
        <select id="collar-wake" value={collar.config.wake} onChange={(event) => collar.edit({ type: "wake", value: event.target.value as CollarConfig["wake"] })} className="st-field">
          {WAKE_POLICIES.map((value) => <option key={value} value={value}>{labels.wake[value]}</option>)}
        </select>
      </div>
      <p className="text-xs text-[color:var(--st-text-soft)]">{t.wakeNote}</p>
      <Link href={nextHref} className="st-btn st-btn-primary w-full">{t.toSend}</Link>
    </div>
  );
}

function SendPanel({ t, labels, sendable, busy }: { t: CollarCopy; labels: ReturnType<typeof collarLabels>; sendable: boolean; busy: boolean }) {
  const collar = useCollar();
  return (
    <>
      <h2 className="st-headline mt-8 text-xl">{t.summary}</h2>
      <dl className="st-card mt-3 divide-y divide-[color:var(--st-card-edge)] px-5">
        <Row label={t.face} value={labels.faces[collar.config.face]} />
        <Row label={t.top} value={labels.metrics[collar.config.top]} />
        <Row label={t.bottom} value={labels.metrics[collar.config.bottom]} />
        <Row label={t.brightness} value={`${collar.config.brightness}%`} />
        <Row label={t.wake} value={labels.wake[collar.config.wake]} />
        <Row label={t.content} value={t.contentSample} />
      </dl>
      <h2 className="st-headline mt-8 text-xl">{t.transfer}</h2>
      <div className="st-card mt-3 px-5 py-4">
        <p className="font-medium" aria-live="polite">
          {labels.transfer[collar.transfer]} · {labels.link[collar.device.link]}
          {busy ? ` · ${collar.progress}%` : ""}
        </p>
        <p className="mt-1 text-xs text-[color:var(--st-text-soft)]">{t.ackNote}</p>
      </div>
      {busy ? (
        <button type="button" onClick={collar.cancel} className="st-btn st-btn-quiet mt-6 w-full">{t.cancelSend}</button>
      ) : (
        <button type="button" disabled={!sendable} onClick={collar.send} aria-describedby="collar-send-hint" className="st-btn st-btn-primary mt-6 w-full">
          {t.sendButton}
        </button>
      )}
      <p id="collar-send-hint" className="mt-3 text-xs text-[color:var(--st-text-soft)]">{sendable ? t.ackNote : t.sendDisabled}</p>
    </>
  );
}

function CollarPreview({
  config,
  name,
  labels,
  caption,
  connected,
}: {
  config: CollarConfig;
  name: string;
  labels: ReturnType<typeof collarLabels>;
  caption: string;
  connected: boolean;
}) {
  const sample: Record<OverlayMetric, string> = {
    name,
    steps: connected ? "예시" : "--",
    elapsed: connected ? "예시" : "--",
    distance: connected ? "예시" : "--",
    battery: "--",
    heart: "♡",
    none: "",
  };
  return (
    <figure className="mt-6 flex flex-col items-center">
      <div className="rounded-full bg-gradient-to-br from-[#d9cdb8] via-[#b9ab94] to-[#8b7e6b] p-3 shadow-[0_18px_40px_-18px_rgba(58,44,30,0.7)]">
        <div
          className="relative size-56 overflow-hidden rounded-full bg-[#1d1916] ring-4 ring-[#2b2622] sm:size-60"
          style={{ filter: `brightness(${0.55 + config.brightness / 220})` }}
          role="img"
          aria-label={`${labels.faces[config.face]} · ${labels.metrics[config.top]} · ${labels.metrics[config.bottom]}`}
        >
          {config.face === "video" || config.face === "photo" ? (
            <Image src={config.face === "video" ? "/images/design/spring-running.jpg" : "/images/soultrace-splash-background.png"} alt="" fill sizes="240px" quality={90} className="object-cover object-[center_30%]" />
          ) : null}
          {config.face === "steps" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#f3e9d8]">
              <span className="st-headline text-5xl">{connected ? "—" : "--"}</span>
              <span className="mt-1 text-[0.65rem] tracking-[0.3em] text-[#d8bf8a]">STEPS</span>
            </div>
          ) : null}
          {config.face === "ring" ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="absolute inset-4" aria-hidden="true">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#3b332c" strokeWidth="6" />
                {connected ? (
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#b8955a" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${0.35 * 276.5} 276.5`} transform="rotate(-90 50 50)" />
                ) : null}
              </svg>
              <span className="st-headline text-4xl text-[#f3e9d8]">{connected ? "예시" : "--"}</span>
            </div>
          ) : null}
          {config.face === "minimal" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#d8bf8a]">
              <span className="text-5xl" aria-hidden="true">♡</span>
            </div>
          ) : null}
          {config.top !== "none" ? <span className="absolute inset-x-0 top-6 text-center text-sm font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{sample[config.top]}</span> : null}
          {config.bottom !== "none" ? <span className="absolute inset-x-0 bottom-6 text-center text-sm font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{sample[config.bottom]}</span> : null}
        </div>
      </div>
      <figcaption className="mt-3 max-w-xs text-center text-xs text-[color:var(--st-text-soft)]">{caption}</figcaption>
    </figure>
  );
}

function FaceGlyph({ face }: { face: CollarConfig["face"] }) {
  const glyph = { video: "▣", steps: "◎", ring: "◉", minimal: "♡", photo: "▧" }[face];
  return <span aria-hidden="true" className="text-xl text-[color:var(--st-brown)]">{glyph}</span>;
}

function MetricSelect({ id, label, value, labels, onChange }: { id: string; label: string; value: OverlayMetric; labels: Record<OverlayMetric, string>; onChange: (value: OverlayMetric) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as OverlayMetric)} className="st-field">
        {OVERLAY_METRICS.map((metric) => <option key={metric} value={metric}>{labels[metric]}</option>)}
      </select>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-[color:var(--st-text-soft)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
