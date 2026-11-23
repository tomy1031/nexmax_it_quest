import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { loadAppSettings, syncTeacherReading } from "@/lib/app-settings";
import { initAuth } from "@/lib/auth";
import "@/styles/app.css";

void initAuth();
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
