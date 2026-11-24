import { defineConfig } from "@playwright/test";

/**
 * 最初から最後まで通すテスト（npm run e2e）。開発サーバーを立て、ソフトウェアの描画（SwiftShader）で 3D を動かす。
 * 画面の写真は e2e-screens/ に残る（PR に貼る）。
 */
/** テスト用の開発サーバーのポート。2つの作業を同時に動かすときは E2E_PORT で分ける。 */
const PORT = Number(process.env.E2E_PORT ?? 5174);

export default defineConfig({
  testDir: "e2e",
  timeout: 8 * 60 * 1000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
