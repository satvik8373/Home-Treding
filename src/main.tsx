import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { DeploymentGate } from './components/DeploymentGate';
import './workspace-ui.css';
import './workspace-primitives.css';

if (window.isSecureContext && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if ('caches' in window) {
      void caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))).catch(() => {})
    }
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(() => { /* Online dashboard remains usable without installation support. */ })
  })
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeploymentGate><App /></DeploymentGate>
  </StrictMode>,
);
