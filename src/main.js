import "./styles.css";
import { initAnimationKit } from "./animation-kit.js";
import {
  createPublicClient,
  decodeEventLog,
  decodeFunctionData,
  defineChain,
  formatUnits,
  hexToString,
  http,
  isAddress,
  isHash,
  parseAbi,
} from "viem";

const ARC_RPC = "https://rpc.testnet.arc.network";
const ARC_EXPLORER = "https://testnet.arcscan.app";
const MEMO_ADDRESS = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const LIVE_DEMO_HASH = "0x985affa890c9b02bff0b72b11848de16505866a663b3e3c02d7707c13344214b";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
  blockExplorers: { default: { name: "Arcscan", url: ARC_EXPLORER } },
});

const client = createPublicClient({ chain: arcTestnet, transport: http(ARC_RPC) });
const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const memoAbi = parseAbi([
  "function memo(address target, bytes data, bytes32 memoId, bytes memoData)",
  "event BeforeMemo(uint256 indexed memoIndex)",
  "event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)",
]);

const $ = (selector) => document.querySelector(selector);
const ui = {
  form: $("#scan-form"), input: $("#tx-hash"), demo: $("#demo-btn"), retry: $("#retry-btn"),
  empty: $("#empty-state"), loading: $("#loading-state"), error: $("#error-state"), results: $("#results"),
  errorMessage: $("#error-message"), loadingTitle: $("#loading-title"), loadingDetail: $("#loading-detail"),
  subtitle: $("#workspace-subtitle"), copyReport: $("#copy-report"), exportTest: $("#export-test"), explorer: $("#explorer-link"),
  status: $("#metric-status"), finality: $("#metric-finality"), calls: $("#metric-calls"), value: $("#metric-value"), token: $("#metric-token"), risks: $("#metric-risks"),
  txShort: $("#tx-short"), statusPill: $("#tx-status-pill"), timeline: $("#timeline"), context: $("#context-list"), warnings: $("#warnings"),
  replayFrom: $("#replay-from"), replayTo: $("#replay-to"), replayData: $("#replay-data"), runReplay: $("#run-replay"), replayResult: $("#replay-result"), toast: $("#toast"),
};

let currentReport = null;
let lastHash = "";

function setState(state) {
  ui.empty.hidden = state !== "empty";
  ui.loading.hidden = state !== "loading";
  ui.error.hidden = state !== "error";
  ui.results.hidden = state !== "results";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
}

function short(value, left = 7, right = 5) {
  if (!value) return "—";
  return value.length > left + right + 3 ? `${value.slice(0, left)}…${value.slice(-right)}` : value;
}

function decodeText(hex) {
  if (!hex || hex === "0x") return "Empty memo";
  try {
    const text = hexToString(hex).replace(/\0/g, "").trim();
    return text && /^[\x20-\x7E\n\r\t]+$/.test(text) ? text : short(hex, 14, 8);
  } catch { return short(hex, 14, 8); }
}

function formatAmount(value, decimals = 6, maximum = 6) {
  const raw = formatUnits(value, decimals);
  const number = Number(raw);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: maximum }).format(number)
    : raw;
}

function toDate(timestamp) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(Number(timestamp) * 1000));
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => ui.toast.classList.remove("show"), 2300);
}

function setLoading(step, detail) {
  ui.loadingTitle.textContent = step;
  ui.loadingDetail.textContent = detail;
}

function parseMemoInput(transaction) {
  if (transaction.to?.toLowerCase() !== MEMO_ADDRESS.toLowerCase() || !transaction.input || transaction.input === "0x") return null;
  try {
    const decoded = decodeFunctionData({ abi: memoAbi, data: transaction.input });
    if (decoded.functionName !== "memo") return null;
    const [target, data, memoId, memoData] = decoded.args;
    return { target, data, memoId, memoData, text: decodeText(memoData) };
  } catch { return null; }
}

function parseReceiptLogs(receipt) {
  const transfers = [];
  const memos = [];
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics, strict: false });
      if (event.eventName === "Transfer" && event.args.from && event.args.to && event.args.value !== undefined) {
        transfers.push({
          logIndex: Number(log.logIndex), token: log.address, from: event.args.from,
          to: event.args.to, value: event.args.value,
          symbol: log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() ? "USDC" : "TOKEN",
          decimals: log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() ? 6 : 18,
        });
      }
    } catch { /* not a transfer log */ }

    if (log.address.toLowerCase() === MEMO_ADDRESS.toLowerCase()) {
      try {
        const event = decodeEventLog({ abi: memoAbi, data: log.data, topics: log.topics, strict: false });
        if (event.eventName === "Memo") {
          memos.push({ logIndex: Number(log.logIndex), ...event.args, text: decodeText(event.args.memo) });
        }
      } catch { /* unknown memo log */ }
    }
  }
  return { transfers, memos };
}

