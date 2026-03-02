import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSyncListener, syncWithServer } from "./lib/syncManager";
// @ts-ignore - virtual module provided by vite-plugin-pwa
import { registerSW } from "virtual:pwa-register";

// Register service worker for offline support and background sync
registerSW({
  immediate: true,
  onRegistered(registration) {
    console.log("[App] Service Worker registered:", registration);
  },
  onRegisterError(error) {
    console.error("[App] Service Worker registration failed:", error);
  },
});

// Listen for messages from service worker (e.g., background sync trigger)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "cya-sync") {
      console.log("[App] Received sync message from SW");
      void syncWithServer();
    }
  });
}

// Initialize sync listener for online/offline events
initSyncListener();

createRoot(document.getElementById("root")!).render(<App />);
