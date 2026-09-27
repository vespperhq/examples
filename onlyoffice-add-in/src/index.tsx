import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../word-add-in/add-in/src/App";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root");
const root = createRoot(rootElement);

Asc.plugin.init = () => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};
