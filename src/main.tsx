/* Entry point — mounts the React app, loads the design system, and registers
   the PWA service worker. No StrictMode: the Web Audio graph (a single
   MediaElementSource per <audio>) must not be double-initialized. */
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./save-image"; // side effect: publishes window.StoryImage
import App from "./App";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
