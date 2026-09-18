/* ================================================================
   SMART FILTER ENGINE v4
   
   10 filters, exact order matching original layout:
   Row 1: Source Market | Region | Class | Traveler Type | Age Group
   Row 2: Gender | Income | Children in HH | Marital Status | Trip Companion
   
   CASCADE RULES (top-to-bottom):
   1. Region → Source Market   : selecting region scopes country list
   2. Marital Status → Children: if ALL selected statuses have no partner
                                  (Single / Divorced / Separated / Widowed)
                                  → Children filter is HIDDEN entirely
                                  Otherwise → Children shown normally
   3. Class label is tab-aware : Airline tab → "Cabin class"
                                  Hotel tab  → "Hotel class"
                                  Other tabs → "Class"
   4. Income → Low/Medium/High : within-market tercile computed once on load
   ================================================================ */

/* ── Region → Market mapping ─────────────────────────────────── */
const REGION_MARKET_MAP = {
  "Europe":        ["France","Germany","Ireland","Italy","Netherlands",
                    "Russian Federation","Spain","Switzerland","United Kingdom"],
  "ME":            ["Bahrain","Jordan","Qatar","Saudi Arabia","Turkey",
                    "United Arab Emirates"],
  "Asia":          ["China","India","Indonesia","Japan",
                    "Korea, Republic of (South Korea)","Malaysia",
                    "Singapore","Thailand"],
  "Africa":        ["Egypt","Kenya","Nigeria","South Africa"],
  "North America": ["Canada","United States of America"],
  "Oceania":       ["Australia"],
  "LATAM":         ["Brazil"]
};

/* ── Marital statuses that mean "no partner" → hide Children ─── */
const NO_PARTNER = new Set([
  "Single, never married",
  "Divorced",
  "Separated",
  "Widowed"
]);

/* ── Income classification: computed once on DATA load ──────── */
let INCOME_MAP = {};   // record index → "Low" | "Medium" | "High"

/* WeakMap: record object → array index, for O(1) income lookup */
let RECORD_INDEX_MAP = null;

function buildIncomeMap(records) {
  /* Build index map first */
  RECORD_INDEX_MAP = new Map();
  records.forEach((r, i) => RECORD_INDEX_MAP.set(r, i));

  function extractNum(s) {
    s = String(s || "");
    const nums = (s.match(/[\d]+/g) || [])
      .map(Number).filter(n => n < 1e9);
    if (!nums.length) return null;
    if (/or more|above/i.test(s)) return Math.max(...nums) * 1.5;
    if (/less than/i.test(s))     return Math.min(...nums) * 0.5;
    return nums.reduce((a,b)=>a+b,0) / nums.length;
  }

  /* Group by market, sort by numeric value, assign tercile */
  const byMarket = {};
  records.forEach((r, idx) => {
    const v = extractNum(r.Income);
    if (v == null) return;
    (byMarket[r.Market] = byMarket[r.Market] || []).push({ v, idx });
  });

  Object.values(byMarket).forEach(arr => {
    arr.sort((a,b) => a.v - b.v);
    const nb = arr.length;
    arr.forEach(({ idx }, i) => {
      const p = i / nb;
      INCOME_MAP[idx] = p < 0.33 ? "Low" : p < 0.67 ? "Medium" : "High";
    });
  });
}

/* ── Cascade: should Children be visible? ─────────────────────── */
function shouldShowChildren() {
  const sel = filterSelections["Marital Status"] || [];
  /* No selection → show (we don't know marital status → safe to show) */
  if (!sel.length) return true;
  /* Show only if at least one selected status implies a partner */
  return sel.some(s => !NO_PARTNER.has(s));
}

/* ── Cascade: Source Market options scoped by Region ─────────── */
function marketOptions() {
  if (!DATA) return [];
  const allMarkets = DATA.filterOptions.Market || [];
  const selRegions = filterSelections["Region"] || [];
  if (!selRegions.length) return allMarkets;
  const allowed = new Set(selRegions.flatMap(r => REGION_MARKET_MAP[r] || []));
  return allMarkets.filter(m => allowed.has(m));
}

/* ── Class label by current tab ──────────────────────────────── */
function classLabel() {
  if (typeof currentTab === "undefined") return "Class";
  if (currentTab === "airline") return "Cabin class";
  if (currentTab === "hotel")   return "Hotel class";
  return "Class";
}

