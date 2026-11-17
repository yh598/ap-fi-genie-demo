(() => {
  const HOST = "https://nike-sole-react.cloud.databricks.com";
  const DEFAULT_O = "554179923494093";
  const DEFAULT_DASHBOARD_ID = "01f1d86cbc521fdfb33ae73fdb97332e";
  const DEFAULT_GENIE_ROOM = "01f1bc4c14ea136abe0aa016aacf52fa";

  const HEX32 = /^[0-9a-f]{32}$/i;

  function lakeviewId(raw) {
    const v = (raw || "").trim();
    if (!v) return null;
    if (!HEX32.test(v)) return null;
    return v.toLowerCase();
  }

  const params = new URLSearchParams(window.location.search);
  const o = (params.get("o") || DEFAULT_O).trim();
  const dashboardId =
    lakeviewId(params.get("dashboard_id")) || DEFAULT_DASHBOARD_ID;
  const genieRoom =
    lakeviewId(params.get("genie_room")) || DEFAULT_GENIE_ROOM;
  const dashLabel =
    params.get("dash_label")?.trim() ||
    (dashboardId === DEFAULT_DASHBOARD_ID
      ? "FI dashboard v1.1 · North America (all channels)"
      : `Lakeview dashboard · ${dashboardId}`);

  const dashUrl = `${HOST}/dashboardsv3/${dashboardId}/published?o=${encodeURIComponent(o)}`;
  const genieUrl = `${HOST}/genie/rooms/${genieRoom}?o=${encodeURIComponent(o)}`;

  const dashOpen = document.getElementById("dash-open");
  const genieOpen = document.getElementById("genie-open");
  const dashFrame = document.getElementById("dash-frame");
  const genieFrame = document.getElementById("genie-frame");
  const dashMeta = document.getElementById("dash-meta");

  if (dashOpen) dashOpen.href = dashUrl;
  if (genieOpen) genieOpen.href = genieUrl;
  if (dashFrame) dashFrame.src = dashUrl;
  if (genieFrame) genieFrame.src = genieUrl;
  if (dashMeta) dashMeta.textContent = dashLabel;

  const hint = document.getElementById("param-hint");
  if (hint && window.location.search) {
    hint.textContent = `Overrides: dashboard_id=${dashboardId}, genie_room=${genieRoom}`;
  }
})();
