import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { DeploymentGate } from './components/DeploymentGate';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeploymentGate><App /></DeploymentGate>
  </StrictMode>,
);