/* ── Class options (same values, tab doesn't change options) ─── */
function classOptions() {
  if (!DATA) return [];
  const field = (typeof currentTab !== "undefined" && currentTab === "hotel")
    ? "accommodation" : "cabinClass";
  return [...new Set(DATA.records.map(r => r[field]).filter(Boolean))].sort();
}

/* ── 10-filter config in screenshot order ────────────────────── */
const SMART_FILTER_CONFIG = [
  /* ── Row 1 ─────────────────────────────────────────────────── */

  {
    value:   "Region",
    label:   "Region",
    options: () => Object.keys(REGION_MARKET_MAP),
    default: []
  },

  {
    value:   "Market",
    label:   "Source Market",
    options: marketOptions,
    default: []
  },
  
  {
    value:   "Class",
    get label() { return classLabel(); },
    options: classOptions,
    default: []
  },
  {
    value:   "Trip Type",
    label:   "Traveler Type",
    options: () => ["LEISURE","BUSINESS","BLEISURE"],
    labels:  { LEISURE:"Leisure", BUSINESS:"Business", BLEISURE:"Bleisure" },
    default: []
  },
  {
    value:   "Age Group",
    label:   "Age Group",
    options: () => ["18-24","25-34","35-44","45-54","55-65","65+"],
    default: []
  },
  /* ── Row 2 ─────────────────────────────────────────────────── */
  {
    value:   "Gender",
    label:   "Gender",
    options: () => ["Male","Female","Prefer not to say"],
    default: []
  },
  {
    value:   "Income",
    label:   "Income",
    options: () => ["Low","Medium","High"],
    default: []
  },

  {
    value:   "Marital Status",
    label:   "Marital Status",
    options: () => [
      "Married","Living with partner","Single, never married",
      "Divorced","Separated","Widowed"
    ],
    default: []
  },
  
  {
    value:   "Children",
    label:   "Children in HH",
    options: () => shouldShowChildren() ? ["Yes","No"] : [],
    hidden:  () => !shouldShowChildren(),   /* drives CSS display */
    default: []
  },
  
  {
    value:   "Companion",
    label:   "Trip Companion",
    options: () => {
      if (!DATA) return [];
      return [...new Set(DATA.records.map(r => r.travelCompanions).filter(Boolean))].sort();
    },
    default: []
  }
];

/* ── Enforce cascades after any filter change ─────────────────── */
function enforceCascades() {
  /* Region → Market: remove markets not in selected regions */
  const selR = filterSelections["Region"] || [];
  if (selR.length) {
    const allowed = new Set(selR.flatMap(r => REGION_MARKET_MAP[r] || []));
    filterSelections["Market"] = (filterSelections["Market"] || []).filter(m => allowed.has(m));
  }
  /* Marital → Children: clear Children if now hidden */
  if (!shouldShowChildren()) {
    filterSelections["Children"] = [];
  }
}

/* ── Row matching (used by passesRecord) ──────────────────────── */
function smartMatch(r, dim, vals, recIdx) {
  if (!vals || !vals.length) return true;
  switch (dim) {
    case "Market":        return vals.includes(r.Market);
    case "Region":        return vals.includes(r.Region);
    case "Trip Type":     return vals.includes(r["Trip Type"]);
    case "Age Group": {
      const exp = vals.flatMap(v => v === "25\u201344" ? ["25-34","35-44"] : [v]);
      return exp.includes(r["Age Group"]);
    }
    case "Gender":        return vals.includes(r.Gender);
    case "Income": {
      /* If map not built yet, don't filter (safer than excluding everyone) */
      if (Object.keys(INCOME_MAP).length === 0) return true;
      const group = INCOME_MAP[recIdx];
      return group ? vals.includes(group) : true;
    }
    case "Children":      return vals.includes(r.Children);
    case "Marital Status":return vals.includes(r["Marital Status"]);
    case "Companion": {
      const v = r.travelCompanions;
      return Array.isArray(v) ? v.some(x => vals.includes(x)) : vals.includes(v);
    }
    case "Class": {
      const field = (typeof currentTab !== "undefined" && currentTab === "hotel")
        ? "accommodation" : "cabinClass";
      return vals.includes(r[field]);
    }
    default: return vals.includes(r[dim]);
  }
}

