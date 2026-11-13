import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { DeploymentGate } from './components/DeploymentGate';
import './workspace-ui.css';

if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* Online dashboard remains usable without installation support. */ }) })
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeploymentGate><App /></DeploymentGate>
  </StrictMode>,
);
