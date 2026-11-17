const SEGMENTS = [
  {
    id: "running",
    franchise: "NIKE RUNNING",
    fcst: "128.4K",
    ly: "119.1K",
    yoy: "+7.8%",
    yoyClass: "yoy-up",
    pill: "Stable / Historical",
    signal: "On track",
    signalClass: "signal-ok",
    insight:
      "Running wholesale is up modestly vs last year with a stable weekly pattern.",
    plannerLine:
      "Demand signal is ahead of LY with no unusual week-to-week noise; planners can anchor partner dialogue on sustained wholesale momentum.",
    weekly: [
      { a: 820, f: 0 },
      { a: 910, f: 0 },
      { a: 880, f: 0 },
      { a: 940, f: 0 },
      { a: 0, f: 1020 },
      { a: 0, f: 1080 },
      { a: 0, f: 1050 },
      { a: 0, f: 1120 },
      { a: 0, f: 1180 },
      { a: 0, f: 1150 },
      { a: 0, f: 1210 },
      { a: 0, f: 1240 },
    ],
  },
  {
    id: "socks",
    franchise: "SOCKS",
    fcst: "96.2K",
    ly: "102.8K",
    yoy: "-6.4%",
    yoyClass: "yoy-down",
    pill: "Volatile / Historical",
    signal: "Watch",
    signalClass: "signal-warn",
    insight:
      "Socks is below LY — planners will ask whether this is portfolio mix or a true demand shift; the assistant should explain, not hide behind a single KPI.",
    plannerLine:
      "Treat as a conversation slice: forward weeks soften vs settled actuals; partner messaging may need category context, not panic.",
    weekly: [
      { a: 1200, f: 0 },
      { a: 1150, f: 0 },
      { a: 1180, f: 0 },
      { a: 1100, f: 0 },
      { a: 0, f: 980 },
      { a: 0, f: 1010 },
      { a: 0, f: 990 },
      { a: 0, f: 950 },
      { a: 0, f: 920 },
      { a: 0, f: 940 },
      { a: 0, f: 910 },
      { a: 0, f: 900 },
    ],
  },
  {
    id: "af1",
    franchise: "AIR FORCE 1",
    fcst: "214.7K",
    ly: "198.3K",
    yoy: "+8.3%",
    yoyClass: "yoy-up",
    pill: "Stable / Significant history",
    signal: "On track",
    signalClass: "signal-ok",
    insight:
      "AF1 is a scale franchise — planners care that the headline matches the weekly build; stable history supports a confident wholesale story.",
    plannerLine:
      "Large, predictable base; Genie answers ‘why this level’ without sending planners into a data workspace.",
    weekly: [
      { a: 2400, f: 0 },
      { a: 2500, f: 0 },
      { a: 2450, f: 0 },
      { a: 2550, f: 0 },
      { a: 0, f: 2680 },
      { a: 0, f: 2720 },
      { a: 0, f: 2700 },
      { a: 0, f: 2780 },
      { a: 0, f: 2810 },
      { a: 0, f: 2790 },
      { a: 0, f: 2850 },
      { a: 0, f: 2880 },
    ],
  },
  {
    id: "dunk",
    franchise: "DUNK",
    fcst: "88.1K",
    ly: "71.5K",
    yoy: "+23.2%",
    yoyClass: "yoy-up",
    pill: "Volatile / Reasonable history",
    signal: "Investigate",
    signalClass: "signal-hot",
    insight:
      "Dunk shows high YoY growth with volatile read — exactly where planners need governed ‘why’ answers instead of spreadsheet heroics.",
    plannerLine:
      "Strong growth story with higher week-to-week swing; assistant should ground narrative in trend, not SKU-level model jargon.",
    weekly: [
      { a: 600, f: 0 },
      { a: 650, f: 0 },
      { a: 700, f: 0 },
      { a: 720, f: 0 },
      { a: 0, f: 880 },
      { a: 0, f: 920 },
      { a: 0, f: 910 },
      { a: 0, f: 950 },
      { a: 0, f: 980 },
      { a: 0, f: 1000 },
      { a: 0, f: 1020 },
      { a: 0, f: 1040 },
    ],
  },
];

const PROMPTS = [
  { label: "Why should I trust this number?", key: "level" },
  { label: "How is the trend shifting?", key: "trend" },
  { label: "Stable or volatile for my plan?", key: "stable" },
];

let active = SEGMENTS[0];
let chatBusy = false;
const thread = [
  {
    role: "bot",
    text:
      "Pick a franchise on the left, then ask why the forecast is defensible, how the trend is shifting, or how to read stability.",
  },
];

function segmentContext() {
  return {
    franchise: active.franchise,
    geo: "United States",
    channel: "NMP · WHOLESALE",
    grain: "Mid-level",
    season: "SP2026",
    measure: "Net sales units (gross-up)",
    forecast: active.fcst,
    last_year: active.ly,
    yoy: active.yoy,
    planner_read: active.pill,
    workspace_signal: active.signal,
    planner_takeaway: active.insight,
    planner_line: active.plannerLine,
  };
}

