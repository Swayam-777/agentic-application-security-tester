import { el } from "./dom.js";

export function toast(message, kind = "info") {
  const stack = document.getElementById("toast-stack");
  const node = el("div", { cls: "toast" + (kind !== "info" ? " " + kind : ""), text: message });
  stack.appendChild(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transition = "opacity 0.2s ease";
    setTimeout(() => node.remove(), 200);
  }, 4000);
}

export function statusLine(container, message, kind = "info") {
  container.replaceChildren();
  if (!message) return;
  container.appendChild(el("div", { cls: "status-line " + kind, text: message }));
}