function buildWarnings({ transaction, receipt, transfers, memos, memoInput }) {
  const warnings = [];
  if (receipt.status !== "success") warnings.push({ title: "Transaction reverted", text: "The state changes and child events were rolled back.", level: "risk" });
  if (transfers.length && !memos.length) warnings.push({ title: "Transfer has no Arc memo", text: "No call-level business reference was found for reconciliation.", level: "review" });
  if (memoInput && !memos.length) warnings.push({ title: "Memo call emitted no Memo event", text: "The wrapper may have reverted or the receipt did not contain a successful child call.", level: "risk" });
  if (!transaction.input || transaction.input === "0x") warnings.push({ title: "Plain value transfer", text: "There is no contract calldata to decode or replay beyond the native transfer.", level: "review" });
  if (!transfers.length && !memos.length && transaction.input !== "0x") warnings.push({ title: "Unknown contract interface", text: "The call completed, but ArcReplay could not label its custom events without an ABI.", level: "review" });
  if (!warnings.length) warnings.push({ title: "No basic risk signals found", text: "Receipt, transfer and memo events are internally consistent. This is not a security audit.", level: "good" });
  return warnings;
}

function makeActions({ transaction, receipt, transfers, memos, memoInput }) {
  const items = [{
    order: -1, type: "CALL", title: "Transaction submitted",
    description: `${short(transaction.from, 12, 8)} → ${short(transaction.to || "Contract creation", 12, 8)}`,
    value: transaction.value > 0n ? `${formatAmount(transaction.value, 18)} USDC` : "Contract call",
    state: receipt.status === "success" ? "Accepted" : "Reverted",
  }];
  for (const transfer of transfers) items.push({
    order: transfer.logIndex, type: transfer.symbol === "USDC" ? "USDC TRANSFER" : "TOKEN TRANSFER",
    title: `Transfer ${formatAmount(transfer.value, transfer.decimals)} ${transfer.symbol}`,
    description: `${short(transfer.from, 12, 8)} → ${short(transfer.to, 12, 8)}`,
    value: `${formatAmount(transfer.value, transfer.decimals)} ${transfer.symbol}`, state: "Emitted",
  });
  for (const memo of memos) items.push({
    order: memo.logIndex, type: "ARC MEMO", title: memo.text,
    description: `Memo #${memo.memoIndex} · ID ${short(memo.memoId, 12, 8)} · target ${short(memo.target, 10, 6)}`,
    value: "Context attached", state: "Verified",
  });
  if (memoInput && !memos.length) items.push({
    order: 999999, type: "MEMO INPUT", title: memoInput.text,
    description: `Target ${short(memoInput.target, 12, 8)} · event unavailable`,
    value: "Decoded input", state: "Unverified",
  });
  return items.sort((a, b) => a.order - b.order);
}

async function inspectTransaction(hash) {
  lastHash = hash;
  setState("loading");
  ui.form.querySelector("button[type=submit]").disabled = true;
  try {
    setLoading("Reading Arc transaction", "Requesting public transaction data…");
    const [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ]);
    setLoading("Decoding execution", "Reading block, transfers and Arc memo events…");
    const block = await client.getBlock({ blockHash: receipt.blockHash });
    const { transfers, memos } = parseReceiptLogs(receipt);
    const memoInput = parseMemoInput(transaction);
    const actions = makeActions({ transaction, receipt, transfers, memos, memoInput });
    const warnings = buildWarnings({ transaction, receipt, transfers, memos, memoInput });
    const usdcTotal = transfers.filter((item) => item.symbol === "USDC").reduce((sum, item) => sum + item.value, 0n);
    currentReport = { hash, transaction, receipt, block, transfers, memos, memoInput, actions, warnings, usdcTotal };
    renderReport(currentReport);
    setState("results");
  } catch (error) {
    console.error(error);
    ui.errorMessage.textContent = humanError(error);
    setState("error");
  } finally {
    ui.form.querySelector("button[type=submit]").disabled = false;
  }
}

