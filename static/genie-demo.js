const DEMO_PROMPTS = [
  "What is unconstrained consumer demand, and how is it different from supply or receipts?",
  "For NDDC versus NMP, should I use net demand or net sales units?",
  "How has the weekly trend changed for Vomero, United States, NDDC, at mid-level, for net demand units this season?",
  "How has the weekly trend changed for Nike Running, United States, Nike Marketplace Partners, at mid-level, for net sales units this season?",
  "Use MCCF (gross-up basis) for Nike Marketplace Partners.",
  "What seasonal pattern applies to style-color 554724-136 in the United States for the current season?",
  "NDDC — net demand units on the direct basis.",
  "Should we increase the forecast for Nike Running next month?",
];

const VOMERO_WEEKLY = [
  { week: "W28", a: 41.8, f: 0 },
  { week: "W29", a: 43.1, f: 0 },
  { week: "W30", a: 42.4, f: 0 },
  { week: "W31", a: 44.6, f: 0 },
  { week: "W32", a: 45.2, f: 0 },
  { week: "W33", a: 46.0, f: 0 },
  { week: "W34", a: 44.9, f: 0 },
  { week: "W35", a: 0, f: 47.5 },
  { week: "W36", a: 0, f: 49.2 },
  { week: "W37", a: 0, f: 51.0 },
  { week: "W38", a: 0, f: 54.3 },
  { week: "W39", a: 0, f: 56.8 },
  { week: "W40", a: 0, f: 58.1 },
  { week: "W41", a: 0, f: 55.4 },
  { week: "W42", a: 0, f: 57.2 },
  { week: "W43", a: 0, f: 59.0 },
];

const NMP_WEEKLY = [
  { week: "W28", a: 298, f: 0 },
  { week: "W29", a: 312, f: 0 },
  { week: "W30", a: 305, f: 0 },
  { week: "W31", a: 318, f: 0 },
  { week: "W32", a: 267, f: 0 },
  { week: "W33", a: 300, f: 0 },
  { week: "W34", a: 289, f: 0 },
  { week: "W35", a: 0, f: 337 },
  { week: "W36", a: 0, f: 385 },
  { week: "W37", a: 0, f: 461 },
  { week: "W38", a: 0, f: 410 },
  { week: "W39", a: 0, f: 432 },
  { week: "W40", a: 0, f: 522 },
  { week: "W41", a: 0, f: 486 },
  { week: "W42", a: 0, f: 420 },
  { week: "W43", a: 0, f: 278 },
];

const VOMERO_META = {
  title: "Vomero · United States · NDDC",
  subtitle: "Mid-level · HO2026 · NET_DEMAND_UNITS · DIRECT",
  demand_profile: "Stable",
  confidence: "High data sufficiency",
  filters: ["Persona: NDDC", "Measure: Net demand units", "Basis: Direct", "Horizon: HO2026"],
  kpis: [
    { label: "26-wk total (actualized)", value: "287K", delta: "+4.2% vs LY" },
    { label: "Forward 8-wk forecast", value: "448K", delta: "Run rate ↑" },
    { label: "Demand profile", value: "Stable", delta: "Low volatility" },
  ],
};

const NMP_META = {
  title: "Nike Running · United States · Nike Marketplace Partners",
  subtitle: "Mid-level · HO2026 · NET_SALES_UNITS · MCCF",
  demand_profile: "Volatile",
  confidence: "Moderate — wholesale lumpiness",
  filters: ["Persona: NMP", "Measure: Net sales units", "Basis: MCCF gross-up", "Horizon: HO2026"],
  kpis: [
    { label: "26-wk total (actualized)", value: "2.09M", delta: "+1.1% vs LY" },
    { label: "Peak week (forward)", value: "522K", delta: "W40 seasonal lift" },
    { label: "Demand profile", value: "Volatile", delta: "Partner mix shifts" },
  ],
};

const SEASON_MONTHS = [
  { name: "Jul", idx: "0.92" },
  { name: "Aug", idx: "0.88" },
  { name: "Sep", idx: "0.95" },
  { name: "Oct", idx: "1.02" },
  { name: "Nov", idx: "1.95", peak: true },
  { name: "Dec", idx: "2.05", peak: true },
];

