const WOS_TARGETS = { national: 10, store: 6 };

const DEMO_PROMPTS = [
  "What is store-level inventory for Vomero doors (switch Store lens)?",
  "For Vomero, is the forward run rate continuing the recent band or reverting toward season average?",
  "What is weeks of supply for Vomero and which geos are below target?",
  "What share of division and national does Vomero represent?",
  "Which style-colors drive Vomero mid-level, and what model path do they use?",
  "Where does assignment not match demand (high need, low or zero allocation)?",
  "What assortment signals differ by geo for this mid-level?",
  "What is unconstrained consumer demand, and how is it different from inventory or receipts?",
  "For NDDC versus NMP, should I use net demand or net sales units?",
  "How has the weekly trend changed for Nike Running at NMP mid-level this season?",
  "Should we increase the forecast for Nike Running next month?",
];

const SERIES_WEEKS = 164;
const FORECAST_HORIZON = 16;

function seasonMultiplier(isoWeek) {
  if (isoWeek >= 45 || isoWeek <= 2) return 1.38;
  if (isoWeek >= 38) return 1.18;
  if (isoWeek >= 20 && isoWeek <= 32) return 0.92;
  return 1.0;
}

/** Synthetic weekly actuals + forward forecast, ~3+ years (2023 W20 → 2026 forward). */
function buildWeeklySeries(baseLevel, growthPerWeek, forecastWeeks) {
  let year = 2023;
  let isoWeek = 20;
  const total = SERIES_WEEKS;
  const forecastStart = total - forecastWeeks;
  const out = [];
  for (let i = 0; i < total; i++) {
    const label = `${year}-W${String(isoWeek).padStart(2, "0")}`;
    const trend = 1 + growthPerWeek * i;
    const wave = 0.98 + (i % 11) * 0.004;
    const level = baseLevel * seasonMultiplier(isoWeek) * trend * wave;
    const isForecast = i >= forecastStart;
    if (isForecast) {
      const uplift = isoWeek >= 38 && isoWeek <= 43 ? 1.06 : 1.02;
      out.push({ week: label, year, isoWeek, season: year >= 2026 ? "HO2026" : year === 2025 ? "HO2025" : "HO2024", a: 0, f: level * uplift });
    } else {
      out.push({ week: label, year, isoWeek, season: year >= 2026 ? "HO2026" : year === 2025 ? "HO2025" : "HO2024", a: level, f: 0 });
    }
    isoWeek += 1;
    if (isoWeek > 52) {
      isoWeek = 1;
      year += 1;
    }
  }
  return out;
}

const VOMERO_WEEKLY = buildWeeklySeries(38.5, 0.00055, FORECAST_HORIZON);
const NMP_WEEKLY = buildWeeklySeries(268, 0.00085, FORECAST_HORIZON);

function lyHistoryFromSeries(series) {
  const byYearWeek = new Map();
  series.forEach((p) => {
    const v = p.a > 0 ? p.a : p.f;
    byYearWeek.set(`${p.year}-${p.isoWeek}`, v);
  });
  return series.map((p) => {
    const ly = byYearWeek.get(`${p.year - 1}-${p.isoWeek}`);
    const self = p.a > 0 ? p.a : p.f;
    return { week: p.week, ly: ly ?? self * 0.91 };
  });
}

function vomeroLyHistory() {
  return lyHistoryFromSeries(VOMERO_WEEKLY);
}

function nmpLyHistory() {
  return lyHistoryFromSeries(NMP_WEEKLY);
}

const VOMERO_META = {
  title: "Vomero · United States · NDDC",
  subtitle: "Mid-level · HO2026 · NET_DEMAND_UNITS · DIRECT",
  demand_profile: "Stable",
  confidence: "High data sufficiency",
  division_pct: 4.2,
  national_pct: 1.1,
  hierarchy: "4.2% of Nike Running division · 1.1% of NA footwear (synthetic)",
  model_path: [
    { step: "Star DP", detail: "Mid-level national demand prior" },
    { step: "TSAP", detail: "Gold path · weekly trajectory" },
    { step: "SC disagg", detail: "Style-color ratio × mid-level" },
  ],
  filters: ["Persona: NDDC", "Measure: Net demand units", "Basis: Direct", "Horizon: HO2026"],
  kpis: [
    { label: "Season actualized (HO2026)", value: "287K", delta: "+4.2% vs LY" },
    { label: "Forward 8-wk forecast", value: "448K", delta: "Run rate ↑" },
    { label: "Demand profile", value: "Stable", delta: "Low volatility" },
  ],
};

const NMP_META = {
  title: "Nike Running · United States · Nike Marketplace Partners",
  subtitle: "Mid-level · HO2026 · NET_SALES_UNITS · MCCF",
  demand_profile: "Volatile",
  confidence: "Moderate — wholesale lumpiness",
  division_pct: 18.6,
  national_pct: 6.8,
  hierarchy: "18.6% of Nike Running division · 6.8% of NA wholesale (synthetic)",
  model_path: [
    { step: "Star DP", detail: "Mid-level wholesale prior" },
    { step: "Regression", detail: "Silver path · partner mix" },
    { step: "MCCF gross-up", detail: "Partner receipts alignment" },
  ],
  filters: ["Persona: NMP", "Measure: Net sales units", "Basis: MCCF gross-up", "Horizon: HO2026"],
  kpis: [
    { label: "Season actualized (HO2026)", value: "2.09M", delta: "+1.1% vs LY" },
    { label: "Peak week (forward)", value: "522K", delta: "W40 seasonal lift" },
    { label: "Demand profile", value: "Volatile", delta: "Partner mix shifts" },
  ],
};

const VOMERO_SC = [
  { sc: "554724-136", name: "Vomero 17 · Black", share: 28, tier: "gold", path: "Star DP → TSAP → SC", fwd: 15.2, allocated: 12 },
  { sc: "554724-401", name: "Vomero 17 · Photon", share: 22, tier: "gold", path: "Star DP → TSAP → SC", fwd: 11.9, allocated: 14 },
  { sc: "554724-102", name: "Vomero 17 · White", share: 18, tier: "silver", path: "Regression → SC fallback", fwd: 9.8, allocated: 9 },
  { sc: "554724-800", name: "Vomero 17 · Grey", share: 14, tier: "silver", path: "Regression → SC fallback", fwd: 7.6, allocated: 4 },
  { sc: "554724-048", name: "Vomero 17 · Navy", share: 10, tier: "bronze", path: "Legacy SC prior", fwd: 5.4, allocated: 8 },
  { sc: "554724-291", name: "Vomero 17 · Olive", share: 8, tier: "bronze", path: "Legacy SC prior", fwd: 4.3, allocated: 0 },
];

