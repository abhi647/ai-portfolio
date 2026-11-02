import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "../index.css";
import "./mobile.css";
import MobileApp from "./MobileApp";
import { captureInstallPrompt } from "./install";

captureInstallPrompt();
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
);
