import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TravelMusicProvider } from "./TravelMusic";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TravelMusicProvider><App /></TravelMusicProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