const NMP_SC = [
  { sc: "DV1742-100", name: "Pegasus · White", share: 35, tier: "gold", path: "Star DP → TSAP", fwd: 145, allocated: 150 },
  { sc: "DV1742-001", name: "Pegasus · Black", share: 30, tier: "gold", path: "Star DP → TSAP", fwd: 124, allocated: 118 },
  { sc: "DV1742-401", name: "Pegasus · Blue", share: 20, tier: "silver", path: "Regression", fwd: 83, allocated: 90 },
  { sc: "DV1742-600", name: "Pegasus · Red", share: 15, tier: "bronze", path: "Legacy SC", fwd: 62, allocated: 55 },
];

const VOMERO_SUPPLY = {
  total_inventory: 186,
  geo: [
    { geo: "Northeast", inventory: 52, allocated: 48 },
    { geo: "Southeast", inventory: 28, allocated: 42 },
    { geo: "West", inventory: 62, allocated: 55 },
    { geo: "Central / Midwest", inventory: 44, allocated: 41 },
  ],
};

const VOMERO_STORE_DOORS = [
  { door: "0001234 · Boston · NSO", region: "Northeast", climate: "Cold", sizeRun: "M9–13", inventory: 6.2, allocated: 4, demandIdx: 1.08 },
  { door: "0001456 · New York · NSO", region: "Northeast", climate: "Cold", sizeRun: "M8–14", inventory: 8.1, allocated: 7, demandIdx: 1.12 },
  { door: "0002101 · Chicago · NSO", region: "Central", climate: "Cold", sizeRun: "M9–13", inventory: 5.4, allocated: 3, demandIdx: 1.05 },
  { door: "0002888 · Atlanta · NVS", region: "Southeast", climate: "Mild", sizeRun: "M7–12", inventory: 3.8, allocated: 9, demandIdx: 0.98 },
  { door: "0003012 · Miami · NVS", region: "Southeast", climate: "Warm", sizeRun: "M7–11", inventory: 4.2, allocated: 5, demandIdx: 1.15 },
  { door: "0004020 · LA · NSO", region: "West", climate: "Mild", sizeRun: "M8–13", inventory: 7.5, allocated: 8, demandIdx: 1.02 },
  { door: "0004155 · Portland · NSO", region: "West", climate: "Cold/Wet", sizeRun: "M9–13", inventory: 6.8, allocated: 6, demandIdx: 1.01 },
  { door: "0005100 · Dallas · NVS", region: "South", climate: "Warm", sizeRun: "M8–12", inventory: 4.9, allocated: 6, demandIdx: 0.96 },
  { door: "0005222 · Denver · NSO", region: "West", climate: "Cold", sizeRun: "M9–14", inventory: 5.1, allocated: 4, demandIdx: 1.07 },
  { door: "0006011 · Seattle · NSO", region: "West", climate: "Cold/Wet", sizeRun: "M9–13", inventory: 6.0, allocated: 5, demandIdx: 1.04 },
];

const ASSORTMENT_RANKED_VOMERO = [
  { rank: 1, sc: "554724-136", action: "increase", delta: "+12%", geo: "Northeast / cold doors", reason: "Peak SC share · warmer carry depth" },
  { rank: 2, sc: "554724-291", action: "increase", delta: "+8%", geo: "Chicago, Denver", reason: "Zero o9 allocation vs rising demand signal" },
  { rank: 3, sc: "554724-800", action: "increase", delta: "+5%", geo: "West", reason: "Under-allocated vs implied SC forward" },
  { rank: 4, sc: "554724-048", action: "hold", delta: "0%", geo: "National", reason: "Within tolerance" },
  { rank: 5, sc: "554724-102", action: "decrease", delta: "−6%", geo: "Southeast", reason: "Overstock risk at mild/warm doors" },
];

const NMP_SUPPLY = {
  total_inventory: 4320,
  geo: [
    { geo: "Northeast", inventory: 980, allocated: 920 },
    { geo: "Southeast", inventory: 1050, allocated: 1010 },
    { geo: "West", inventory: 1180, allocated: 1100 },
    { geo: "Central / Midwest", inventory: 910, allocated: 880 },
  ],
};

const VOMERO_ASSIGNMENT = [
  { geo: "Northeast · NYC metro", demand_rank: 1, signal: 98, allocated: 22, gap: "high", note: "Cold-weather SC mix under-allocated" },
  { geo: "Southeast · Atlanta", demand_rank: 2, signal: 92, allocated: 28, gap: "low", note: "Plan exceeds demand — hold" },
  { geo: "West · SoCal", demand_rank: 3, signal: 88, allocated: 35, gap: "ok", note: "Within tolerance" },
  { geo: "Central · Chicago", demand_rank: 4, signal: 85, allocated: 0, gap: "critical", note: "No allocation for top SC 554724-291" },
  { geo: "Northeast · Boston", demand_rank: 5, signal: 81, allocated: 8, gap: "high", note: "Size curve biased large — plan too small" },
];

const NMP_ASSIGNMENT = [
  { geo: "Northeast wholesale", demand_rank: 1, signal: 95, allocated: 210, gap: "ok", note: "" },
  { geo: "Southeast wholesale", demand_rank: 2, signal: 90, allocated: 195, gap: "ok", note: "" },
];

const ASSORTMENT_BY_VIEW = {
  vomero: {
    national: [
      "Carry depth on 554724-136 / 401 — they explain ~50% of mid-level forward units.",
      "Northern geos: favor cold-weather colorways + extended sizing (M9–13).",
      "National AP: long horizon supports procurement pull — not store receipts.",
    ],
    store: [
      "Store lens: shorten WOS target (6 wks) — prioritize door-level turns.",
      "South: lighter materials & smaller size run — demand index +12% vs North.",
      "Retailer doors: widen 554724-800 in West; suppress in Southeast (overstock risk).",
    ],
  },
  nmp: {
    national: [
      "Wholesale national: anchor Pegasus 35/30 SC pairs for partner receipts.",
      "MCCF gross-up lens — do not mix POS in the same total.",
    ],
    store: [
      "Partner door projections: mid-term only — 6-week WOS target applies.",
    ],
  },
};

