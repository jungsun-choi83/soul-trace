import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** 상위 폴더·홈의 다른 lockfile 때문에 Turbopack이 잘못된 루트를 고르는 경고 방지 */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