function humanError(error) {
  const message = error?.shortMessage || error?.message || "Unknown RPC error";
  if (/not found|null/i.test(message)) return "Transaction peyda nashod. Hash va Arc Testnet ro check kon.";
  if (/fetch|network|timeout|http/i.test(message)) return "Arc RPC javab nadad. Chand saniye dige dobare emtehan kon.";
  return message.split("\n")[0].slice(0, 220);
}

function renderReport(report) {
  const { transaction, receipt, block, actions, warnings, transfers, memos, usdcTotal } = report;
  const success = receipt.status === "success";
  const riskCount = warnings.filter((item) => item.level !== "good").length;
  ui.subtitle.textContent = `Finalized in block ${receipt.blockNumber.toLocaleString()} · ${toDate(block.timestamp)}`;
  ui.copyReport.disabled = false; ui.exportTest.disabled = false;
  ui.explorer.href = `${ARC_EXPLORER}/tx/${report.hash}`;
  ui.status.textContent = success ? "SUCCESS" : "REVERTED"; ui.status.className = success ? "good" : "bad";
  ui.finality.textContent = success ? "Final in one confirmation" : "No state committed";
  ui.calls.textContent = String(actions.length).padStart(2, "0");
  ui.value.textContent = usdcTotal > 0n ? formatAmount(usdcTotal, 6) : transaction.value > 0n ? formatAmount(transaction.value, 18) : "0";
  ui.token.textContent = usdcTotal > 0n ? "ERC-20 USDC moved" : transaction.value > 0n ? "native USDC value" : "no USDC decoded";
  ui.risks.textContent = String(riskCount).padStart(2, "0");
  ui.txShort.textContent = short(report.hash, 12, 10);
  ui.statusPill.textContent = success ? "Finalized" : "Reverted"; ui.statusPill.className = `status-pill${success ? "" : " failed"}`;

  ui.timeline.innerHTML = actions.map((action, index) => `
    <div class="timeline-item">
      <span class="timeline-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="timeline-copy"><strong>${escapeHtml(action.title)}</strong><p>${escapeHtml(action.description)}</p><span class="event-tag">${escapeHtml(action.type)}</span></div>
      <div class="timeline-meta"><strong>${escapeHtml(action.value)}</strong><span>${escapeHtml(action.state)}</span></div>
    </div>`).join("");

  const context = [
    ["Network", "Arc Testnet · 5042002"], ["Block", receipt.blockNumber.toLocaleString()],
    ["Timestamp", toDate(block.timestamp)], ["From", transaction.from], ["To", transaction.to || "Contract creation"],
    ["Gas used", receipt.gasUsed.toLocaleString()], ["Transfers", String(transfers.length)], ["Arc memos", String(memos.length)],
  ];
  ui.context.innerHTML = context.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd title="${escapeHtml(value)}">${escapeHtml(value)}</dd></div>`).join("");
  ui.warnings.innerHTML = warnings.map((warning) => `<div class="warning ${warning.level === "good" ? "good" : ""}"><i></i><div><strong>${escapeHtml(warning.title)}</strong><p>${escapeHtml(warning.text)}</p></div></div>`).join("");

  ui.replayFrom.value = transaction.from;
  ui.replayTo.value = transaction.to || "";
  ui.replayData.value = transaction.input || "0x";
  ui.runReplay.disabled = !transaction.to;
  ui.replayResult.hidden = true;
}

async function runReplay() {
  const account = ui.replayFrom.value.trim();
  const to = ui.replayTo.value.trim();
  const data = ui.replayData.value.trim();
  if (!isAddress(account) || !isAddress(to) || !/^0x[0-9a-fA-F]*$/.test(data)) {
    toast("From, target ya calldata motabar nist."); return;
  }
  ui.runReplay.disabled = true;
  ui.runReplay.firstChild.textContent = "Running preflight ";
  ui.replayResult.hidden = false;
  ui.replayResult.className = "replay-result";
  ui.replayResult.innerHTML = "Calling Arc Testnet at latest state…";
  try {
    const result = await client.call({ account, to, data, value: currentReport?.transaction.value || 0n });
    const output = result.data || "0x";
    ui.replayResult.innerHTML = `<strong>✓ PREFLIGHT PASSED</strong>The call completed without a revert at the latest finalized block.<br />Return data: ${escapeHtml(short(output, 42, 20))}`;
  } catch (error) {
    ui.replayResult.className = "replay-result failed";
    ui.replayResult.innerHTML = `<strong>× PREFLIGHT REVERTED</strong>${escapeHtml((error.shortMessage || error.message || "Call reverted").split("\n")[0])}`;
  } finally {
    ui.runReplay.disabled = false;
    ui.runReplay.firstChild.textContent = "Run fresh preflight ";
  }
}

function makeReportText(report) {
  return [
    `ARCREPLAY EXECUTION REPORT`, `Transaction: ${report.hash}`, `Network: Arc Testnet (5042002)`,
    `Status: ${report.receipt.status.toUpperCase()}`, `Block: ${report.receipt.blockNumber}`, `Timestamp: ${toDate(report.block.timestamp)}`, "",
    "EXECUTION TIMELINE", ...report.actions.map((item, index) => `${index + 1}. [${item.type}] ${item.title} — ${item.description} — ${item.state}`), "",
    "SIGNALS", ...report.warnings.map((item) => `- ${item.title}: ${item.text}`), "", "Generated by ArcReplay v0.1.0",
  ].join("\n");
}

function makeTestCode(report) {
  const value = report.transaction.value || 0n;
  return `import { createPublicClient, defineChain, http } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["${ARC_RPC}"] } },
});