const CHART_PX = 148;

function maxWeekly(seg) {
  return Math.max(...seg.weekly.flatMap((w) => [w.a, w.f]), 1);
}

function renderChart(seg) {
  const el = document.getElementById("chart-bars");
  const cap = maxWeekly(seg);
  el.innerHTML = seg.weekly
    .map((w, i) => {
      const ah = w.a ? Math.max(2, Math.round((w.a / cap) * CHART_PX)) : 0;
      const fh = w.f ? Math.max(2, Math.round((w.f / cap) * CHART_PX)) : 0;
      const aStyle = ah ? `height:${ah}px` : "height:0";
      const fStyle = fh ? `height:${fh}px` : "height:0";
      return `<div class="bar-group" title="Week ${i + 1}">
        <div class="bar actual" style="${aStyle}"></div>
        <div class="bar forecast" style="${fStyle}"></div>
      </div>`;
    })
    .join("");
}

function renderTable() {
  const tbody = document.getElementById("segment-table");
  tbody.innerHTML = SEGMENTS.map((s) => {
    const sel = s.id === active.id ? "selected" : "";
    return `<tr class="selectable ${sel}" data-id="${s.id}">
      <td>${s.franchise}</td>
      <td>${s.fcst}</td>
      <td>${s.ly}</td>
      <td class="${s.yoyClass}">${s.yoy}</td>
      <td class="read-cell">${s.pill.split(" / ")[0]}</td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => selectSegment(tr.dataset.id));
  });
}

function selectSegment(id) {
  active = SEGMENTS.find((s) => s.id === id) || SEGMENTS[0];
  document.getElementById("segment-title").textContent =
    `${active.franchise} · United States · NMP`;
  document.getElementById("kpi-fc").textContent = active.fcst;
  document.getElementById("kpi-ly").textContent = active.ly;
  const yoyEl = document.getElementById("kpi-yoy");
  yoyEl.textContent = active.yoy;
  yoyEl.className = "kpi-value accent";
  yoyEl.style.color = active.yoyClass === "yoy-down" ? "#b42318" : "";
  document.getElementById("kpi-pill").textContent = active.pill;
  document.getElementById("planner-line").textContent = active.plannerLine;
  const tag = document.getElementById("signal-tag");
  tag.textContent = active.signal;
  tag.className = `signal ${active.signalClass}`;
  renderChart(active);
  renderTable();
}

function renderThread() {
  const el = document.getElementById("chat-thread");
  el.innerHTML = thread
    .map((m) => {
      let extra = "";
      if (m.loading) extra = " loading";
      if (m.error) extra = " error";
      const html =
        m.role === "user"
          ? escapeHtml(m.text)
          : formatBot(escapeHtml(m.text));
      return `<div class="bubble ${m.role} ${extra}">${html}</div>`;
    })
    .join("");
  el.scrollTop = el.scrollHeight;
}

function formatBot(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function escapeHtml(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setChatStatus(msg) {
  const el = document.getElementById("chat-status");
  if (el) el.textContent = msg;
}

function setComposerEnabled(on) {
  const input = document.getElementById("chat-input");
  const form = document.getElementById("chat-form");
  if (input) input.disabled = !on;
  if (form) {
    const btn = form.querySelector("button");
    if (btn) btn.disabled = !on;
  }
}

async function send(text) {
  const q = text.trim();
  if (!q || chatBusy) return;
  chatBusy = true;
  setComposerEnabled(false);
  thread.push({ role: "user", text: q });
  const pending = { role: "bot", text: "Thinking…", loading: true };
  thread.push(pending);
  renderThread();
  setChatStatus("");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, segment: segmentContext() }),
    });
    const data = await res.json();
    thread.pop();
    if (!res.ok) {
      thread.push({
        role: "bot",
        error: true,
        text: data.error || `Request failed (${res.status})`,
      });
      setChatStatus("");
    } else {
      thread.push({ role: "bot", text: data.answer || "(empty response)" });
      setChatStatus("");
    }
  } catch (err) {
    thread.pop();
    thread.push({
      role: "bot",
      error: true,
      text: `Network error: ${err.message}. Start chat_server.py (not static-only http.server).`,
    });
    setChatStatus("");
  } finally {
    chatBusy = false;
    setComposerEnabled(true);
    renderThread();
  }
}

function initChips() {
  const el = document.getElementById("prompt-chips");
  PROMPTS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-btn";
    btn.textContent = p.label;
    btn.addEventListener("click", () => {
      const prompt =
        p.key === "level"
          ? `Why should I trust the ${active.fcst} forecast for ${active.franchise}?`
          : p.key === "trend"
            ? `How is the weekly trend shifting for ${active.franchise} this season?`
            : `Is ${active.franchise} stable or volatile for my marketplace plan?`;
      void send(prompt);
    });
    el.appendChild(btn);
  });
}

document.getElementById("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  void send(input.value);
  input.value = "";
});

selectSegment(active.id);
initChips();
renderThread();
