/** The export page (export.html): runs the export in this tab and downloads the file. */
import "@fontsource-variable/inter";
import "../../src/styles/tokens.css";
import "./export.css";
import { indexedDbCache } from "./lib/cache";
import { exportFileName, runExport, type ExportSummary } from "./lib/exporter";
import { progressText } from "./lib/format";
import { SignInError } from "./lib/strava-client";

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} is missing from export.html`);
  return found;
}

function button(id: string): HTMLButtonElement {
  const found = element(id);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`#${id} is not a button`);
  return found;
}

const startButton = button("start");
const stopButton = button("stop");
const againButton = button("again");
const cacheInfo = element("cache-info");
const progressSection = element("progress-section");
const progressTextEl = element("progress-text");
const progressBar = (() => {
  const found = element("progress");
  if (!(found instanceof HTMLProgressElement)) throw new Error("#progress is not a progress bar");
  return found;
})();
const resultSection = element("result");
const statusSlot = element("status-slot");

const cache = indexedDbCache();
let controller: AbortController | null = null;

type Tone = "info" | "positive" | "danger";

/** One status card at the bottom of the page (P12); an error is announced as an alert. */
function showStatus(message: string, tone: Tone) {
  const card = document.createElement("div");
  card.className = `status status-${tone}`;
  card.setAttribute("role", tone === "danger" ? "alert" : "status");
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.setAttribute("aria-hidden", "true");
  const text = document.createElement("p");
  text.textContent = message;
  card.append(dot, text);
  statusSlot.replaceChildren(card);
}

function clearStatus() {
  statusSlot.replaceChildren();
}

async function showCacheInfo() {
  const count = await cache.count().catch(() => 0);
  cacheInfo.textContent =
    count === 0
      ? "No ride details saved yet: the first export downloads a GPX file per ride."
      : `Ride details saved from earlier exports: ${count}.`;
}

function setRunning(running: boolean) {
  startButton.hidden = running;
  stopButton.hidden = !running;
  againButton.disabled = running;
  progressSection.hidden = !running;
}

function showSummary(summary: ExportSummary, fileName: string) {
  element("result-file").textContent = fileName;
  element("n-activities").textContent = String(summary.activities);
  element("n-gpx").textContent = String(summary.ridesWithGpx);
  element("n-no-gpx").textContent = String(summary.ridesWithoutGpx);
  element("n-failed").textContent = String(summary.failed);
  const notes: string[] = [];
  if (summary.rateLimited) {
    notes.push("Strava asked to slow down, so the last rides were not downloaded.");
  }
  if (summary.failed > 0) notes.push("Failed rides are downloaded again in the next export.");
  if (summary.unreadable > 0) {
    notes.push(`${summary.unreadable} activities could not be read and are not in the file.`);
  }
  element("result-note").textContent = notes.join(" ");
  resultSection.hidden = false;
}

function download(content: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}

async function start() {
  controller = new AbortController();
  const { signal } = controller;
  clearStatus();
  resultSection.hidden = true;
  setRunning(true);
  progressTextEl.textContent = "Reading activities";
  progressBar.removeAttribute("value");
  stopButton.focus();

  try {
    const { file, summary } = await runExport({
      version: chrome.runtime.getManifest().version,
      cache,
      fetch: (input, init) => fetch(input, init),
      signal,
      onProgress: (progress) => {
        progressTextEl.textContent = progressText(progress);
        const [value, max] =
          progress.phase === "list"
            ? [progress.read, progress.total]
            : [progress.done, progress.total];
        if (max === null || max === 0) {
          progressBar.removeAttribute("value");
        } else {
          progressBar.max = max;
          progressBar.value = value;
        }
      },
    });
    const fileName = exportFileName(new Date(file.exportedAt));
    download(JSON.stringify(file), fileName);
    showSummary(summary, fileName);
    showStatus(`Saved ${fileName}. Import it on the Import page of Cycling Hub.`, "positive");
  } catch (error) {
    if (signal.aborted) {
      showStatus("Stopped. Ride details downloaded so far are kept for the next export.", "info");
    } else if (error instanceof SignInError) {
      showStatus("Sign in to Strava in this browser, then try again.", "danger");
    } else {
      const reason = error instanceof Error ? ` ${error.message}` : "";
      showStatus(`The export stopped.${reason} Try again later.`, "danger");
    }
  } finally {
    controller = null;
    setRunning(false);
    startButton.focus();
    void showCacheInfo();
  }
}

startButton.addEventListener("click", () => {
  void start();
});

stopButton.addEventListener("click", () => {
  controller?.abort(new DOMException("Stopped", "AbortError"));
});

againButton.addEventListener("click", () => {
  void (async () => {
    await cache.clear().catch(() => undefined);
    await showCacheInfo();
    await start();
  })();
});

void showCacheInfo();
