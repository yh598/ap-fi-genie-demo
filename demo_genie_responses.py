"""Rule-based Genie demo answers for public POC (synthetic data only)."""

from __future__ import annotations

import re
from typing import Any


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


REFUSAL_PLANNING = (
    "I can explain sourced forecast trends, seasonality, data sufficiency, and demand profile "
    "labels, but I cannot recommend or make a forecast, inventory, replenishment, allocation, "
    "or commercial decision."
)

REFUSAL_MODEL = (
    "I cannot answer this from the configured Forecast Intelligence data. Model and training "
    "details are not available in this Genie space."
)


def answer(question: str, ctx: dict[str, Any] | None = None) -> str | None:
    """Return a canned answer, or None if no demo rule matches."""
    q = _norm(question)
    ctx = ctx or {}
    tab = str(ctx.get("tab", "midlevel"))

    if re.search(r"\b(override|increase|decrease|should we ).*forecast\b", q) or (
        "recommend" in q and "forecast" in q
    ):
        return REFUSAL_PLANNING

    if "which model" in q or "what model" in q:
        return REFUSAL_MODEL

    if "unconstrained" in q and ("supply" in q or "receipt" in q or "different" in q):
        return (
            "Unconstrained consumer demand is the demand-first signal AP forecasts before "
            "supply constraints. It is not receipts, inventory, or o9 supply logic. Receipts "
            "follow a separate planning path. Genie explains the forecasted demand signal; it "
            "does not recommend inventory or override actions."
        )

    if "nddc" in q and "nmp" in q and ("net demand" in q or "net sales" in q or "measure" in q):
        return (
            "Use net demand units for NDDC (Nike Direct Digital Commerce) on the direct basis. "
            "Use net sales units for Nike Marketplace Partners and store personas. For NMP "
            "wholesale, specify MCCF (gross-up) or POS (sharing panel); do not blend demand and "
            "sales in one total."
        )

    if "mccf" in q and ("nmp" in q or "marketplace" in q):
        return _nmp_running_answer(ctx)

    if "vomero" in q and "trend" in q:
        return _vomero_trend_answer(ctx)

    if "nike running" in q and "trend" in q:
        return _nmp_running_answer(ctx)

    if "554724" in q and ("season" in q or "seasonal" in q):
        if tab == "style_color" and "nddc" not in q and "net demand" not in q:
            return _seasonality_clarify()
        return _seasonality_answer()

    if "nddc" in q and "net demand" in q and ("554724" in q or "direct basis" in q):
        return _seasonality_answer()

    return None


def _seasonality_clarify() -> str:
    return (
        "Style-color seasonality is available for several channel and measure combinations. "
        "Which persona should I use?\n\n"
        "• NDDC: net demand units (direct basis)\n"
        "• NSO / NVS: net sales units\n"
        "• NMP: net sales units (MCCF or POS)\n\n"
        "Reply with NDDC net demand to continue."
    )


def _seasonality_answer() -> str:
    return (
        "Seasonality for style-color 554724-136, United States, NDDC, net demand units, "
        "season HO2026:\n\n"
        "November index 1.95; December index 2.05 (peak month in this slice). "
        "Status: reliable for this channel and measure.\n\n"
        "Filters: United States · NIKE DIRECT DIGITAL COMMERCE · NET_DEMAND_UNITS · "
        "DIRECT · HO2026.\n\n"
        "This describes pattern only; it does not recommend a forecast change."
    )


def _vomero_trend_answer(ctx: dict[str, Any]) -> str:
    _ = ctx
    return (
        "Weekly trend for Vomero, United States, NDDC, mid-level, net demand units, HO2026:\n\n"
        "Closed weeks show settled actuals through the latest actual week; forward weeks are "
        "forecast only. The line steps up into holiday weeks with no single-week collapse in "
        "the settled window.\n\n"
        "Filters: Vomero · United States · NIKE DIRECT DIGITAL COMMERCE · NET_DEMAND_UNITS · "
        "DIRECT · HO2026.\n\n"
        "I do not infer drivers (promo, inventory, weather) beyond this sourced slice."
    )


def _nmp_running_answer(ctx: dict[str, Any]) -> str:
    _ = ctx
    return (
        "Weekly trend for Nike Running, United States, Nike Marketplace Partners, mid-level, "
        "net sales units, MCCF gross-up, HO2026:\n\n"
        "Recent settled weeks run roughly 265K–320K units per week; forward weeks rise into "
        "November–December before tapering into January.\n\n"
        "Filters: Nike Running · United States · NIKE MARKETPLACE PARTNERS · NET_SALES_UNITS · "
        "MCCF · HO2026.\n\n"
        "On a live dashboard, you may apply the same filters to the Weekly Actuals chart when "
        "that action is offered."
    )


def self_check() -> None:
    assert answer("Should we increase the forecast for Nike Running next month?") == REFUSAL_PLANNING
    assert "December" in answer(
        "What seasonal pattern applies to style-color 554724-136 in the United States?",
    )
    assert "Which persona" in answer(
        "What seasonal pattern applies to style-color 554724-136 in the United States?",
        {"tab": "style_color"},
    )
    assert "December" in answer("NDDC net demand for 554724-136 seasonality", {"tab": "style_color"})


if __name__ == "__main__":
    self_check()
    print("demo_genie_responses: ok")