function assortmentSignals() {
  const key = midView === "nmp" ? "nmp" : "vomero";
  return ASSORTMENT_BY_VIEW[key][planningLens] || ASSORTMENT_BY_VIEW[key].national;
}

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
let planningLens = "national";
let historyRange = "3y";
let selectedSc = "554724-136";
const demoApprovedAssignments = new Set();
const demoApprovedAssortment = { done: false };
let thread = [
  {
    role: "bot",
    text:
      "AP Intelligence prototype — demand, supply, disaggregation, assignment gaps, and assortment signals (synthetic). Live Genie when /api/chat is wired.",
  },
];
let chatBusy = false;

const REFUSAL_FORECAST_OVERRIDE =
  "I cannot recommend or apply a forecast override from this workspace. I can explain the sourced curve, run-rate band, and planning insights shown on the dashboard.";

function wosTarget() {
  return WOS_TARGETS[planningLens] ?? WOS_TARGETS.national;
}

function norm(q) {
  return q.toLowerCase().replace(/\s+/g, " ").trim();
}

function demoAnswerLocal(question, ctx) {
  const q = norm(question);
  const ctab = ctx?.tab || tab;
  const mv = ctx?.mid_view || midView;
  const meta = mv === "nmp" ? NMP_META : VOMERO_META;
  const series = mv === "nmp" ? NMP_WEEKLY : VOMERO_WEEKLY;
  const scaleK = mv === "nmp";

  if (/\b(override|increase|decrease|should we ).*forecast\b/.test(q) && !q.includes("inventory")) {
    return REFUSAL_FORECAST_OVERRIDE;
  }
  if (q.includes("unconstrained") && (q.includes("supply") || q.includes("receipt") || q.includes("inventory") || q.includes("different"))) {
    return (
      "Unconstrained consumer demand is the demand-first planning signal (what customers want), shown in the demand curve. " +
      "It is not inventory on hand, receipts, or o9 allocation. This workspace juxtaposes demand with supply for insights; it does not execute replenishment."
    );
  }
  if (q.includes("nddc") && q.includes("nmp") && (q.includes("net demand") || q.includes("net sales") || q.includes("measure"))) {
    return (
      "NDDC: use net demand units on the direct basis. NMP / store personas: net sales units (NMP wholesale: specify MCCF or POS). Do not blend measures in one total."
    );
  }
  if (q.includes("data sufficiency") || q.includes("confidence") || q.includes("demand profile")) {
    const meta = mv === "nmp" ? NMP_META : VOMERO_META;
    return `Demand profile: ${meta.demand_profile}. Data sufficiency: ${meta.confidence} (synthetic UAT labels — same fields as Forecast Intelligence Genie).`;
  }
  if (q.includes("model path") || q.includes("model onion") || (q.includes("which model") && q.includes("vomero"))) {
    const steps = meta.model_path.map((s) => `${s.step}: ${s.detail}`).join(" → ");
    return `Model path (synthetic, explain-only): ${steps}. SC-level tiers (gold / silver / bronze) are on the Style colors tab.`;
  }
  if (q.includes("continu") && q.includes("revert") || (q.includes("run rate") && q.includes("vomero"))) {
    const adj = plannerAdjustment(series, scaleK);
    return (
      `Recent settled run rate ~${adj.recentDisplay}/wk vs this-season average ~${adj.seasonAvgDisplay}/wk; forward ~${adj.forwardDisplay}/wk. ` +
      `Insight: ${adj.message} (does not apply overrides).`
    );
  }
  if (q.includes("weeks of supply") || q.includes("wos") || (q.includes("inventory") && q.includes("vomero"))) {
    const supply = mv === "nmp" ? NMP_SUPPLY : VOMERO_SUPPLY;
    const w = supplySnapshot(series, supply, scaleK);
    const tgt = ctx?.wos_target_weeks ?? wosTarget();
    const lowGeos = w.geo.filter((g) => g.wos < tgt).map((g) => g.geo);
    return (
      `On-hand ~${w.totalInventoryDisplay} vs forward ~${w.runRateDisplay}/wk → ~${w.wosWeeks.toFixed(1)} weeks of supply (target ${tgt}). ` +
      (lowGeos.length ? `Geos below target: ${lowGeos.join(", ")}. Consider more allocation vs holding other SC/mid-levels.` : "At/above target at rollup.") +
      " o9 execution not changed here."
    );
  }
  if (q.includes("assignment") || q.includes("allocate") && q.includes("gap")) {
    const rows = mv === "nmp" ? NMP_ASSIGNMENT : VOMERO_ASSIGNMENT;
    const bad = rows.filter((r) => r.gap === "critical" || r.gap === "high");
  return (
      `Assignment gaps (synthetic): ${bad.map((r) => `${r.geo} (${r.note})`).join("; ") || "none flagged"}. ` +
      "Revisit in o9; this UI only surfaces mismatches vs demand signal."
    );
  }
  if (q.includes("disagg") || q.includes("sc share") || ((q.includes("style-color") || q.includes("style color")) && q.includes("drive"))) {
    const sc = mv === "nmp" ? NMP_SC : VOMERO_SC;
    const top = sc.slice(0, 3).map((r) => `${r.sc} ${r.share}%`).join(", ");
    return `Top SC shares of mid-level (synthetic): ${top}. Implied SC forward = mid run rate × share% — see Style colors tab.`;
  }
  if (q.includes("assortment") || q.includes("warmer") || q.includes("size")) {
    const list = assortmentSignals();
    const top = ASSORTMENT_RANKED_VOMERO.slice(0, 3).map((r) => `${r.sc} ${r.action} ${r.delta}`).join(", ");
    return `Assortment signals (${planningLens} lens):\n• ${list.join("\n• ")}\nRanked recs (demo): ${top}. Use Approve assortment for SNOP simulation.`;
  }
  if (q.includes("approve") && (q.includes("snle") || q.includes("assignment") || q.includes("allocation"))) {
    return (
      "Demo approve sends a simulated SNLE payload only (logged in this browser). " +
      "Open the Assignment tab, approve flagged rows, or use batch Approve — no o9/SAP writes."
    );
  }
  if (q.includes("store") && (q.includes("inventory") || q.includes("door"))) {
    return (
      `Store grid (synthetic): ${VOMERO_STORE_DOORS.length} doors — toggle Store & retailer lens to see door-level WOS. ` +
      "Climate and size-run hints drive assortment recommendations."
    );
  }
  if (q.includes("share") && (q.includes("division") || q.includes("national") || q.includes("market"))) {
    return (
      `Hierarchy (synthetic): ${meta.division_pct}% of division · ${meta.national_pct}% of NA ${mv === "nmp" ? "wholesale" : "footwear"} rollup. ` +
      "Use with inventory panel when prioritizing mid-levels."
    );
  }
  if (q.includes("below") && (q.includes("target") || q.includes("geo"))) {
    const supply = mv === "nmp" ? NMP_SUPPLY : VOMERO_SUPPLY;
    const w = supplySnapshot(series, supply, scaleK);
    const tgt = wosTarget();
    const lows = w.geo.filter((g) => g.wos < tgt);
    if (!lows.length) return `No geos below ${tgt}-week WOS target.`;
    return lows.map((g) => `${g.geo}: ~${g.wos.toFixed(1)} wks`).join("; ");
  }
  if (q.includes("mccf") || (q.includes("nike running") && q.includes("trend"))) {
    return (
      "Nike Running · NMP · mid-level · net sales · MCCF: settled ~267K–318K; forward peaks W40 ~522K. Supply WOS healthy on synthetic slice."
    );
  }
  if (q.includes("vomero") && q.includes("trend")) {
    return (
      "Vomero · NDDC · mid-level: settled ~42–46K/wk; forward high-50Ks. WOS below national 10-wk target — see supply panel."
    );
  }
  if (q.includes("554724") && (q.includes("season") || q.includes("seasonal"))) {
    return "554724-136 seasonality: Nov index 1.95, Dec 2.05 peak (synthetic). Model path: Star DP → TSAP → SC (gold).";
  }
  return null;
}

