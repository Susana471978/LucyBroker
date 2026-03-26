import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { registerSW } from './registerSW';
registerSW();

if (process.env.NODE_ENV === 'production') {
  const { registerSW } = require('./registerSW');
  registerSW();
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