/* ── Override passesRecord from app-final.js ─────────────────── */
function passesRecord(r, skipDim) {
  if (typeof ignoreDashboardFilters !== "undefined" && ignoreDashboardFilters) return true;
  /* Use pre-built index map instead of O(n) indexOf */
  const idx = (typeof RECORD_INDEX_MAP !== "undefined" && RECORD_INDEX_MAP)
    ? RECORD_INDEX_MAP.get(r)
    : ((DATA && DATA.records) ? DATA.records.indexOf(r) : -1);
  for (const [dim, vals] of Object.entries(filterSelections)) {
    if (dim === skipDim || !vals || !vals.length) continue;
    if (!smartMatch(r, dim, vals, idx)) return false;
  }
  if (typeof chartFilters !== "undefined") {
    for (const [key, label] of Object.entries(chartFilters)) {
      if (typeof questionMatches === "function" && !questionMatches(r, key, label)) return false;
    }
  }
  return true;
}

/* ================================================================
   BUILD FILTER BAR
   5-column grid, 2 rows. Children cell is invisible (opacity 0,
   pointer-events none) when cascade hides it — keeps layout stable.
   ================================================================ */
function buildFilterControlsCascade() {
  const grid = d3.select("#filterGrid");
  grid.selectAll("*").remove();

  SMART_FILTER_CONFIG.forEach(cfg => {
    const isHidden = cfg.hidden ? cfg.hidden() : false;
    const opts     = cfg.options();

    /* Always clean stale selections */
    filterSelections[cfg.value] = (filterSelections[cfg.value] || [])
      .filter(v => opts.includes(v));

    const isCascaded = cfg.value === "Market"
      && (filterSelections["Region"] || []).length > 0;

    const root = grid.append("div")
      .attr("class", "filter-control")
      .style("visibility", isHidden ? "hidden" : null)
      .style("pointer-events", isHidden ? "none" : null);

    /* Label row */
    const labelSpan = root.append("span").attr("class", "filter-label");
    labelSpan.text(cfg.label);
    if (isCascaded) {
      labelSpan.append("span")
        .style("color","var(--orange)")
        .style("margin-left","3px")
        .style("font-size","7px")
        .text("↳");
    }

    /* Dropdown button */
    root.append("button")
      .attr("type","button")
      .attr("class","multi-select")
      .attr("aria-haspopup","listbox")
      .attr("aria-expanded","false")
      .attr("data-filter", cfg.value)
      .text(fmtSelection(filterSelections[cfg.value], cfg));

    /* Menu container */
    root.append("div")
      .attr("class","multi-menu")
      .attr("data-menu", cfg.value)
      .attr("role","listbox")
      .attr("aria-multiselectable","true");

    root.append("div").attr("class","filter-selection-count");
    renderSmartMenu(cfg.value);
  });

  /* Open/close handlers */
  d3.selectAll(".multi-select").on("click", function(e) {
    e.stopPropagation();
    const menu = d3.select(this.parentNode).select(".multi-menu");
    const open = !menu.classed("open");
    d3.selectAll(".multi-menu").classed("open", false);
    d3.selectAll(".multi-select").classed("open", false).attr("aria-expanded","false");
    menu.classed("open", open);
    d3.select(this).classed("open", open).attr("aria-expanded", String(open));
  });
  d3.selectAll(".multi-menu").on("click", e => e.stopPropagation());
  updateFilterSummaries();
}

function fmtSelection(vals, cfg) {
  if (!vals || !vals.length) return "All";
  const lbl = v => (cfg.labels && cfg.labels[v]) ? cfg.labels[v] : v;
  if (vals.length === 1) return lbl(vals[0]);
  if (vals.length === 2) return vals.map(lbl).join(", ");
  return `${vals.length} selected`;
}

