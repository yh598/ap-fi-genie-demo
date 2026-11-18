"""Rule-based Genie demo answers (aligned with static/genie-demo.js synthetic prototype)."""

from __future__ import annotations

import re
from typing import Any

WOS_NATIONAL = 10
WOS_STORE = 6


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


REFUSAL_FORECAST_OVERRIDE = (
    "I cannot recommend or apply a forecast override from this workspace. "
    "I can explain the sourced curve, run-rate band, and planning insights on the dashboard."
)

REFUSAL_MODEL = (
    "I cannot answer this from the configured Forecast Intelligence data. Model and training "
    "details are not available in this Genie space."
)


def answer(question: str, ctx: dict[str, Any] | None = None) -> str | None:
    """Return a canned answer, or None if no demo rule matches."""
    q = _norm(question)
    ctx = ctx or {}
    mid_view = str(ctx.get("mid_view", "vomero"))
    planning_lens = str(ctx.get("planning_lens", "national"))
    wos_target = int(ctx.get("wos_target_weeks") or (WOS_STORE if planning_lens == "store" else WOS_NATIONAL))
    dash = ctx.get("dashboard") if isinstance(ctx.get("dashboard"), dict) else {}

    if re.search(r"\b(override|increase|decrease|should we ).*forecast\b", q) and "inventory" not in q:
        return REFUSAL_FORECAST_OVERRIDE

    if ("which model" in q or "what model" in q) and "path" not in q:
        return REFUSAL_MODEL

    if "unconstrained" in q and any(x in q for x in ("supply", "receipt", "inventory", "different")):
        return (
            "Unconstrained consumer demand is the demand-first planning signal (what customers want), "
            "shown in the demand curve. It is not inventory on hand, receipts, or o9 allocation. "
            "This workspace juxtaposes demand with supply for insights; it does not execute replenishment."
        )

    if "nddc" in q and "nmp" in q and ("net demand" in q or "net sales" in q or "measure" in q):
        return (
            "NDDC: use net demand units on the direct basis. NMP / store personas: net sales units "
            "(NMP wholesale: specify MCCF or POS). Do not blend measures in one total."
        )

    if "data sufficiency" in q or ("demand profile" in q and "assortment" not in q):
        prof = dash.get("demand_profile") or ("Volatile" if mid_view == "nmp" else "Stable")
        conf = dash.get("confidence") or "Synthetic"
        return f"Demand profile: {prof}. Data sufficiency: {conf} (synthetic UAT labels)."

    if "weeks of supply" in q or " wos" in q or ("inventory" in q and "vomero" in q):
        supply = dash.get("supply") if isinstance(dash.get("supply"), dict) else {}
        wos = supply.get("wosWeeks")
        inv = supply.get("totalInventoryDisplay", "~186K")
        rr = supply.get("runRateDisplay", "~54K")
        if wos is not None:
            return (
                f"On-hand ~{inv} vs forward ~{rr}/wk → ~{float(wos):.1f} weeks of supply "
                f"(target {wos_target}). Review geos below target on the supply panel. o9 not changed here."
            )
        return f"Weeks-of-supply compare inventory to forward run rate (target {wos_target} weeks). See supply panel."

    if "assignment" in q or ("allocate" in q and "gap" in q):
        return (
            "Assignment tab lists demand vs o9 plan gaps (e.g. Chicago critical, Boston high). "
            "Use row Approve or batch Approve for SNLE demo simulation — no production writes."
        )

    if "approve" in q and any(x in q for x in ("snle", "snop", "assignment", "assortment")):
        return (
            "Demo approve opens a modal and logs a simulated SNOP/SNLE payload in chat. "
            "No tickets are created in o9, SAP, or ERP."
        )

    if "store" in q and ("inventory" in q or "door" in q):
        doors = dash.get("store_doors") or []
        n = len(doors) if doors else 10
        return (
            f"Store grid: {n} synthetic doors with climate and size-run hints. "
            "Select Store & retailer lens on the demand tab to see door-level WOS."
        )

    if "assortment" in q or "warmer" in q or ("size" in q and "store" in q):
        ranked = dash.get("assortment_ranked") or []
        top = ", ".join(
            f"{r.get('sc')} {r.get('action')}" for r in ranked[:3] if isinstance(r, dict)
        ) or "554724-136 increase, 554724-291 increase"
        return f"Ranked assortment recs (demo): {top}. Approve assortment pack simulates SNOP."

    if "model path" in q or "model onion" in q:
        return (
            "Model path (explain-only): Star DP → TSAP → SC disagg for gold style-colors; "
            "regression / legacy for bronze. See Style colors tab — no pipeline re-run in this UI."
        )

    if "continu" in q and "revert" in q or ("run rate" in q and "vomero" in q):
        adj = dash.get("planner_adjustment") if isinstance(dash.get("planner_adjustment"), dict) else {}
        if adj:
            return (
                f"Recent ~{adj.get('recentDisplay', '?')}/wk · season avg ~{adj.get('seasonAvgDisplay', '?')}/wk · "
                f"forward ~{adj.get('forwardDisplay', '?')}/wk. {adj.get('message', 'See planner adjustment frame.')}"
            )
        return "Compare recent run rate, season average, and forward band on the planner adjustment card."

    if "share" in q and any(x in q for x in ("division", "national", "percent", "market")):
        dp = dash.get("division_pct")
        np = dash.get("national_pct")
        if dp is not None and np is not None:
            return f"Hierarchy (synthetic): {dp}% of division · {np}% of national rollup."
        return "See hierarchy bar above filters for division and national share."

    if "554724" in q and ("season" in q or "seasonal" in q):
        tab = str(ctx.get("tab", "midlevel"))
        if tab == "style_color" and "nddc" not in q and "net demand" not in q:
            return _seasonality_clarify()
        return _seasonality_answer()

    if "nddc" in q and "net demand" in q and ("554724" in q or "direct basis" in q):
        return _seasonality_answer()

    if "disagg" in q or "sc share" in q or ("style-color" in q and "drive" in q):
        return (
            "SC forward ≈ mid-level run rate × SC share%. Top drivers on Style colors tab with model tier badges."
        )

    if "below" in q and ("target" in q or "geo" in q):
        return f"Geos or doors with WOS under {wos_target} weeks are highlighted in the supply tables."

    if "mccf" in q or ("nike running" in q and "trend" in q):
        return _nmp_running_answer(ctx)

    if "vomero" in q and "trend" in q:
        return _vomero_trend_answer(ctx)

    return None


