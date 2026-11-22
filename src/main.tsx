import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./context/AppContext";
import App from "./App";
import "./styles.css";
import { installArabicFormValidation } from "./lib/formValidation";
const removeValidation = installArabicFormValidation(document);
if (import.meta.hot) import.meta.hot.dispose(removeValidation);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