function renderSmartMenu(dim) {
  const cfg = SMART_FILTER_CONFIG.find(f => f.value === dim);
  if (!cfg) return;
  const opts     = cfg.options();
  const selected = filterSelections[dim] || [];
  const menu     = d3.select(`.multi-menu[data-menu="${CSS.escape(dim)}"]`);
  if (menu.empty()) return;

  menu.selectAll("label")
    .data(["__ALL__", ...opts])
    .join("label")
    .attr("class", d => `multi-option${d === "__ALL__" ? " all" : ""}`)
    .html("")
    .each(function(d) {
      const text    = d === "__ALL__" ? "All"
        : ((cfg.labels && cfg.labels[d]) ? cfg.labels[d] : d);
      const checked = d === "__ALL__" ? !selected.length : selected.includes(d);
      d3.select(this).append("input")
        .attr("type","checkbox").property("checked", checked)
        .attr("value", d).attr("aria-label", text);
      d3.select(this).append("span").text(text);
    });

  menu.selectAll("input").on("change", function(e) {
    e.stopPropagation();
    const val = this.value;
    if (val === "__ALL__") {
      filterSelections[dim] = [];
    } else {
      let next = [...(filterSelections[dim] || [])];
      this.checked ? (!next.includes(val) && next.push(val))
                   : (next = next.filter(v => v !== val));
      filterSelections[dim] = next;
    }
    enforceCascades();
    if (typeof filterDim     !== "undefined") filterDim     = dim;
    if (typeof activeSelections !== "undefined") activeSelections = [...(filterSelections[dim] || [])];
    if (typeof segment       !== "undefined") segment = typeof selectionLabel === "function"
      ? selectionLabel(activeSelections) : "All";

    buildFilterControlsCascade();
    updateFilterSummaries();
    if (typeof updateSegmentBase === "function") updateSegmentBase();
    if (typeof renderActive      === "function") renderActive();
  });
}

/* ── Safe updateFilterSummaries (no D3 datum dependency) ──────── */
function updateFilterSummaries() {
  d3.selectAll(".multi-select").each(function() {
    const dim = d3.select(this).attr("data-filter");
    if (!dim) return;
    const cfg  = SMART_FILTER_CONFIG.find(f => f.value === dim);
    const vals = filterSelections[dim] || [];
    d3.select(this).text(fmtSelection(vals, cfg || {}));
  });
  d3.selectAll(".filter-control").each(function() {
    const btn = d3.select(this).select(".multi-select");
    const dim = btn.attr("data-filter");
    if (!dim) return;
    const vals = filterSelections[dim] || [];
    d3.select(this).select(".filter-selection-count")
      .text(vals.length > 1 ? `${vals.length} selected` : "");
  });
}

/* ── CSS: 5-column grid, stable Children placeholder ─────────── */
(function injectStyles() {
  const s = document.createElement("style");
  s.textContent = `
    /* Smart filter bar — 5+5 grid exactly matching screenshot */
    #filterGrid {
      display: grid !important;
      grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
      gap: 4px 7px !important;
      flex: 1 1 auto !important;
      min-width: 0 !important;
      align-items: end;
    }
    .filter-control {
      position: relative;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .filter-label {
      display: block;
      font-size: 7.5px;
      color: #8a7e98;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .05em;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .multi-select {
      width: 100% !important;
      min-height: 28px;
      font-size: 9.5px;
      padding: 0 8px;
      border-radius: 4px;
      border: 1px solid #d4cce8;
      background: #f7f4fc;
      color: #452080;
      cursor: pointer;
      text-align: left;
    }
    .multi-select:hover { border-color: #9b8dc1; }
    .multi-select.open  { border-color: #452080; background: #fff; }
    .filter-selection-count { font-size: 7px; color: #9b8dc1; margin-top: 2px; min-height: 9px; }
    .filter-control:has(.multi-menu.open) { z-index: 60; }
    @media (max-width: 650px) {
      #filterGrid {
        grid-template-columns: minmax(0, 1fr) !important;
        width: 100%;
        flex-basis: 100%;
      }
      .multi-menu { max-width: calc(100vw - 24px); }
    }
  `;
  document.head && document.head.appendChild(s);
})();

/* ================================================================
   RE-INIT — runs after app-final.js, takes over filter system
   ================================================================ */
(function smartInit() {
  FILTER_CONFIG = SMART_FILTER_CONFIG;

  function boot() {
    /* Build income map once */
    if (DATA && DATA.records) buildIncomeMap(DATA.records);

    /* Ensure every new filter key has an entry */
    SMART_FILTER_CONFIG.forEach(cfg => {
      if (!filterSelections[cfg.value]) filterSelections[cfg.value] = [];
    });

    buildFilterControlsCascade();
    if (typeof updateSegmentBase === "function") updateSegmentBase();
    if (typeof renderActive      === "function") renderActive();
  }

  if (typeof DATA !== "undefined" && DATA) {
    boot();
  } else {
    /* DATA not yet loaded — patch window.init */
    const _orig = typeof init !== "undefined" ? init : null;
    if (_orig) {
      window.init = function() {
        _orig();
        FILTER_CONFIG = SMART_FILTER_CONFIG;
        boot();
      };
    }
  }
})();
