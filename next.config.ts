import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** 상위 폴더·홈의 다른 lockfile 때문에 Turbopack이 잘못된 루트를 고르는 경고 방지 */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.104"],
  images: {
    qualities: [70, 75, 90],
  },
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
            value: "private, no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