let tab = "midlevel";
let midView = "vomero";
let thread = [
  {
    role: "bot",
    text:
      "North America HO2026 preview — synthetic Lakeview slice. Answers use live Workers AI when connected; chips replay the NA Genie walkthrough.",
  },
];
let chatBusy = false;

const REFUSAL_PLANNING =
  "I can explain sourced forecast trends, seasonality, data sufficiency, and demand profile " +
  "labels, but I cannot recommend or make a forecast, inventory, replenishment, allocation, " +
  "or commercial decision.";

function norm(q) {
  return q.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Rule-based fallback when LLM unreachable (same intent as demo_genie_responses.py). */
function demoAnswerLocal(question, ctx) {
  const q = norm(question);
  const tab = ctx?.tab || "midlevel";
  if (/\b(override|increase|decrease|should we ).*forecast\b/.test(q) || (q.includes("recommend") && q.includes("forecast"))) {
    return REFUSAL_PLANNING;
  }
  if (q.includes("which model") || q.includes("what model")) {
    return (
      "I cannot answer this from the configured Forecast Intelligence data. Model and training " +
      "details are not available in this Genie space."
    );
  }
  if (q.includes("unconstrained") && (q.includes("supply") || q.includes("receipt") || q.includes("different"))) {
    return (
      "Unconstrained consumer demand is the demand-first signal AP forecasts before supply constraints. " +
      "It is not receipts, inventory, or o9 supply logic. Genie explains the demand signal; it does not recommend overrides."
    );
  }
  if (q.includes("nddc") && q.includes("nmp") && (q.includes("net demand") || q.includes("net sales") || q.includes("measure"))) {
    return (
      "Use net demand units for NDDC on the direct basis. Use net sales units for NMP and store personas. " +
      "For NMP wholesale, specify MCCF (gross-up) or POS; do not blend demand and sales in one total."
    );
  }
  if (q.includes("mccf") || (q.includes("nike running") && q.includes("trend"))) {
    return (
      "Weekly trend for Nike Running, United States, Nike Marketplace Partners, mid-level, net sales units, " +
      "MCCF, HO2026: settled weeks cluster ~267K–318K; forward weeks ramp into W40 (~522K) then taper. " +
      "Filters: NMP · NET_SALES_UNITS · MCCF · HO2026."
    );
  }
  if (q.includes("vomero") && q.includes("trend")) {
    return (
      "Weekly trend for Vomero, United States, NDDC, mid-level, net demand units, HO2026: settled actuals " +
      "steady ~42–46K units/week; forward forecast steps up into high 50Ks. Filters: NDDC · NET_DEMAND_UNITS · DIRECT · HO2026."
    );
  }
  if (q.includes("554724") && (q.includes("season") || q.includes("seasonal"))) {
    if (tab === "style_color" && !q.includes("nddc") && !q.includes("net demand")) {
      return (
        "Which persona should I use?\n\n• NDDC: net demand (direct)\n• NSO / NVS: net sales\n" +
          "• NMP: net sales (MCCF or POS)\n\nReply with NDDC net demand to continue."
      );
    }
    return (
      "Seasonality for 554724-136, US, NDDC, net demand, HO2026: November index 1.95; " +
        "December 2.05 (peak). Reliable for this slice. This does not recommend a forecast change."
    );
  }
  if (q.includes("nddc") && q.includes("net demand") && (q.includes("554724") || q.includes("direct basis"))) {
    return demoAnswerLocal("554724 seasonality NDDC", { tab: "style_color" });
  }
  return null;
}

function activeViewMeta() {
  if (tab === "style_color") {
    return {
      title: "554724-136 · United States",
      subtitle: "Style-color · HO2026 · use Style Color tab",
      demand_profile: "Peak holiday",
      confidence: "Sufficient history",
      filters: ["Style-color: 554724-136", "Geo: United States", "Horizon: HO2026"],
      kpis: [
        { label: "Peak month index", value: "2.05", delta: "December" },
        { label: "Nov index", value: "1.95", delta: "Pre-peak build" },
        { label: "Off-peak (Jul)", value: "0.92", delta: "Baseline" },
      ],
    };
  }
  return midView === "vomero" ? VOMERO_META : NMP_META;
}

function activeWeeklySeries() {
  if (tab !== "midlevel") return [];
  return midView === "vomero" ? VOMERO_WEEKLY : NMP_WEEKLY;
}

function contextPayload() {
  const meta = activeViewMeta();
  return {
    tab,
    mid_view: midView,
    season: "HO2026",
    geo: "United States",
    region: "North America",
    dashboard: {
      title: meta.title,
      subtitle: meta.subtitle,
      filters: meta.filters,
      demand_profile: meta.demand_profile,
      confidence: meta.confidence,
      kpis: meta.kpis,
      weekly: activeWeeklySeries(),
      seasonality_months: tab === "style_color" ? SEASON_MONTHS : null,
    },
    mode: "public_synthetic_uat",
  };
}

function chatEndpoints() {
  const fromMeta = document.querySelector('meta[name="ap-fi-chat-fallback"]')?.getAttribute("content");
  const fromGlobal = typeof window.__FI_CHAT_URL__ === "string" ? window.__FI_CHAT_URL__ : "";
  const list = ["/api/chat", fromMeta, fromGlobal].map((s) => (s || "").trim()).filter(Boolean);
  return [...new Set(list)];
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return { ok: res.ok, data: {}, status: res.status };
  try {
    return { ok: res.ok, data: JSON.parse(text), status: res.status };
  } catch {
    return { ok: false, data: { error: text.slice(0, 200) }, status: res.status };
  }
}

async function requestChat(question, segment) {
  let lastErr = "No chat endpoint";
  for (const url of chatEndpoints()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, segment }),
      });
      const { data, status } = await parseResponse(res);
      if (res.ok && data.answer) return { answer: data.answer, via: url };
      if (status === 405 || status === 404) {
        lastErr = data.error || `HTTP ${status} at ${url}`;
        continue;
      }
      lastErr = data.error || `HTTP ${status}`;
    } catch (err) {
      lastErr = String(err);
    }
  }
  return { error: lastErr };
}

