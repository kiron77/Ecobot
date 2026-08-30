import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTheme } from "./lib/theme";

initTheme(); // apply saved mode + accent before render

createRoot(document.getElementById("root")!).render(<App />);
