import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { loadAppSettings, syncTeacherReading } from "@/lib/app-settings";
import { initAuth } from "@/lib/auth";
import { startProfileSync } from "@/lib/profile-sync";
import "@/styles/app.css";

void initAuth();
startProfileSync();
syncTeacherReading();
void loadAppSettings();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