function formatUnits(w, scaleK) {
  const v = w.a || w.f;
  if (scaleK) return `${Math.round(v)}K`;
  return `${v.toFixed ? v.toFixed(1) : v}K`;
}

function renderBars(data, scaleK) {
  const max = Math.max(...data.flatMap((w) => [w.a, w.f]), 1);
  const el = document.getElementById("weekly-chart");
  el.innerHTML = data
    .map((w) => {
      const ah = w.a ? Math.round((w.a / max) * 132) : 0;
      const fh = w.f ? Math.round((w.f / max) * 132) : 0;
      const label = formatUnits(w, scaleK);
      const settled = w.a ? "actual" : "forecast";
      return `<div class="bar-wrap" title="${w.week}: ${label} (${settled})">
        <div class="bar-stack">
          <div class="bar actual" style="height:${ah}px"></div>
          <div class="bar forecast" style="height:${fh}px"></div>
        </div>
        <span class="bar-label">${w.week.replace("W", "")}</span>
      </div>`;
    })
    .join("");
}

function renderKpis(meta) {
  const row = document.getElementById("kpi-row");
  if (!row) return;
  row.innerHTML = meta.kpis
    .map(
      (k) => `<article class="kpi">
        <p class="kpi-label">${escapeHtml(k.label)}</p>
        <p class="kpi-value">${escapeHtml(k.value)}</p>
        <p class="kpi-delta">${escapeHtml(k.delta)}</p>
      </article>`,
    )
    .join("");
}

function renderFilters(meta) {
  const el = document.getElementById("filter-row");
  if (!el) return;
  el.innerHTML = meta.filters
    .map((f) => `<span class="filter-pill active">${escapeHtml(f)}</span>`)
    .join("");
}

