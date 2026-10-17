const KAKAO_SDK_URL =
  "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";
const KAKAO_SDK_INTEGRITY =
  "sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E";

export type KakaoDefaultShareOptions = {
  objectType: "text";
  text: string;
  link: {
    mobileWebUrl: string;
    webUrl: string;
  };
};

type KakaoShareClient = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: {
    sendDefault: (options: KakaoDefaultShareOptions) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoShareClient;
  }
}

let sdkLoad: Promise<KakaoShareClient> | null = null;

function loadSdk(): Promise<KakaoShareClient> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Kakao sharing is only available in a browser."));
  }
  if (window.Kakao) return Promise.resolve(window.Kakao);
  if (sdkLoad) return sdkLoad;

  sdkLoad = new Promise<KakaoShareClient>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-soul-trace-kakao-sdk="true"]',
    );
    const script = existing ?? document.createElement("script");
    const finish = () => {
      if (window.Kakao) {
        resolve(window.Kakao);
      } else {
        reject(new Error("Kakao SDK loaded without its global client."));
      }
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Kakao SDK could not be loaded.")),
      { once: true },
    );
    if (!existing) {
      script.src = KAKAO_SDK_URL;
      script.integrity = KAKAO_SDK_INTEGRITY;
      script.crossOrigin = "anonymous";
      script.async = true;
      script.dataset.soulTraceKakaoSdk = "true";
      document.head.appendChild(script);
    }
  });

  return sdkLoad;
}

export async function sendKakaoDefaultShare(
  options: KakaoDefaultShareOptions,
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim();
  if (!key) throw new Error("Kakao sharing is not configured.");

  const kakao = await loadSdk();
  if (!kakao.isInitialized()) kakao.init(key);
  kakao.Share.sendDefault(options);
}