function activeViewMeta() {
  return midView === "vomero" ? VOMERO_META : NMP_META;
}

function activeWeeklySeries() {
  if (tab === "assignment") return midView === "vomero" ? VOMERO_WEEKLY : NMP_WEEKLY;
  if (tab !== "midlevel" && tab !== "style_colors") return [];
  return midView === "vomero" ? VOMERO_WEEKLY : NMP_WEEKLY;
}

function activeSupply() {
  return midView === "vomero" ? VOMERO_SUPPLY : NMP_SUPPLY;
}

function activeScList() {
  return midView === "vomero" ? VOMERO_SC : NMP_SC;
}

function activeAssignment() {
  return midView === "vomero" ? VOMERO_ASSIGNMENT : NMP_ASSIGNMENT;
}

function activeLy() {
  return midView === "vomero" ? vomeroLyHistory() : nmpLyHistory();
}

function forwardRunRate(series) {
  const fwd = series.filter((w) => w.f > 0);
  if (!fwd.length) return 0;
  return fwd.reduce((s, w) => s + w.f, 0) / fwd.length;
}

function recentActualRunRate(series) {
  const act = series.filter((w) => w.a > 0);
  if (!act.length) return 0;
  const tail = act.slice(-4);
  return tail.reduce((s, w) => s + w.a, 0) / tail.length;
}

function seasonAvgRunRate(series) {
  const ho = series.filter((w) => w.a > 0 && w.season === "HO2026");
  const act = ho.length ? ho : series.filter((w) => w.a > 0).slice(-52);
  if (!act.length) return 0;
  return act.reduce((s, w) => s + w.a, 0) / act.length;
}

function seriesForChart(series) {
  if (historyRange === "1y") return series.slice(-52);
  if (historyRange === "season") return series.filter((w) => w.season === "HO2026");
  return series;
}

function lyForChartSlice(fullSeries, slice) {
  const lyFull = lyHistoryFromSeries(fullSeries);
  const start = fullSeries.length - slice.length;
  return lyFull.slice(start);
}

function rangeCaption() {
  if (historyRange === "1y") return "1 year · scroll for detail";
  if (historyRange === "season") return "HO2026 season";
  return "3+ years (2023–2026)";
}

function plannerAdjustment(series, scaleK) {
  const recent = recentActualRunRate(series);
  const seasonAvg = seasonAvgRunRate(series);
  const forward = forwardRunRate(series);
  const fmt = (v) => (scaleK ? `${Math.round(v)}K` : `${v.toFixed(1)}K`);
  let message;
  if (forward > recent * 1.05 && forward > seasonAvg) {
    message = "Forward band is above recent actuals and season average — panel suggests continuing the elevated trajectory unless inventory constrains.";
  } else if (forward < seasonAvg * 0.98) {
    message = "Forward sits below season average — insight frame is revert-toward-mean; validate with demand profile.";
  } else {
    message = "Forward is in line with recent run rate (~continue band).";
  }
  return {
    recent,
    seasonAvg,
    forward,
    recentDisplay: fmt(recent),
    seasonAvgDisplay: fmt(seasonAvg),
    forwardDisplay: fmt(forward),
    message,
  };
}

function supplySnapshot(series, supply, scaleK) {
  const runRate = forwardRunRate(series);
  const totalInv = supply.total_inventory;
  const wosWeeks = runRate > 0 ? totalInv / runRate : 0;
  const fmt = (v) => (scaleK ? `${Math.round(v)}K` : `${Number(v).toFixed(0)}K`);
  const geo = supply.geo.map((row) => {
    const wos = runRate > 0 ? row.inventory / runRate : 0;
    return { ...row, wos, inventoryDisplay: fmt(row.inventory), allocatedDisplay: fmt(row.allocated) };
  });
  return {
    runRate,
    runRateDisplay: fmt(runRate),
    totalInventory: totalInv,
    totalInventoryDisplay: fmt(totalInv),
    wosWeeks,
    geo,
  };
}