function renderWeeklyTable(data, scaleK) {
  const el = document.getElementById("weekly-table");
  if (!el) return;
  const rows = data
    .slice(-6)
    .map((w) => {
      const actual = w.a ? formatUnits(w, scaleK) : "—";
      const fc = w.f ? formatUnits(w, scaleK) : "—";
      return `<tr><td>${w.week}</td><td class="num">${actual}</td><td class="num">${fc}</td></tr>`;
    })
    .join("");
  el.innerHTML = `<table><thead><tr><th>Week</th><th>Actual</th><th>Forecast</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDashboard() {
  const title = document.getElementById("dash-title");
  const meta = document.getElementById("dash-meta");
  const midlevelBlock = document.getElementById("midlevel-block");
  const scBlock = document.getElementById("style-color-block");
  const profile = document.getElementById("demand-profile");
  const viewMeta = activeViewMeta();

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  title.textContent = viewMeta.title;
  meta.textContent = viewMeta.subtitle;
  if (profile) {
    profile.textContent = viewMeta.demand_profile;
    profile.dataset.tone = viewMeta.demand_profile.toLowerCase().includes("volatile") ? "volatile" : "stable";
  }

  renderKpis(viewMeta);
  renderFilters(viewMeta);

  if (tab === "midlevel") {
    midlevelBlock.hidden = false;
    scBlock.hidden = true;
    const scaleK = midView !== "vomero";
    const series = activeWeeklySeries();
    renderBars(series, scaleK);
    renderWeeklyTable(series, scaleK);
  } else {
    midlevelBlock.hidden = true;
    scBlock.hidden = false;
  }
}

function setTab(next) {
  tab = next;
  renderDashboard();
}

function escapeHtml(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatBot(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function renderThread() {
  const el = document.getElementById("chat-thread");
  el.innerHTML = thread
    .map((m) => {
      const cls = `bubble ${m.role}${m.loading ? " loading" : ""}${m.error ? " error" : ""}`;
      const inner = m.role === "user" ? escapeHtml(m.text) : formatBot(m.text);
      return `<div class="${cls}">${inner}</div>`;
    })
    .join("");
  el.scrollTop = el.scrollHeight;
}

function setComposer(on) {
  document.getElementById("chat-input").disabled = !on;
  document.querySelector(".composer button").disabled = !on;
  document.querySelectorAll(".chip-btn").forEach((b) => {
    b.disabled = !on;
  });
}

function applyPromptViewHints(q) {
  const lower = q.toLowerCase();
  if (lower.includes("nike running") && lower.includes("trend")) {
    midView = "nmp";
    tab = "midlevel";
    renderDashboard();
  }
  if (lower.includes("vomero") && lower.includes("trend")) {
    midView = "vomero";
    tab = "midlevel";
    renderDashboard();
  }
  if (q.includes("554724") || (lower.includes("seasonal") && lower.includes("style"))) {
    tab = "style_color";
    renderDashboard();
  }
}

async function send(text) {
  const q = text.trim();
  if (!q || chatBusy) return;
  applyPromptViewHints(q);

  chatBusy = true;
  setComposer(false);
  thread.push({ role: "user", text: q });
  thread.push({ role: "bot", text: "Thinking…", loading: true });
  renderThread();

  const ctx = contextPayload();
  const local = demoAnswerLocal(q, ctx);
  const useStaticOnly =
    window.__FI_STATIC_DEMO__ === true ||
    new URLSearchParams(location.search).get("static") === "1";

  const finish = (text, isError = false) => {
    thread.pop();
    thread.push({ role: "bot", text, ...(isError ? { error: true } : {}) });
  };

  try {
    if (useStaticOnly && local) {
      await new Promise((r) => setTimeout(r, 400));
      finish(local);
    } else if (!useStaticOnly) {
      const llm = await requestChat(q, ctx);
      if (llm.answer) {
        finish(llm.answer);
      } else if (local) {
        finish(local);
      } else {
        finish(llm.error || "Could not reach chat API. Deploy Workers AI proxy (see CLOUDFLARE_PAGES.md).", true);
      }
    } else {
      finish(
        local ||
          "Try a demo chip (Analytics 101, Vomero, NMP Running, seasonality, or planning refusal).",
      );
    }
  } catch (_err) {
    finish(local || "Could not reach chat API.", true);
  } finally {
    chatBusy = false;
    setComposer(true);
    renderThread();
  }
}

function init() {
  const grid = document.getElementById("season-grid");
  grid.innerHTML = SEASON_MONTHS.map(
    (m) =>
      `<div class="month${m.peak ? " peak" : ""}"><div>${m.name}</div><strong>${m.idx}</strong></div>`,
  ).join("");

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  const chips = document.getElementById("prompt-chips");
  DEMO_PROMPTS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-btn";
    b.textContent = p.length > 72 ? `${p.slice(0, 69)}…` : p;
    b.title = p;
    b.addEventListener("click", () => void send(p));
    chips.appendChild(b);
  });

  document.getElementById("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    void send(input.value);
    input.value = "";
  });

  renderDashboard();
  renderThread();
}

init();