import fs from "node:fs/promises";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const port = Number(argument("port", "9224"));
const url = argument("url", "http://127.0.0.1:4173/");
const output = argument("output", "video/output/qa/site-mobile-modal.png");
const openModal = argument("open-modal", "true") !== "false";
const viewportWidth = Number(argument("width", "390"));
const viewportHeight = Number(argument("height", "844"));

const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const target = targets.find((item) => item.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("No se encontró una pestaña CDP disponible");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result ?? {});
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1,
  mobile: false,
  screenWidth: viewportWidth,
  screenHeight: viewportHeight,
});
await send("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, 1400));
await send("Runtime.evaluate", { expression: "scrollTo(0, 0)" });
if (openModal) {
  await send("Runtime.evaluate", {
    expression: "document.querySelector('[data-open-sofia]')?.click()",
  });
}
await new Promise((resolve) => setTimeout(resolve, 1800));

const evaluation = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const dialog = document.getElementById('sofia-dialog');
    const video = document.getElementById('sofia-video');
    const rect = dialog?.getBoundingClientRect();
    return {
      dialogOpen: Boolean(dialog?.open),
      viewport: { width: innerWidth, height: innerHeight },
      scrollPosition: { x: scrollX, y: scrollY },
      documentScrollWidth: document.documentElement.scrollWidth,
      dialogRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      videoHidden: Boolean(video?.hidden),
      videoReadyState: video?.readyState ?? null,
      videoDuration: Number.isFinite(video?.duration) ? Number(video.duration.toFixed(3)) : null,
      horizontalOverflows: [...document.querySelectorAll('body *')]
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1))
        .slice(0, 12)
        .map(({ element, rect }) => ({
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          className: typeof element.className === 'string' ? element.className : null,
          left: Number(rect.left.toFixed(1)),
          right: Number(rect.right.toFixed(1)),
          width: Number(rect.width.toFixed(1)),
        })),
    };
  })()`,
});
const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false,
});
await fs.writeFile(output, Buffer.from(screenshot.data, "base64"));
socket.close();

console.log(JSON.stringify({ ok: true, output, ...evaluation.result.value }));