function contextPayload() {
  const meta = activeViewMeta();
  const series = activeWeeklySeries().length ? activeWeeklySeries() : VOMERO_WEEKLY;
  const scaleK = midView === "nmp";
  return {
    tab,
    mid_view: midView,
    planning_lens: planningLens,
    season: "HO2026",
    geo: "United States",
    region: "North America",
    wos_target_weeks: wosTarget(),
    dashboard: {
      title: meta.title,
      subtitle: meta.subtitle,
      filters: meta.filters,
      demand_profile: meta.demand_profile,
      confidence: meta.confidence,
      kpis: meta.kpis,
      division_pct: meta.division_pct,
      national_pct: meta.national_pct,
      model_path: meta.model_path,
      weekly: series,
      supply: supplySnapshot(series, activeSupply(), scaleK),
      style_colors: activeScList(),
      assignment: activeAssignment(),
      planner_adjustment: plannerAdjustment(series, scaleK),
      assortment: assortmentSignals(),
      assortment_ranked: midView === "vomero" ? ASSORTMENT_RANKED_VOMERO : [],
      store_doors: midView === "vomero" ? VOMERO_STORE_DOORS : [],
      demo_approvals: { assignments: [...demoApprovedAssignments], assortment: demoApprovedAssortment.done },
      hierarchy: meta.hierarchy,
    },
    mode: "ap_intelligence_synthetic_prototype",
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

function formatUnits(v, scaleK) {
  if (scaleK) return `${Math.round(v)}K`;
  return `${Number(v).toFixed(1)}K`;
}

function formatTotalK(v, scaleK) {
  if (scaleK && v >= 1000) return `${(v / 1000).toFixed(2)}M`;
  return formatUnits(v, scaleK);
}

function kpisFromSeries(series, scaleK, template) {
  const hoActuals = series.filter((w) => w.a > 0 && w.season === "HO2026");
  const actualPool = hoActuals.length ? hoActuals : series.filter((w) => w.a > 0).slice(-26);
  const actualSum = actualPool.reduce((s, w) => s + w.a, 0);
  const forward = series.filter((w) => w.f > 0);
  const forward8 = forward.slice(0, 8).reduce((s, w) => s + w.f, 0);
  const out = template.map((k) => ({ ...k }));
  out[0] = { ...out[0], value: formatTotalK(actualSum, scaleK) };
  if (out[1].label.toLowerCase().includes("forward 8")) {
    out[1] = { ...out[1], value: formatTotalK(forward8, scaleK) };
  } else if (out[1].label.toLowerCase().includes("peak week")) {
    const peak = forward.reduce((b, w) => (w.f > b.f ? w : b), forward[0]);
    out[1] = { ...out[1], value: formatUnits(peak.f, scaleK), delta: `${peak.week} seasonal lift` };
  }
  return out;
}

function escapeHtml(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHierarchyBar(meta) {
  const el = document.getElementById("hierarchy-bar");
  if (!el) return;
  el.hidden = false;
  el.innerHTML = `
    <span><strong>Division</strong> ${meta.division_pct}%</span>
    <span class="sep">·</span>
    <span><strong>National</strong> ${meta.national_pct}%</span>
    <span class="sep">·</span>
    <span class="hierarchy-sub">${escapeHtml(meta.hierarchy)}</span>`;
}

function renderModelPath(meta) {
  const el = document.getElementById("model-path-mid");
  if (!el) return;
  el.innerHTML = meta.model_path
    .map(
      (s, i) =>
        `<li><span class="step-num">${i + 1}</span><strong>${escapeHtml(s.step)}</strong> — ${escapeHtml(s.detail)}</li>`,
    )
    .join("");
}

function renderCombinedChart(data, lyData, scaleK) {
  const el = document.getElementById("weekly-chart-combined");
  const scroll = document.getElementById("chart-scroll");
  if (!el) return;
  const h = 172;
  const pad = { l: 12, r: 12, t: 10, b: 28 };
  const step = Math.max(4, Math.min(8, Math.floor(900 / Math.max(data.length, 1))));
  const w = Math.max(640, pad.l + pad.r + data.length * step);
  const max = Math.max(...data.flatMap((p, i) => [p.a, p.f, lyData[i]?.ly || 0]), 1);
  const n = data.length;
  const x = (i) => pad.l + i * step;
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const barW = Math.max(1.5, step * 0.32);
  const bars = data
    .map((p, i) => {
      const cx = x(i);
      let out = "";
      if (p.a) {
        const y0 = y(p.a);
        const bh = h - pad.b - y0;
        out += `<rect class="combo-bar actual" x="${(cx - barW).toFixed(1)}" y="${y0.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="0.5"/>`;
      }
      if (p.f) {
        const y0 = y(p.f);
        const bh = h - pad.b - y0;
        out += `<rect class="combo-bar forecast" x="${cx.toFixed(1)}" y="${y0.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="0.5"/>`;
      }
      return out;
    })
    .join("");
  let lyPath = "";
  lyData.forEach((p, i) => {
    lyPath += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.ly).toFixed(1)} `;
  });
  let actPath = "";
  let fcPath = "";
  data.forEach((p, i) => {
    if (p.a) actPath += `${actPath ? "L" : "M"}${x(i).toFixed(1)},${y(p.a).toFixed(1)} `;
    if (p.f) fcPath += `${fcPath ? "L" : "M"}${x(i).toFixed(1)},${y(p.f).toFixed(1)} `;
  });
  const labelEvery = historyRange === "season" ? 2 : historyRange === "1y" ? 4 : 13;
  const labels = data
    .map((p, i) => {
      if (i % labelEvery !== 0 && i !== n - 1) return "";
      const short = p.isoWeek === 1 ? String(p.year) : `W${p.isoWeek}`;
      return `<text x="${x(i)}" y="${h - 6}" class="line-label" text-anchor="middle">${short}</text>`;
    })
    .join("");
  const yearLines = data
    .map((p, i) => (p.isoWeek === 1 ? `<line x1="${x(i)}" x2="${x(i)}" y1="${pad.t}" y2="${h - pad.b}" class="year-line"/>` : ""))
    .join("");
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="line-svg" role="img" aria-label="Weekly demand bars and lines">
    ${yearLines}
  <g class="combo-bars">${bars}</g>
  <path class="line-ly" d="${lyPath}" fill="none"/>
  <path class="line-actual" d="${actPath}" fill="none"/>
  <path class="line-forecast" d="${fcPath}" fill="none"/>
  ${labels}
  </svg>`;
  if (scroll) scroll.scrollLeft = scroll.scrollWidth;
}

function renderPlannerInsight(series, scaleK) {
  const el = document.getElementById("planner-insight");
  if (!el) return;
  const adj = plannerAdjustment(series, scaleK);
  el.innerHTML = `
    <h3>Planner adjustment frame</h3>
    <p class="insight-line"><strong>Recent run rate</strong> ${escapeHtml(adj.recentDisplay)}/wk ·
    <strong>Season avg</strong> ${escapeHtml(adj.seasonAvgDisplay)}/wk ·
    <strong>Forward</strong> ${escapeHtml(adj.forwardDisplay)}/wk</p>
    <p class="insight-msg">${escapeHtml(adj.message)}</p>`;
}

function renderKpis(meta) {
  const row = document.getElementById("kpi-row");
  if (!row) return;
  row.innerHTML = (meta.kpis || [])
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
  const lensLabel = planningLens === "national" ? "Lens: National AP" : "Lens: Store / retailer";
  el.innerHTML = [lensLabel, ...meta.filters]
    .map((f) => `<span class="filter-pill active">${escapeHtml(f)}</span>`)
    .join("");
}

function renderSupplyPanel(series, supply, scaleK) {
  const panel = document.getElementById("supply-panel");
  const kpisEl = document.getElementById("supply-kpis");
  const alertEl = document.getElementById("wos-alert");
  const allocEl = document.getElementById("alloc-by-geo");
  const threshEl = document.getElementById("wos-threshold-label");
  const lensHint = document.getElementById("wos-lens-hint");
  if (!panel || !supply || !series.length) {
    if (panel) panel.hidden = true;
    return;
  }
  panel.hidden = tab !== "midlevel";
  const tgt = wosTarget();
  if (threshEl) threshEl.textContent = String(tgt);
  if (lensHint) lensHint.textContent = planningLens === "national" ? " (national)" : " (store)";

  const snap = supplySnapshot(series, supply, scaleK);
  const wosLow = snap.wosWeeks < tgt;
  kpisEl.innerHTML = `
    <article class="supply-kpi"><p class="supply-kpi-label">On-hand</p><p class="supply-kpi-value">${escapeHtml(snap.totalInventoryDisplay)}</p></article>
    <article class="supply-kpi"><p class="supply-kpi-label">Forward run rate</p><p class="supply-kpi-value">${escapeHtml(snap.runRateDisplay)}/wk</p></article>
    <article class="supply-kpi ${wosLow ? "alert" : "ok"}"><p class="supply-kpi-label">Weeks of supply</p><p class="supply-kpi-value">${snap.wosWeeks.toFixed(1)} wks</p></article>`;

  alertEl.hidden = false;
  alertEl.className = "wos-alert";
  alertEl.removeAttribute("style");
  if (wosLow) {
    alertEl.innerHTML = `<strong>Below ${tgt}-week target.</strong> ~${snap.wosWeeks.toFixed(1)} weeks on hand — insight: prioritize allocation to this mid-level; avoid breaking more inventory into overloaded geos.`;
  } else {
    alertEl.style.background = "#ecfdf3";
    alertEl.style.borderColor = "#6ce9a6";
    alertEl.style.color = "#027a48";
    alertEl.innerHTML = `At/above ${tgt}-week target. Insight: hold allocation or shift focus to other style-colors / mid-levels.`;
  }

  const geoRows = snap.geo;
  allocEl.innerHTML = `<table>
    <thead><tr><th>Geo</th><th>Inventory</th><th>Allocated (o9 plan)</th><th>WOS</th></tr></thead>
    <tbody>${geoRows
      .map((g) => {
        const cls = g.wos < tgt ? "row-alert" : "";
        return `<tr class="${cls}"><td>${escapeHtml(g.geo)}</td><td class="num">${g.inventoryDisplay}</td><td class="num">${g.allocatedDisplay}</td><td class="num">${g.wos.toFixed(1)}</td></tr>`;
      })
      .join("")}</tbody></table>`;
  renderStoreInventory(series, scaleK);
}

function renderStoreInventory(series, scaleK) {
  const block = document.getElementById("store-inventory-block");
  const table = document.getElementById("store-inventory-table");
  if (!block || !table) return;
  const show = planningLens === "store" && midView === "vomero";
  block.hidden = !show;
  if (!show) return;
  const runRate = forwardRunRate(series);
  const tgt = wosTarget();
  const fmt = (v) => (scaleK ? `${v.toFixed(0)}K` : `${v.toFixed(1)}K`);
  table.innerHTML = `<table>
    <thead><tr><th>Door</th><th>Climate</th><th>Size run</th><th>Inv</th><th>Plan</th><th>WOS</th></tr></thead>
    <tbody>${VOMERO_STORE_DOORS.map((d) => {
      const wos = runRate > 0 ? d.inventory / runRate : 0;
      const cls = wos < tgt ? "row-alert" : "";
      return `<tr class="${cls}">
        <td>${escapeHtml(d.door)}</td>
        <td>${escapeHtml(d.climate)}</td>
        <td>${escapeHtml(d.sizeRun)}</td>
        <td class="num">${fmt(d.inventory)}</td>
        <td class="num">${fmt(d.allocated)}</td>
        <td class="num">${wos.toFixed(1)}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

function recClass(action) {
  if (action === "increase") return "rec-up";
  if (action === "decrease") return "rec-down";
  return "rec-hold";
}

function renderAssortment() {
  const el = document.getElementById("assortment-panel");
  const rankedEl = document.getElementById("assortment-ranked");
  const approveRow = document.getElementById("assortment-approve-row");
  if (!el || tab !== "midlevel") {
    if (el) el.hidden = true;
    return;
  }
  el.hidden = false;
  const list = assortmentSignals();
  const ranked =
    midView === "vomero"
      ? ASSORTMENT_RANKED_VOMERO
      : [{ rank: 1, sc: "DV1742-100", action: "hold", delta: "0%", geo: "Wholesale", reason: "Within plan" }];
  const rankedHtml = `<h3>Assortment recommendations <span class="tag">ranked</span></h3>
    <div class="alloc-table-wrap"><table>
      <thead><tr><th>#</th><th>Style-color</th><th>Action</th><th>Δ</th><th>Geo focus</th><th>Rationale</th></tr></thead>
      <tbody>${ranked
        .map(
          (r) => `<tr>
            <td class="num">${r.rank}</td>
            <td>${escapeHtml(r.sc)}</td>
            <td class="${recClass(r.action)}">${escapeHtml(r.action)}</td>
            <td class="num">${escapeHtml(r.delta)}</td>
            <td>${escapeHtml(r.geo)}</td>
            <td>${escapeHtml(r.reason)}</td>
          </tr>`,
        )
        .join("")}</tbody></table></div>`;
  rankedEl.innerHTML = `
    <h3>Assortment signals <span class="tag">${planningLens === "national" ? "long-term" : "mid-term"}</span></h3>
    <ul class="signal-list">${list.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
    ${rankedHtml}
    ${demoApprovedAssortment.done ? '<p class="note approved-note">✓ Assortment pack demo-approved (SNOP simulation).</p>' : ""}`;
  if (approveRow) {
    approveRow.hidden = false;
    const btn = document.getElementById("btn-approve-assortment");
    if (btn) btn.disabled = demoApprovedAssortment.done;
  }
}

function openApproveDialog(title, body, onConfirm) {
  const dlg = document.getElementById("approve-dialog");
  const bodyEl = document.getElementById("approve-dialog-body");
  const titleEl = document.getElementById("approve-dialog-title");
  if (!dlg || !bodyEl) return;
  if (titleEl) titleEl.textContent = title;
  bodyEl.textContent = body;
  dlg.onclose = () => {
    if (dlg.returnValue === "confirm") onConfirm();
  };
  dlg.showModal();
}

function renderWeeklyTable(data, scaleK) {
  const el = document.getElementById("weekly-table");
  if (!el) return;
  const rows = data
    .map((w) => `<tr><td>${w.week}</td><td class="num">${w.a ? formatUnits(w.a, scaleK) : "—"}</td><td class="num">${w.f ? formatUnits(w.f, scaleK) : "—"}</td></tr>`)
    .join("");
  const first = data[0]?.week ?? "";
  const last = data[data.length - 1]?.week ?? "";
  el.innerHTML = `<p class="weekly-table-caption">Weekly detail · ${data.length} weeks · ${escapeHtml(first)} → ${escapeHtml(last)}</p>
    <div class="weekly-table-scroll"><table>
      <thead><tr><th>Week</th><th>Actual</th><th>Forecast</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function tierClass(tier) {
  return `tier-${tier}`;
}

function renderDisaggTab() {
  const tableEl = document.getElementById("sc-disagg-table");
  const formula = document.getElementById("disagg-formula");
  const detail = document.getElementById("sc-detail-panel");
  const series = activeWeeklySeries();
  const scaleK = midView === "nmp";
  const runRate = forwardRunRate(series);
  const fmt = (v) => (scaleK ? `${Math.round(v)}K` : `${v.toFixed(1)}K`);
  if (formula) {
    formula.textContent = `Implied SC forward (units/wk) ≈ mid forward run rate (${fmt(runRate)}) × SC share%. Synthetic disaggregation — not an override control.`;
  }
  const sc = activeScList();
  tableEl.innerHTML = `<table>
    <thead><tr><th>Style-color</th><th>Share of mid</th><th>Impl. fwd /wk</th><th>Model</th><th>Plan alloc</th><th></th></tr></thead>
    <tbody>${sc
      .map((row) => {
        const implied = (runRate * row.share) / 100;
        const gap = row.allocated < implied * 0.85;
        return `<tr class="${gap ? "row-alert" : ""}">
          <td><button type="button" class="linkish sc-pick" data-sc="${escapeHtml(row.sc)}">${escapeHtml(row.sc)}</button><br><span class="sc-name">${escapeHtml(row.name)}</span></td>
          <td class="num">${row.share}%</td>
          <td class="num">${fmt(implied)}</td>
          <td><span class="model-badge ${tierClass(row.tier)}">${escapeHtml(row.tier)}</span> ${escapeHtml(row.path)}</td>
          <td class="num">${row.allocated}${scaleK ? "K" : ""}</td>
          <td>${gap ? '<span class="flag">Under plan</span>' : "—"}</td>
        </tr>`;
      })
      .join("")}</tbody></table>`;

  tableEl.querySelectorAll(".sc-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSc = btn.dataset.sc;
      renderScDetail();
    });
  });
  renderScDetail();
}

function renderScDetail() {
  const detail = document.getElementById("sc-detail-panel");
  const row = activeScList().find((r) => r.sc === selectedSc) || activeScList()[0];
  if (!detail || !row) return;
  detail.innerHTML = `
    <h3>${escapeHtml(row.sc)} · ${escapeHtml(row.name)}</h3>
    <p class="meta">${row.share}% of mid-level · ${escapeHtml(row.path)}</p>
    <p class="meta">Monthly seasonality (554724 family pattern): Nov 1.95 · Dec 2.05 peak (synthetic).</p>
    <div class="season-grid" id="season-grid-inline"></div>`;
  const grid = detail.querySelector("#season-grid-inline");
  grid.innerHTML = SEASON_MONTHS.map(
    (m) => `<div class="month${m.peak ? " peak" : ""}"><div>${m.name}</div><strong>${m.idx}</strong></div>`,
  ).join("");
}

function assignmentRowId(r) {
  return `asg-${r.demand_rank}-${r.geo.replace(/\s+/g, "-").slice(0, 24)}`;
}

function renderAssignmentTab() {
  const intro = document.getElementById("assignment-intro");
  const table = document.getElementById("assignment-table");
  const rows = activeAssignment();
  const flagged = rows.filter((r) => r.gap === "critical" || r.gap === "high");
  intro.innerHTML =
    `Compares demand signal to o9 plan. <strong>${flagged.length} rows</strong> flagged for demo SNLE approve.`;
  table.innerHTML = `<table>
    <thead><tr><th>Geo / market</th><th>Rank</th><th>Signal</th><th>Alloc</th><th>Gap</th><th>Note</th><th>Demo approve</th></tr></thead>
    <tbody>${rows
      .map((r) => {
        const cls = r.gap === "critical" || r.gap === "high" ? "row-alert" : "";
        const id = assignmentRowId(r);
        const approved = demoApprovedAssignments.has(id);
        const canApprove = (r.gap === "critical" || r.gap === "high") && r.note;
        return `<tr class="${cls}" data-asg-id="${escapeHtml(id)}">
          <td>${escapeHtml(r.geo)}</td>
          <td class="num">#${r.demand_rank}</td>
          <td class="num">${r.signal}</td>
          <td class="num">${r.allocated}</td>
          <td><span class="gap gap-${escapeHtml(r.gap)}">${escapeHtml(r.gap)}</span></td>
          <td>${escapeHtml(r.note)}</td>
          <td>${
            canApprove
              ? `<button type="button" class="btn-approve-mini row-approve${approved ? " approved" : ""}" data-asg-id="${escapeHtml(id)}" ${approved ? "disabled" : ""}>${approved ? "Approved" : "Approve"}</button>`
              : "—"
          }</td>
        </tr>`;
      })
      .join("")}</tbody></table>`;
  table.querySelectorAll(".row-approve").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.asgId;
      const row = rows.find((r) => assignmentRowId(r) === id);
      if (!row) return;
      openApproveDialog(
        "Approve assignment adjustment (SNLE demo)",
        `Simulate SNLE allocation change for ${row.geo}: ${row.note}. Suggested realloc +${row.gap === "critical" ? "priority" : "review"} units (synthetic).`,
        () => {
          demoApprovedAssignments.add(id);
          thread.push({
            role: "bot",
            text: `[Demo SNLE] Recorded approval for ${row.geo}. No o9 write performed.`,
          });
          renderThread();
          renderAssignmentTab();
        },
      );
    });
  });
}

function bindDemoApproveChrome() {
  document.getElementById("btn-approve-assortment")?.addEventListener("click", () => {
    openApproveDialog(
      "Approve assortment pack (SNOP demo)",
      "Push ranked SC mix to SNOP planning calendar (synthetic): increases on 554724-136/291/800, decrease on 554724-102 in Southeast.",
      () => {
        demoApprovedAssortment.done = true;
        thread.push({ role: "bot", text: "[Demo SNOP] Assortment pack approved for HO2026 national pull (simulation only)." });
        renderThread();
        renderAssortment();
      },
    );
  });
  document.getElementById("btn-approve-assignment-batch")?.addEventListener("click", () => {
    const rows = activeAssignment().filter((r) => (r.gap === "critical" || r.gap === "high") && r.note);
    openApproveDialog(
      "Batch approve assignment insights (SNLE demo)",
      `Approve ${rows.length} flagged markets in one demo payload: ${rows.map((r) => r.geo).join("; ")}.`,
      () => {
        rows.forEach((r) => demoApprovedAssignments.add(assignmentRowId(r)));
        thread.push({
          role: "bot",
          text: `[Demo SNLE] Batch approved ${rows.length} assignment insights (simulation only).`,
        });
        renderThread();
        renderAssignmentTab();
      },
    );
  });
}

function renderDashboard() {
  const meta = activeViewMeta();
  const midBlock = document.getElementById("midlevel-block");
  const scBlock = document.getElementById("style-colors-block");
  const asgBlock = document.getElementById("assignment-block");
  const title = document.getElementById("dash-title");
  const sub = document.getElementById("dash-meta");
  const profile = document.getElementById("demand-profile");
  const lensLabel = document.getElementById("toolbar-lens-label");

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".lens-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lens === planningLens);
  });

  if (lensLabel) {
    lensLabel.textContent =
      planningLens === "national"
        ? "National assortment planning (long-term · procurement)"
        : "Store & retailer planning (mid-term · allocation)";
  }

  title.textContent = meta.title;
  sub.textContent = meta.subtitle;
  if (profile) {
    profile.textContent = meta.demand_profile;
    profile.dataset.tone = meta.demand_profile.toLowerCase().includes("volatile") ? "volatile" : "stable";
  }
  const conf = document.getElementById("confidence-badge");
  if (conf && meta.confidence) {
    conf.textContent = meta.confidence;
    conf.dataset.tone = meta.confidence.toLowerCase().includes("moderate") ? "volatile" : "stable";
  }

  renderHierarchyBar(meta);
  const scaleK = midView === "nmp";
  const series = midView === "vomero" ? VOMERO_WEEKLY : NMP_WEEKLY;
  const kpis = kpisFromSeries(series, scaleK, meta.kpis);
  renderKpis({ ...meta, kpis });
  renderFilters(meta);
  renderModelPath(meta);

  midBlock.hidden = tab !== "midlevel";
  scBlock.hidden = tab !== "style_colors";
  asgBlock.hidden = tab !== "assignment";

  const cap = document.getElementById("chart-range-caption");
  if (cap) cap.textContent = `Weekly demand · ${rangeCaption()}`;
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === historyRange);
  });

  const chartSlice = seriesForChart(series);
  const lySlice = lyForChartSlice(series, chartSlice);
  const tableSlice = historyRange === "3y" ? series.slice(-52) : chartSlice;

  if (tab === "midlevel") {
    renderCombinedChart(chartSlice, lySlice, scaleK);
    renderPlannerInsight(series, scaleK);
    renderWeeklyTable(tableSlice, scaleK);
    renderSupplyPanel(series, activeSupply(), scaleK);
    renderAssortment();
  }
  if (tab === "style_colors") renderDisaggTab();
  if (tab === "assignment") renderAssignmentTab();
}

function setTab(next) {
  tab = next;
  renderDashboard();
}

function setLens(lens) {
  planningLens = lens;
  renderDashboard();
}

function setHistoryRange(r) {
  historyRange = r;
  document.querySelectorAll("[data-range]").forEach((b) => {
    b.classList.toggle("active", b.dataset.range === r);
  });
  renderDashboard();
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
  if (lower.includes("nike running") || lower.includes("nmp")) {
    midView = "nmp";
    tab = "midlevel";
  }
  if (lower.includes("vomero")) midView = "vomero";
  if (lower.includes("assignment") || lower.includes("allocate")) tab = "assignment";
  if (lower.includes("style-color") || lower.includes("disagg") || lower.includes("model path")) tab = "style_colors";
  if (lower.includes("assortment") || lower.includes("store")) {
    if (lower.includes("store") || lower.includes("retailer")) planningLens = "store";
  }
  renderDashboard();
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
    window.__FI_STATIC_DEMO__ === true || new URLSearchParams(location.search).get("static") === "1";

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
      if (llm.answer) finish(llm.answer);
      else if (local) finish(local);
      else finish(llm.error || "Could not reach chat API.", true);
    } else {
      finish(local || "Try a planning chip on the right.");
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
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
  document.querySelectorAll(".lens-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLens(btn.dataset.lens));
  });
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => setHistoryRange(btn.dataset.range));
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

  bindDemoApproveChrome();
  renderDashboard();
  renderThread();
}

init();