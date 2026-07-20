import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { getClientConfig } from "./api/config";
import { AppStateProvider } from "./state/AppStateContext";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AppStateProvider config={getClientConfig()}>
        <App />
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
);
