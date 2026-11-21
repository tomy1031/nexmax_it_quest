import { defineConfig } from "@playwright/test";

/**
 * 最初から最後まで通すテスト（npm run e2e）。開発サーバーを立て、ソフトウェアの描画（SwiftShader）で 3D を動かす。
 * 画面の写真は e2e-screens/ に残る（PR に貼る）。
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 8 * 60 * 1000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
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
    command: "npx vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