const client = createPublicClient({ chain: arcTestnet, transport: http() });

// Reproduced from ${report.hash}
const result = await client.call({
  account: "${report.transaction.from}",
  to: "${report.transaction.to || "0x0000000000000000000000000000000000000000"}",
  data: "${report.transaction.input || "0x"}",
  value: ${value}n,
});

console.log("Preflight passed:", result.data ?? "0x");
`;
}

function playInspectCompanion() {
  const companion = document.querySelector("#search-companion");
  const video = document.querySelector("#search-companion-video");
  if (!companion || !video) {
    document.querySelector("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.clearTimeout(playInspectCompanion.fallback);
  video.pause();
  video.currentTime = 0;
  companion.classList.remove("is-playing");
  requestAnimationFrame(() => {
    companion.classList.add("is-playing");
    const playback = video.play();
    if (playback) playback.catch(() => finishInspectCompanion());
  });
  playInspectCompanion.fallback = window.setTimeout(() => finishInspectCompanion(), 7000);
}

function finishInspectCompanion() {
  const companion = document.querySelector("#search-companion");
  const video = document.querySelector("#search-companion-video");
  window.clearTimeout(playInspectCompanion.fallback);
  companion?.classList.remove("is-playing");
  video?.pause();
  document.querySelector("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelector("#search-companion-video")?.addEventListener("ended", finishInspectCompanion);

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const hash = ui.input.value.trim();
  if (!isHash(hash)) { toast("Yek transaction hash-e 66 characteri vared kon."); ui.input.focus(); return; }
  playInspectCompanion();
  inspectTransaction(hash);
});
ui.demo.addEventListener("click", () => {
  ui.input.value = LIVE_DEMO_HASH;
  inspectTransaction(LIVE_DEMO_HASH);
  document.querySelector("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
});
ui.retry.addEventListener("click", () => lastHash && inspectTransaction(lastHash));
ui.runReplay.addEventListener("click", runReplay);
ui.copyReport.addEventListener("click", async () => {
  if (!currentReport) return;
  await navigator.clipboard.writeText(makeReportText(currentReport)); toast("Report copy shod.");
});
ui.exportTest.addEventListener("click", () => {
  if (!currentReport) return;
  const blob = new Blob([makeTestCode(currentReport)], { type: "text/typescript" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `arcreplay-${currentReport.hash.slice(2,10)}.ts`; link.click();
  URL.revokeObjectURL(link.href); toast("Viem replay test export shod.");
});

function startTypewriter() {
  const element = document.querySelector(".typewriter");
  const output = element?.querySelector("span");
  const text = element?.dataset.text || "";
  if (!element || !output) return;
  output.textContent = "";
  element.classList.add("is-typing");
  let index = 0;
  window.setTimeout(() => {
    const timer = window.setInterval(() => {
      index += 1;
      output.textContent = text.slice(0, index);
      if (index >= text.length) {
        window.clearInterval(timer);
        window.setTimeout(() => element.classList.remove("is-typing"), 900);
      }
    }, 24);
  }, 650);
}

initAnimationKit();
startTypewriter();
setState("empty");