def _seasonality_clarify() -> str:
    return (
        "Which persona should I use?\n\n• NDDC: net demand (direct)\n• NSO / NVS: net sales\n"
        "• NMP: net sales (MCCF or POS)\n\nReply with NDDC net demand to continue."
    )


def _seasonality_answer() -> str:
    return (
        "Seasonality for 554724-136, US, NDDC, net demand, HO2026: November index 1.95; "
        "December 2.05 (peak). Model path: Star DP → TSAP → SC (gold)."
    )


def _vomero_trend_answer(ctx: dict[str, Any]) -> str:
    _ = ctx
    return (
        "Vomero · NDDC · mid-level: multi-year chart shows seasonal lifts; HO2026 forward in high band. "
        "Supply WOS may be below national target — see supply panel."
    )


def _nmp_running_answer(ctx: dict[str, Any]) -> str:
    _ = ctx
    return (
        "Nike Running · NMP · mid-level · net sales · MCCF: wholesale lumpiness in settled weeks; "
        "forward peaks around seasonal window. Supply WOS healthy on synthetic slice."
    )


def self_check() -> None:
    assert answer("Should we increase the forecast for Nike Running next month?") == REFUSAL_FORECAST_OVERRIDE
    assert "weeks of supply" in answer(
        "What is weeks of supply for Vomero?",
        {"mid_view": "vomero", "wos_target_weeks": 10, "dashboard": {"supply": {"wosWeeks": 3.4, "totalInventoryDisplay": "186K", "runRateDisplay": "54K"}}},
    )
    assert "SNLE" in answer("How do I approve assignment to SNLE?")
    sea = answer("What seasonal pattern applies to style-color 554724-136 in the United States?")
    assert sea and "December" in sea


if __name__ == "__main__":
    self_check()
    print("demo_genie_responses: ok")