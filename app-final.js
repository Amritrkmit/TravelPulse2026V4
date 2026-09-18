
/* ---------- authentication ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("travelPulseAuth");
      window.location.replace("login.html");
    });
  }
});

const palette=["#452080","#ff7f2a","#4eae68","#ffb21a","#9b8dc1","#ef476f","#6f5a9e"];
const fmt=d3.format(".0%");
const clean=s=>String(s??"").replace(/â€“/g,"–").replace(/â€”/g,"—").replace(/â€™/g,"’").replace(/\s+/g," ").trim();
const REGIONS=["Asia","Europe","LATAM","ME","North America","Oceania","Africa"];
const REGION_SHORT={"North America":"N. America"};
const shortRegion=r=>REGION_SHORT[r]||r;
const MARKET_ALIASES={
  "Russia":"Russian Federation",
  "South Korea":"Korea, Republic of (South Korea)",
  "UAE":"United Arab Emirates",
  "UK":"United Kingdom",
  "USA":"United States of America",
  "United States":"United States of America"
};
const MARKET_REGIONS={
  "Australia":"Oceania","Bahrain":"ME","Brazil":"LATAM","Canada":"North America",
  "China":"Asia","Egypt":"Africa","France":"Europe","Germany":"Europe",
  "India":"Asia","Indonesia":"Asia","Ireland":"Europe","Italy":"Europe",
  "Japan":"Asia","Jordan":"ME","Kenya":"Africa","Korea, Republic of (South Korea)":"Asia",
  "Malaysia":"Asia","Netherlands":"Europe","Nigeria":"Africa","Qatar":"ME",
  "Russian Federation":"Europe","Saudi Arabia":"ME","Singapore":"Asia","South Africa":"Africa",
  "Spain":"Europe","Switzerland":"Europe","Thailand":"Asia","Turkey":"ME",
  "United Arab Emirates":"ME","United Kingdom":"Europe","United States of America":"North America"
};
const normalizeRecord=r=>{
  const market=MARKET_ALIASES[clean(r.Market)]||clean(r.Market);
  const hotelBrand=clean(r.hotelBrand||r.Q21).replace(/<[^>]*>/g,"").trim();
  return {
    ...r,
    Market:market,
    Region:clean(r.Region)||MARKET_REGIONS[market]||"",
    hotelBrand,
    Q21:clean(r.Q21||hotelBrand).replace(/<[^>]*>/g,"").trim()
  };
};
const AGES=["18-24","25-34","35-44","45-54","55-65","65+"];
const MARKETS=["Australia","Bahrain","Brazil","Canada","China","Egypt","France","Germany","India","Indonesia","Italy","Japan","Jordan","Kenya","Malaysia","Netherlands","Nigeria","Qatar","Russian Federation","Saudi Arabia","Singapore","Korea, Republic of (South Korea)","Spain","Switzerland","Thailand","Turkey","United Arab Emirates","United Kingdom","United States of America","South Africa","Ireland"];
const DEMOGRAPHICS=["18-24","25-34","35-44","45-54","55-65","65+","Male","Female","Prefer not to say","Single, never married","Living with partner","Married","Separated","Divorced","Widowed","Yes","No","Low","Medium","High","Business owner","C-level executive","Business unit head / Senior management","Middle management","Junior management or entry level executive"];
const TRIP_TYPES=["LEISURE","BUSINESS","BLEISURE"];
let FILTER_CONFIG=[
  {value:"Market",label:"Source Market",options:()=>MARKETS,default:[]},
  {value:"Region",label:"Region",options:()=>REGIONS,default:[]},
  {value:"Class",label:"Class",options:()=>{const key=currentTab==="hotel"?"accommodation":"cabinClass";return [...new Set((DATA?.records||[]).map(r=>clean(r[key])).filter(Boolean))].sort();},default:[]},
  {value:"Trip Type",label:"Traveler Type",options:()=>TRIP_TYPES,default:[]},
  {value:"Age Group",label:"Age Group",options:()=>["18-24","25-34","35-44","45-54","55-65","65+","25–44"],default:[]},
  {value:"Gender",label:"Gender",options:()=>["Male","Female","Prefer not to say"],default:[]},
  {value:"Income",label:"Income",options:()=>["Low","Medium","High"],default:[]},
  {value:"Children",label:"Children in HH",options:()=>["Yes","No"],default:[]},
  {value:"Marital Status",label:"Marital Status",options:()=>["Single, never married","Living with partner","Married","Separated","Divorced","Widowed"],default:[]},
  {value:"Companion",label:"Trip Companion",options:()=>[...(DATA?.questions?.travelCompanions?.data||[]).map(d=>clean(d.label))],default:[]}
];
let DATA, segment="All", currentTab="overview", filterDim="Market", activeSelections=[];
let currentJourneyStage="Plan";
const filterSelections={};
const tooltip=d3.select("#tooltip");
let WORLD=null;
let worldPromise=null;
const MARKET_COORDS={
  "Australia":[134,-25],"Bahrain":[50.5,26],"Brazil":[-51,-10],"Canada":[-106,57],"China":[103,35],"Egypt":[30,27],"France":[2,46],"Germany":[10,51],"India":[79,22],"Indonesia":[118,-2],"Italy":[12,42],"Japan":[138,37],"Jordan":[36,31],"Kenya":[37,-0.2],"Malaysia":[102,4],"Netherlands":[5.3,52.2],"Nigeria":[8,9],"Qatar":[51.2,25.3],"Russian Federation":[90,61],"Saudi Arabia":[45,24],"Singapore":[103.8,1.35],"Korea, Republic of (South Korea)":[127.8,36],"Spain":[-3.5,40],"Switzerland":[8.2,46.8],"Thailand":[101,15],"Turkey":[35,39],"United Arab Emirates":[54,24],"United Kingdom":[-2,54],"United States of America":[-100,39],"South Africa":[24,-29],"Ireland":[-8,53]
};
const METRIC_CFG={
    airlineNPS:{ label:"Airline NPS",  min:-20, max:100, fmt:v=>`${v.toFixed(0)} NPS`,
                  c0:"#E24B4A", c50:"#f5c842", c100:"#1D9E75", midpoint:0 },
    hotelNPS:  { label:"Hotel NPS",    min:-20, max:100, fmt:v=>`${v.toFixed(0)} NPS`,
                  c0:"#E24B4A", c50:"#f5c842", c100:"#1D9E75", midpoint:0 },
    spendInc:  { label:"Spend increase %", min:30, max:100, fmt:v=>`${v.toFixed(0)}%`,
                  c0:"#ddd8f0", c100:"#452080" },
    aiAdopt:   { label:"AI adoption %",    min:30, max:100, fmt:v=>`${v.toFixed(0)}%`,
                  c0:"#d5f0ee", c100:"#12a594" },
    booked:    { label:"Already booked %", min:0,  max:35,  fmt:v=>`${v.toFixed(0)}%`,
                  c0:"#fff3e0", c100:"#ff7f2a" },
    business:  { label:"Business travellers %", min:0, max:70, fmt:v=>`${v.toFixed(0)}%`,
                  c0:"#e8f4ff", c100:"#185FA5" },
    premium:   { label:"Premium cabin %",  min:0,  max:75, fmt:v=>`${v.toFixed(0)}%`,
                  c0:"#f5e8ff", c100:"#7B2FBE" },
    respondents:{ label:"Respondents",    min:0,  max:110, fmt:v=>`${Math.round(v)} respondents`,
                  c0:"#ddd8f0", c100:"#452080" }
  };

worldPromise=fetch("world.geojson").then(r=>r.ok?r.json():null).catch(()=>null);
Promise.all(["data.json","social-data.json"].map(file=>fetch(file,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`${file} HTTP ${r.status}`);return r.json();}))).then(([d,socialRecords])=>{
  DATA={...d,socialRecords:Array.isArray(socialRecords)?socialRecords:(socialRecords?.records||[]),records:(d.records||[]).map(normalizeRecord)};
  DATA.meta={...(d.meta||{}),totalRespondents:DATA.records.length};
  d3.select("#baseN").text(`n = ${DATA.records.length.toLocaleString()}`);
  init();
  /* Render the dashboard immediately; the map can arrive a moment later. */
  renderActive();
  worldPromise.then(w=>{
    WORLD=w;
    renderActive();
  });
}).catch(err=>{console.error(err); const el=document.querySelector("main"); if(el) el.insertAdjacentHTML("afterbegin",`<div class="insight-banner" style="margin:20px"><span class="insight-tag">DATA ERROR</span><span>Could not load data.json. Please run the dashboard through a local HTTP server.</span></div>`);});

/* ---------- setup / filters ---------- */
function questionLabels(key){return (DATA?.questions?.[key]?.data||[]).map(d=>clean(d.label));}
function filterOptions(cfg){return cfg.options().filter(Boolean);}
function filterDisplayLabel(cfg){
  if(cfg.value==="Class") return currentTab==="airline"?"Airline Class":currentTab==="hotel"?"Hotel Class":"Class";
  return cfg.label;
}
function activeConfig(){return FILTER_CONFIG.find(f=>f.value===filterDim)||FILTER_CONFIG[0];}
function selectionLabel(values){
  if(!values||!values.length)return "All";
  if(values.length===1)return values[0];
  if(values.length===2)return values.join(", ");
  return `${values.length} selected`;
}
function initFilterState(){
  FILTER_CONFIG.forEach(cfg=>{filterSelections[cfg.value]=[...cfg.default].filter(v=>filterOptions(cfg).includes(v));});
}
function buildFilterControls(){
  const grid=d3.select("#filterGrid");
  grid.selectAll(".filter-control").remove();
  const controls=grid.selectAll(".filter-control").data(FILTER_CONFIG).join("div").attr("class","filter-control");
  controls.each(function(cfg){
    const valid=filterOptions(cfg);
    filterSelections[cfg.value]=(filterSelections[cfg.value]||[]).filter(v=>valid.includes(v));
    const root=d3.select(this);
    root.append("span").attr("class","filter-label").text(filterDisplayLabel(cfg));
    root.append("button").attr("type","button").attr("class","multi-select").attr("aria-haspopup","listbox").attr("aria-expanded","false").attr("data-filter",cfg.value).text(selectionLabel(filterSelections[cfg.value]));
    root.append("div").attr("class","multi-menu").attr("data-menu",cfg.value).attr("role","listbox").attr("aria-multiselectable","true");
    root.append("div").attr("class","filter-selection-count");
    renderFilterMenu(cfg.value);
  });
  d3.selectAll(".multi-select").on("click",function(e){
    e.stopPropagation();
    const root=d3.select(this.parentNode), menu=root.select(".multi-menu");
    const willOpen=!menu.classed("open");
    d3.selectAll(".multi-menu").classed("open",false);
    d3.selectAll(".multi-select").classed("open",false).attr("aria-expanded","false");
    menu.classed("open",willOpen); root.select(".multi-select").classed("open",willOpen).attr("aria-expanded",String(willOpen));
  });
  d3.selectAll(".multi-menu").on("click",e=>e.stopPropagation());
  updateFilterSummaries();
}
function renderFilterMenu(dim){
  const cfg=FILTER_CONFIG.find(f=>f.value===dim); if(!cfg)return;
  const opts=filterOptions(cfg), selected=filterSelections[dim]||[];
  const menu=d3.select(`.multi-menu[data-menu="${CSS.escape(dim)}"]`);
  if(menu.empty())return;
  const rows=["__ALL__",...opts];
  menu.selectAll("label").data(rows).join("label").attr("class",d=>`multi-option${d==="__ALL__"?" all":""}`).html("").each(function(d){
    const label=d==="__ALL__"?"All":d;
    const checked=d==="__ALL__"?selected.length===0:selected.includes(d);
    const row=d3.select(this);
    row.append("input").attr("type","checkbox").property("checked",checked).attr("value",d).attr("aria-label",label);
    row.append("span").text(label);
  });
  menu.selectAll("input").on("change",function(e){
    e.stopPropagation();
    const value=this.value;
    if(value==="__ALL__") filterSelections[dim]=[];
    else {
      let next=[...(filterSelections[dim]||[])];
      if(this.checked){ if(!next.includes(value))next.push(value); }
      else next=next.filter(v=>v!==value);
      filterSelections[dim]=next;
    }
    filterDim=dim;
    activeSelections=[...(filterSelections[dim]||[])];
    segment=selectionLabel(activeSelections);
    renderFilterMenu(dim); updateFilterSummaries(); updateSegmentBase(); renderActive();
  });
}
function updateFilterSummaries(){
  d3.selectAll(".filter-control").each(function(cfg){
    const vals=filterSelections[cfg.value]||[];
    d3.select(this).select(".multi-select").text(selectionLabel(vals));
    d3.select(this).select(".filter-selection-count").text(vals.length>1?`${vals.length} selected`:"");
  });
}
function closeMenus(){
  d3.selectAll(".multi-menu").classed("open",false);
  d3.selectAll(".multi-select").classed("open",false).attr("aria-expanded","false");
}
function setFilterDim(dim){
  filterDim=dim;
  const cfg=FILTER_CONFIG.find(f=>f.value===dim)||FILTER_CONFIG[0];
  const valid=filterOptions(cfg);
  filterSelections[dim]=(filterSelections[dim]||[]).filter(v=>valid.includes(v));
  activeSelections=[...(filterSelections[dim]||[])];
  segment=selectionLabel(activeSelections);
  updateFilterSummaries(); updateSegmentBase(); renderActive();
}
function resetFilters(){
  FILTER_CONFIG.forEach(cfg=>{filterSelections[cfg.value]=[...cfg.default].filter(v=>filterOptions(cfg).includes(v));});
  setFilterDim("Market");
  buildFilterControlsCascade();
}
function isDefaultFilter(){return filterSelections.Market?.length===0 && filterSelections.Region?.length===0;}
function init(){
  initFilterState();
  buildFilterControlsCascade();
  d3.select("#resetBtn").on("click",resetFilters);
  d3.select("#chipClear").on("click",resetFilters);
  d3.selectAll(".tab").on("click",function(){switchTab(d3.select(this).attr("data-tab"));});
  d3.select(document).on("click",closeMenus);
  setFilterDim("Market");
  addExportButtons();
  window.addEventListener("resize",debounce(renderActive,150));
}
function populateSegments(dim){setFilterDim(dim);}
function baseForSelection(key,sel){
  const base=DATA.questions[key]?.base||{};
  if(sel==="25–44") return (base["25-34"]||0)+(base["35-44"]||0);
  return base[sel]||0;
}
function valueForSelection(key,row,sel){
  if(sel==="25–44"){
    const a=+(row.values["25-34"]??0), b=+(row.values["35-44"]??0);
    const ba=DATA.questions[key]?.base?.["25-34"]||0, bb=DATA.questions[key]?.base?.["35-44"]||0;
    return ba+bb ? (a*ba+b*bb)/(ba+bb) : 0;
  }
  return +(row.values[sel]??0);
}
function segmentValue(row,key){
  /* Guard: if row has no .values (most questions in this dataset), return 0 */
  if(!row || !row.values) return 0;
  const selections=activeSelections.length?activeSelections:["Total"];
  if(selections.length===1 && (selections[0]==="All"||selections[0]==="Total")) return +(row.values.Total??0);
  const supported=selections.filter(sel=>sel==="25–44" || Object.prototype.hasOwnProperty.call(row.values,sel));
  if(!supported.length) return +(row.values.Total??0);
  const weighted=supported.map(sel=>({v:valueForSelection(key,row,sel),n:baseForSelection(key,sel)}));
  const totalN=weighted.reduce((a,b)=>a+b.n,0);
  return totalN ? weighted.reduce((a,b)=>a+b.v*b.n,0)/totalN : d3.mean(weighted,d=>d.v)||0;
}
function updateSegmentBase(){
  const n = activeRows().length;
  const label = selectionLabel(activeSelections);
  d3.select("#segmentBase").text(n ? `n = ${n.toLocaleString()} respondents${label&&label!=="All"?" · "+label:""}` : "");
  d3.select("#chipClear").attr("hidden",isDefaultFilter()?true:null);
}
function switchTab(name){
  currentTab=name;
  if(DATA){buildFilterControlsCascade();}
  d3.select("#filtersBar").classed("airline-filter-station",name==="airline").classed("pov-filter-station",name==="airline"||name==="hotel"||name==="destination");
  d3.select("body").classed("airline-active",name==="airline").classed("hotel-active",name==="hotel").classed("destination-active",name==="destination");
  d3.selectAll(".tab").classed("active",function(){return d3.select(this).attr("data-tab")===name;});
  d3.selectAll(".tab-panel").each(function(){
    const el=d3.select(this); el.attr("hidden", el.attr("data-panel")===name?null:true);
  });
  requestAnimationFrame(renderActive);
}
function renderActive(){
  if(!DATA)return;
  if(currentTab==="all") { renderAllQuestions(); return; }
  ({overview:renderOverview, behaviour:renderBehaviour, airline:renderAirline, hotel:renderHotel, market:renderMarket, destination:renderDestination})[currentTab]();
}

/* ---------- data helpers ---------- */
function q(key){return DATA.questions[key].data.map(d=>({label:clean(d.label),value:segmentValue(d,key)}));}
function specificQ(key,selected=[]){
  const rows=q(key);
  return selected.length ? rows.filter(d=>selected.includes(d.label)) : rows;
}
function byLabel(key,needle){return q(key).find(d=>d.label.toLowerCase().includes(needle.toLowerCase()))?.value||0;}
function topN(arr,n){return [...arr].sort((a,b)=>b.value-a.value).slice(0,n)}
function findRow(key,needle){return DATA.questions[key].data.find(r=>r.label.toLowerCase().includes(needle.toLowerCase()));}
function valueFor(key,needle,seg){const r=findRow(key,needle); return r? +(r.values[seg]??0):0;}
function baseFor(key,seg){return DATA.questions[key].base[seg]||0;}
function regionSpendIncrease(seg){return DATA.questions.spendChange.data.filter(r=>r.label.startsWith("Will increase")).reduce((a,r)=>a+(+(r.values[seg]??0)),0);}
function withSelection(sel,fn){const saved=activeSelections;activeSelections=sel;const result=fn();activeSelections=saved;return result;}
function spendIncreaseCurrent(){const raw=q("spendChange");return raw.filter(d=>d.label.startsWith("Will increase")).reduce((a,b)=>a+b.value,0);}

/* ---------- insight banners ---------- */
function renderOverviewInsight(){
  const research=byLabel("planningStage","researching destinations");
  const near=byLabel("tripTiming","1–3 months");
  const inc=spendIncreaseCurrent();
  const topPurpose=topN(q("tripPurpose"),1)[0];
  d3.select("#overviewInsight").html(`For <b>${selectionLabel(activeSelections)}</b>, ${fmt(research)} are still researching, ${fmt(near)} plan to travel within 1–3 months, and ${fmt(inc)} expect their travel spend to rise — <b>${topPurpose.label}</b> leads as the main trip purpose (${fmt(topPurpose.value)}).`);
}
function renderBehaviourInsight(){
  const topChannel=topN(q("infoChannels"),1)[0];
  const topExp=topN(q("experiences"),1)[0];
  const aiTrust=byLabel("aiLikelihood","Top 2 Box");
  d3.select("#behaviourInsight").html(`<b>${topChannel.label}</b> is the top discovery channel (${fmt(topChannel.value)}), <b>${topExp.label}</b> leads what travelers are seeking (${fmt(topExp.value)}), and ${fmt(aiTrust)} of ${selectionLabel(activeSelections)} would trust an AI trip assistant.`);
}
function renderAirlineInsight(){
  const topCarrier=topN(q("airlineCarrier"),1)[0];
  const nps=byLabel("airlineNPS","NPS Score");
  const topFactor=topN(q("airlineConsiderations"),1)[0];
  const word=nps>=50?"strong":nps>=0?"moderate":"weak";
  d3.select("#airlineInsight").html(`<b>${topCarrier.label}</b> leads carrier preference (${fmt(topCarrier.value)}) for ${selectionLabel(activeSelections)}. Airline NPS is ${word} at ${d3.format(".0f")(nps)}, and <b>${topFactor.label}</b> is the top factor when choosing an airline.`);
}
function renderHotelInsight(){
  const topStay=topN(q("accommodation"),1)[0];
  const nps=byLabel("hotelNPS","NPS Score");
  const topFactor=topN(q("hotelConsiderations"),1)[0];
  const word=nps>=50?"strong":nps>=0?"moderate":"weak";
  d3.select("#hotelInsight").html(`<b>${topStay.label}</b> is the preferred stay type (${fmt(topStay.value)}) for ${selectionLabel(activeSelections)}. Hotel NPS is ${word} at ${d3.format(".0f")(nps)}, and <b>${topFactor.label}</b> drives hotel choice most.`);
}
function renderMarketInsight(){
  const rows=contextRows("Market");
  const regionMetric=(region,key)=>metricFromRows(rows.filter(r=>r.Region===region),key);
  const bestAirline=topN(REGIONS.map(r=>({label:shortRegion(r),value:regionMetric(r,"airlineNPS")})).filter(d=>Number.isFinite(d.value)),1)[0]||{label:"—",value:0};
  const bestHotel=topN(REGIONS.map(r=>({label:shortRegion(r),value:regionMetric(r,"hotelNPS")})).filter(d=>Number.isFinite(d.value)),1)[0]||{label:"—",value:0};
  const bestAI=topN(REGIONS.map(r=>({label:shortRegion(r),value:metricFromRows(rows.filter(x=>x.Region===r),"aiLikelihood")})).filter(d=>Number.isFinite(d.value)),1)[0]||{label:"—",value:0};
  const n=rows.length;
  d3.select("#marketInsight").html(`Across the seven source regions, <b>${bestAirline.label}</b> has the highest airline NPS (${d3.format(".0f")(bestAirline.value)}), <b>${bestHotel.label}</b> leads hotel NPS (${d3.format(".0f")(bestHotel.value)}), and <b>${bestAI.label}</b> has the strongest AI-assistant trust (${fmt(bestAI.value)}). <span class="insight-context">Based on ${n.toLocaleString()} respondents matching the active filters.</span>`);
}

/* ---------- tab renderers ---------- */
function renderOverview(){
  renderGlobalMap("#overviewMap","source");
  renderMapInsight("#mapInsight","source");
  renderKpis();
  horizontalBars("#planningChart",q("planningStage"),{height:260,max:0.65});
  donut("#purposeChart",q("tripPurpose").filter(d=>d.value>0.001),"Trip mix");
  horizontalBars("#timingChart",q("tripTiming"),{height:250,max:0.65});
  spend();
  renderOverviewInsight();
  renderTabQuestionExplorer("overview");
}
/* ── Per-stage percentage labels (% of Q2 respondents) ───────── */
function stagePct(stageValues) {
  if(!DATA) return "";
  const rows=activeRows(), n=rows.length; if(!n) return "";
  const count=rows.filter(r=>stageValues.includes(clean(r["Q2"]||"").toLowerCase())).length;
  return fmt(count/n);
}

function renderJourneyFlow(){
  const rows=activeRows(), n=rows.length||1;

  const stageValue=row=>clean(row.planningStage||row.Q2||"").toLowerCase();
  const isInspire=row=>stageValue(row).includes("yet to start");
  const isPlan=row=>stageValue(row).includes("research")||stageValue(row).includes("planning my itinerary");
  const isBook=row=>stageValue(row).includes("arrangement")||stageValue(row).includes("booked");

  /* Compute % for each stage to display in the chevron sub-label */
  const inspirePct = n ? fmt(rows.filter(isInspire).length/n) : "";
  const planPct    = n ? fmt(rows.filter(isPlan).length/n) : "";
  const bookPct    = n ? fmt(rows.filter(isBook).length/n) : "";

  const stages=[
    {key:"Inspire",  label:"Inspire",  sub:"Not yet planning",  pct:inspirePct, tone:"purple"},
    {key:"Plan",     label:"Plan",     sub:"Researching or itinerary", pct:planPct, tone:"gray"},
    {key:"Book",     label:"Book",     sub:"Arranging or booked",  pct:bookPct,    tone:"blue"},
    {key:"On-Trip",  label:"On-Trip",  sub:"Experience",   pct:"",         tone:"light"}
  ];

  const root=d3.select("#journeyFlow");
  if(root.empty()) return;
  root.selectAll("*").remove();

  root.selectAll(".journey-step").data(stages).join("button")
    .attr("class",d=>`journey-step ${d.tone}${d.key===currentJourneyStage?" active":""}`)
    .attr("type","button")
    .html(d=>`
      <span class="journey-step-label">${d.label}</span>
      <span class="journey-meta">${d.sub}</span>
      ${d.pct?`<span class="journey-pct">${d.pct}</span>`:""}
    `)
    .on("click",(_,d)=>{
      currentJourneyStage=d.key;
      renderJourneyFlow();
      showJourneyStagePanel(d.key);
      renderJourneyStageCharts(d.key);
      renderBehaviourMap();
    });

  /* Show/hide stage panels */
  showJourneyStagePanel(currentJourneyStage);
}

function showJourneyStagePanel(stageKey) {
  const panelMap={
    "Inspire":"stageInspire",
    "Plan":"stagePlan",
    "Book":"stageBook",
    "On-Trip":"stageOnTrip"
  };
  Object.values(panelMap).forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.hidden=true;
  });
  const active=document.getElementById(panelMap[stageKey]);
  if(active) active.hidden=false;
}

function renderJourneyStageCharts(stageKey) {
  const fmt2=d3.format(".0%");
  const stageValue=row=>clean(row.planningStage||row.Q2||"").toLowerCase();
  const isInspire=row=>stageValue(row).includes("yet to start");
  const isPlan=row=>stageValue(row).includes("research")||stageValue(row).includes("planning my itinerary");
  const isBook=row=>stageValue(row).includes("arrangement")||stageValue(row).includes("booked");

  if(stageKey==="Inspire") {
    /* KPIs */
    const topDest=topN(q("Q3")||q("decisionFactors"),1)[0];
    const topCh=topN(q("infoChannels"),1)[0];
    const topExp=topN(q("experiences"),1)[0];
    const rows=activeRows(), n=rows.length||1;
    const inspirePct=fmt(rows.filter(isInspire).length/n);
    d3.select("#skpiDestCount").text(topDest?topDest.label:"—");
    d3.select("#skpiTopChannel").text(topCh?topCh.label:"—");
    d3.select("#skpiTopExp").text(topExp?topExp.label:"—");
    d3.select("#skpiInspirePct").text(inspirePct||"—");
    /* Charts */
    if(typeof renderDestinationFunnel === "function") renderDestinationFunnel("#inspireDestChart");
    else horizontalBars("#inspireDestChart",q("decisionFactors"),{height:300,max:0.8});
    donut("#inspirePurposeChart",q("tripPurpose").filter(d=>d.value>0.001),"Trip mix");
    horizontalBars("#infoChart",q("infoChannels"),{height:280,max:0.75});
    horizontalBars("#experienceChart",q("experiences"),{height:300,max:0.6});
  }

  if(stageKey==="Plan") {
    const topDriver=topN(q("decisionFactors"),1)[0];
    const timing=byLabel("tripTiming","1–3 months");
    const rows=activeRows(), n=rows.length||1;
    const planPct=fmt(rows.filter(isPlan).length/n);
    d3.select("#skpiPlanPct").text(planPct||"—");
    d3.select("#skpiBookingWindow").text(topN(q("planningLeadTime"),1)[0]?.label||"—");
    d3.select("#skpiTravelTiming").text(fmt(timing));
    d3.select("#skpiTopDriver").text(topDriver?topDriver.label:"—");
    /* Charts */
    horizontalBars("#stagePlan #planningChart",q("planningStage"),{height:260,max:0.65});
    const pi=d3.select("#planningInsight");
    if(!pi.empty()) pi.text(`${fmt(byLabel("planningStage","researching"))} researching · ${fmt(byLabel("planningStage","already booked"))} booked`);
    horizontalBars("#stagePlan #timingChart",q("tripTiming"),{height:250,max:0.65});
    horizontalBars("#decisionChart",q("decisionFactors"),{height:300,max:0.8});
    horizontalBars("#leadTimeChart",q("planningLeadTime"),{height:270,max:0.55});
    donut("#companionChart",specificQ("travelCompanions",filterDim==="Companion"?activeSelections:[]).filter(d=>d.value>0.001),"Travel party",filterDim==="Companion"?activeSelections:[]);
    horizontalBars("#tripNightsChart",q("tripNights")||q("Q4")||[],{height:230});
  }

  if(stageKey==="Book") {
    const topBookCh=topN(q("bookingChannels"),1)[0];
    const packageData=q("packageType");
    const packageRows=packageData.length?packageData:q("Q8b");
    const topPkg=topN(packageRows,1)[0];
    const spendInc=spendIncreaseCurrent();
    const rows=activeRows(), n=rows.length||1;
    const bookPct=fmt(rows.filter(isBook).length/n);
    d3.select("#skpiBookPct").text(bookPct||"—");
    d3.select("#skpiSpendInc").text(fmt(spendInc));
    d3.select("#skpiTopBookCh").text(topBookCh?topBookCh.label:"—");
    d3.select("#skpiPkgType").text(topPkg?topPkg.label:"—");
    /* Charts */
    horizontalBars("#bookingChart",q("bookingChannels"),{height:270,max:0.75});
    donut("#packageTypeChart",packageRows,"Package",[]); 
    spend("#stageBook #spendChart");
    if(typeof renderBookingSequence==="function") renderBookingSequence("#bookingSeqChart");
    else horizontalBars("#bookingSeqChart",q("Q8a"),{height:260});
    if(typeof renderSpendIncrease==="function") renderSpendIncrease("#spendIncreaseChart");
    else horizontalBars("#spendIncreaseChart",q("Q11a"),{height:280,max:0.7});
    if(typeof renderSpendDecrease==="function") renderSpendDecrease("#spendDecreaseChart");
    else horizontalBars("#spendDecreaseChart",q("Q11"),{height:250,max:0.7});
  }

  if(stageKey==="On-Trip") {
    const aiAdopt=byLabel("aiLikelihood","Top 2 Box");
    const activityData=q("destActivities");
    const activityRows=activityData.length?activityData:q("Q9a");
    const nightsData=q("tripNights");
    const nightsRows=nightsData.length?nightsData:q("Q4");
    const topActivity=topN(activityRows,1)[0];
    const topNights=topN(nightsRows,1)[0];
    const topAiTask=topN(q("aiTasks"),1)[0];
    d3.select("#skpiAiAdopt").text(fmt(aiAdopt));
    d3.select("#skpiTopActivity").text(topActivity?topActivity.label:"—");
    d3.select("#skpiAvgNights").text(topNights?topNights.label:"—");
    d3.select("#skpiTopAiTask").text(topAiTask?topAiTask.label:"—");
    /* Charts */
    horizontalBars("#destExpChart",activityRows.length?activityRows:q("experiences"),{height:300,max:0.75});
    gauge("#aiGauge",aiAdopt,{domain:[0,1],format:fmt,label:"Top-2-box likely",sub:`${selectionLabel(activeSelections)} · to use an AI trip assistant`,color:"#12a594"});
    horizontalBars("#aiTasksChart",q("aiTasks"),{height:300,max:0.7});
    donut("#companionOnTripChart",specificQ("travelCompanions",[]).filter(d=>d.value>0.001),"Travel party",[]);
  }
}

function renderBehaviour(){
  renderBehaviourMap();
  renderJourneyFlow();
  renderJourneyStageCharts(currentJourneyStage);
  renderBehaviourInsight();
  renderTabQuestionExplorer("behaviour");
}

function renderBehaviourMap(){
  const title=d3.select("#behaviourMapTitle");
  if(!title.empty()) title.text(`Filtered respondents · ${currentJourneyStage} stage`);
  renderGlobalMap("#behaviourMap","source",undefined,r=>journeyStageMatches(r,currentJourneyStage));
  renderMapInsight("#behaviourMapInsight","source");
}

function journeyStageMatches(row,stage){
  const value=clean(row?.planningStage).toLowerCase();
  if(stage==="Inspire") return value.includes("yet to start");
  if(stage==="Plan") return value.includes("research")||value.includes("planning my itinerary");
  if(stage==="Book") return value.includes("book")||value.includes("arrangement");
  return value.includes("book")||value.includes("arrangement")||value.includes("paid");
}
function renderAirline(){
  renderGlobalMap("#airlineMap","airline");
  renderMapInsight("#airlineMapInsight","airline");
  horizontalBars("#carrierChart",q("airlineCarrier"),{height:290,max:0.15});
  const nps=byLabel("airlineNPS","NPS Score");
  gauge("#airlineNpsGauge",nps,{domain:[-100,100],format:d3.format(".0f"),label:"NPS",sub:`${selectionLabel(activeSelections)} airline recommend score`,color:npsColor(nps)});
  horizontalBars("#airlineConsiderChart",q("airlineConsiderations"),{height:300,max:0.45});
  donut("#cabinChart",specificQ("cabinClass",filterDim==="Class"&&currentTab==="airline"?activeSelections:[]),"Cabin",filterDim==="Class"&&currentTab==="airline"?activeSelections:[]);
  donut("#airlineLoyaltyChart",q("airlineLoyaltyImportance").filter(d=>!d.label.startsWith("NET")),"Importance");
  horizontalBars("#airlineStrategyChart",q("airlineStrategies"),{height:300,max:0.75});
  renderAirlineInsight();
  renderTabQuestionExplorer("airline");
}
function renderHotel(){
  renderGlobalMap("#hotelMap","hotel");
  renderMapInsight("#hotelMapInsight","hotel");
  horizontalBars("#stayChart",specificQ("accommodation",filterDim==="Class"&&currentTab==="hotel"?activeSelections:[]),{height:275,max:0.8,selected:filterDim==="Class"&&currentTab==="hotel"?activeSelections:[]});
  const nps=byLabel("hotelNPS","NPS Score");
  gauge("#hotelNpsGauge",nps,{domain:[-100,100],format:d3.format(".0f"),label:"NPS",sub:`${selectionLabel(activeSelections)} hotel recommend score`,color:npsColor(nps)});
  horizontalBars("#hotelConsiderChart",q("hotelConsiderations"),{height:300,max:0.45});
  donut("#hotelLoyaltyChart",q("hotelLoyaltyImportance").filter(d=>!d.label.startsWith("NET")),"Importance");
  horizontalBars("#hotelStrategyChart",q("hotelStrategies"),{height:300,max:0.7});
  horizontalBars("#hotelFeaturesChart",q("hotelLoyaltyFeatures"),{height:270,max:0.75});
  if(DATA.questions.hotelBrand){
    horizontalBars("#hotelBrandChart",q("hotelBrand"),{height:Math.max(320,q("hotelBrand").length*28+55)});
  }
  renderHotelInsight();
  renderTabQuestionExplorer("hotel");
}
function metricFromRows(rows,key){
  if(!rows.length) return 0;
  if(key==="airlineNPS"||key==="hotelNPS") {
    const vals=rows.map(r=>Number(r[key])).filter(Number.isFinite);
    return vals.length?vals.reduce((sum,v)=>sum+(v>=9?1:v<=6?-1:0),0)/vals.length*100:0;
  }
  if(key==="aiLikelihood") return rows.filter(r=>["Extremely likely","Somewhat likely"].includes(clean(r[key]))).length/rows.length;
  if(key==="planningStage") return rows.filter(r=>clean(r[key]).toLowerCase().includes("research")).length/rows.length;
  if(key==="spendChange") return rows.filter(r=>String(r[key]||"").startsWith("Will increase")).length/rows.length;
  return 0;
}
function regionalRows(region){
  return contextRows("Market").filter(r=>r.Region===region);
}
function marketRows(market){
  return contextRows("Market").filter(r=>r.Market===market);
}
function renderMarket(){
  renderMarketProfile();
  renderMarketBenchmark();
  renderGlobalMap("#marketMap","source");
  renderMapInsight("#marketMapInsight","source");
  const points=REGIONS.map(r=>({
    label:shortRegion(r),
    x:metricFromRows(regionalRows(r),"airlineNPS"),
    y:metricFromRows(regionalRows(r),"hotelNPS"),
    r:regionalRows(r).length
  })).filter(d=>d.r>0);
  scatter("#regionScatter",points,{xLabel:"Airline NPS",yLabel:"Hotel NPS",xFormat:d3.format(".0f"),yFormat:d3.format(".0f"),focus:null});

  const spendData=REGIONS.map(r=>({label:shortRegion(r),value:metricFromRows(regionalRows(r),"spendChange")})).filter(d=>d.value>0);
  verticalBars("#regionSpendBar",spendData,{max:Math.max(.1,d3.max(spendData,d=>d.value)||0)*1.15});

  // True respondent intersection: age × every active filter, not a weighted marginal average.
  const ageContext=contextRows("Age Group");
  const ageData=AGES.map(a=>({
    label:a,
    value:ageContext.filter(r=>r["Age Group"]===a && ["Extremely likely","Somewhat likely"].includes(clean(r.aiLikelihood))).length /
      Math.max(1,ageContext.filter(r=>r["Age Group"]===a).length)
  })).filter(d=>d.value>0 || ageContext.some(r=>r["Age Group"]===d.label));
  horizontalBars("#ageLine",ageData,{height:Math.max(280,ageData.length*42+55)});

  const researchData=REGIONS.map(r=>({label:shortRegion(r),value:metricFromRows(regionalRows(r),"planningStage")})).filter(d=>d.value>0);
  verticalBars("#regionResearchBar",researchData,{max:Math.max(.1,d3.max(researchData,d=>d.value)||0)*1.15});

  renderMarketInsight();
  renderRadar();
}

function renderMarketBenchmark(){
  const root=d3.select("#marketBenchmarkChart");
  if(root.empty())return;
  const globalRows=contextRows("Market");
  const market=selectedMarket();
  const selectedRows=market==="All"?globalRows:marketRows(market);
  const rate=(rows,predicate)=>rows.length?rows.filter(predicate).length/rows.length:0;
  const metrics=[
    ["AI assistant trust",r=>["Extremely likely","Somewhat likely"].includes(clean(r.aiLikelihood))],
    ["Spend expected to rise",r=>/^Will increase/i.test(clean(r.spendChange))],
    ["Still researching",r=>clean(r.planningStage).toLowerCase().includes("research")],
    ["Premium cabin intent",r=>["Premium economy","Business class","First class"].includes(clean(r.cabinClass))],
    ["Business travellers",r=>clean(r["Trip Type"])==="BUSINESS"]
  ].map(([label,predicate])=>({label,selected:rate(selectedRows,predicate),global:rate(globalRows,predicate)}));
  const el=root.node();
  const width=Math.max(500,el.clientWidth||700),height=230;
  root.selectAll("*").remove();
  const margin={top:25,right:58,bottom:24,left:150},innerWidth=width-margin.left-margin.right,innerHeight=height-margin.top-margin.bottom;
  const svg=root.append("svg").attr("width",width).attr("height",height);
  const x=d3.scaleLinear().domain([0,1]).range([0,innerWidth]);
  const y=d3.scaleBand().domain(metrics.map(d=>d.label)).range([0,innerHeight]).padding(.35);
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);
  g.append("g").attr("class","gridline").call(d3.axisBottom(x).ticks(5).tickSize(innerHeight).tickFormat("")).selectAll("line").attr("transform",`translate(0,${-innerHeight})`);
  g.selectAll(".global-bar").data(metrics).join("rect").attr("class","global-bar").attr("x",0).attr("y",d=>y(d.label)+y.bandwidth()*.1).attr("height",y.bandwidth()*.35).attr("width",d=>x(d.global)).attr("fill","#c9c0da").attr("rx",3);
  g.selectAll(".selected-bar").data(metrics).join("rect").attr("class","selected-bar").attr("x",0).attr("y",d=>y(d.label)+y.bandwidth()*.55).attr("height",y.bandwidth()*.35).attr("width",d=>x(d.selected)).attr("fill","#452080").attr("rx",3);
  g.append("g").attr("class","axis").call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();
  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(5).tickFormat(fmt));
  g.selectAll(".global-value").data(metrics).join("text").attr("class","global-value").attr("x",d=>Math.min(innerWidth+3,x(d.global)+5)).attr("y",d=>y(d.label)+y.bandwidth()*.36).attr("font-size",9).attr("fill","#7d728d").text(d=>fmt(d.global));
  g.selectAll(".selected-value").data(metrics).join("text").attr("class","selected-value").attr("x",d=>Math.min(innerWidth+3,x(d.selected)+5)).attr("y",d=>y(d.label)+y.bandwidth()*.82).attr("font-size",9).attr("font-weight",800).attr("fill","#452080").text(d=>fmt(d.selected));
  const legend=svg.append("g").attr("transform",`translate(${margin.left},8)`);
  legend.append("rect").attr("width",10).attr("height",10).attr("fill","#452080");
  legend.append("text").attr("x",15).attr("y",9).attr("font-size",9).attr("fill","#6f637c").text(market==="All"?"Global benchmark":"Selected market");
  legend.append("rect").attr("x",105).attr("width",10).attr("height",10).attr("fill","#c9c0da");
  legend.append("text").attr("x",120).attr("y",9).attr("font-size",9).attr("fill","#6f637c").text(market==="All"?"Overall sample":"Global benchmark");
}

function renderMarketProfile(){
  const root=d3.select("#marketProfile");
  if(root.empty()) return;
  const market=selectedMarket();
  const rows=market==="All"?activeRows():marketRows(market);
  const total=rows.length||1;
  const topField=(key)=>{
    const counts=new Map();
    rows.forEach(r=>{
      const value=Array.isArray(r[key])?r[key][0]:clean(r[key]);
      if(value) counts.set(value,(counts.get(value)||0)+1);
    });
    return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
  };
  const ai=rows.filter(r=>["Extremely likely","Somewhat likely"].includes(clean(r.aiLikelihood))).length/total;
  const spend=rows.filter(r=>/^Will increase/i.test(clean(r.spendChange))).length/total;
  const cards=[
    ["Market base",`${rows.length.toLocaleString()} respondents`],
    ["Top destination",topField("Q3")],
    ["Preferred airline",topField("airlineCarrier")],
    ["Preferred hotel brand",topField("hotelBrand")],
    ["AI assistant trust",fmt(ai)],
    ["Spend expected to rise",fmt(spend)]
  ];
  root.html(`<div class="market-profile-head"><div><span class="section-tag">MARKET DETAIL</span><h2>${escapeHtml(market)} profile</h2></div><span class="mini-note">Compared with active filters</span></div><div class="market-profile-grid">${cards.map((card,i)=>`<article class="market-profile-card market-profile-${i%4}"><span>${escapeHtml(card[0])}</span><strong title="${escapeHtml(card[1])}">${escapeHtml(card[1])}</strong></article>`).join("")}</div>`);
}

function computeRadarMetrics(){
  return {
    airline:(byLabel("airlineNPS","NPS Score")+100)/200,
    hotel:(byLabel("hotelNPS","NPS Score")+100)/200,
    ai:byLabel("aiLikelihood","Top 2 Box"),
    spend:spendIncreaseCurrent(),
    research:byLabel("planningStage","researching destinations")
  };
}
function renderRadar(){
  const current=computeRadarMetrics();
  const global=withSelection(["Total"],computeRadarMetrics);
  const axes=[
    {key:"airline",label:"Airline NPS"},
    {key:"hotel",label:"Hotel NPS"},
    {key:"ai",label:"AI Trust"},
    {key:"spend",label:"Spend ↑"},
    {key:"research",label:"Researching"}
  ];
  const series=[
    {name:`${selectionLabel(activeSelections)} (current)`,color:palette[1],values:current},
    {name:"Global (Total)",color:palette[0],values:global}
  ];
  radar("#radarChart",axes,series);
}

/* ---------- global market map ---------- */
function marketMetric(market,mode){
  const rows=marketRows(market);
  if(mode==="source") return {value:rows.length,label:"Filtered sample base"};
  const key=mode==="airline"?"airlineNPS":"hotelNPS";
  return {value:metricFromRows(rows,key),label:mode==="airline"?"Airline NPS":"Hotel NPS"};
}

function selectedMarket(){
  const vals=filterSelections.Market||[];
  return vals.length===1?vals[0]:vals[0]||"All";
}
function renderMapInsight(sel,mode){
  const root=d3.select(sel); if(root.empty()) return;
  const market=selectedMarket();
  const allRows=activeRows();
  const title=mode==="source"?"Source market":mode==="airline"?"Airline POV":"Hotel POV";

  if(!market||market==="All"){
    /* No market selected — show global totals */
    let metricText, metricLabel;
    if(mode==="source"){
      metricText=`${allRows.length.toLocaleString()} respondents`;
      metricLabel="Global filtered base";
    } else {
      const key=mode==="airline"?"airlineNPS":"hotelNPS";
      const scores=allRows.map(r=>r[key]).filter(v=>typeof v==="number");
      const nps=scores.length?(scores.filter(v=>v>=9).length-scores.filter(v=>v<=6).length)/scores.length*100:0;
      metricText=`${d3.format(".0f")(nps)} NPS`;
      metricLabel="Global NPS · all markets";
    }
    root.html(`
      <div class="map-focus-name">All markets</div>
      <div class="map-focus-metric">${metricText}</div>
      <div class="map-focus-label">${metricLabel}</div>
      <div class="map-focus-hint">Click any country on the map to focus on a specific market.</div>`);
    return;
  }

  /* Specific market selected */
  const metric=marketMetric(market,mode);
  const base=marketRows(market).length;
  const metricText=mode==="source"?`${metric.value.toLocaleString()} respondents`:`${d3.format(".0f")(metric.value)} NPS`;
  root.html(`
    <div class="map-focus-name">${escapeHtml(market)}</div>
    <div class="map-focus-metric">${metricText}</div>
    <div class="map-focus-label">${metric.label} · ${base.toLocaleString()} filtered sample base</div>
    <div class="map-focus-hint">${title} · Map values respect the other active filters. Market itself is excluded so you can compare markets fairly.</div>`);
}

function renderGlobalMap(sel,mode,heatMetric,rowFilter){
  /* heatMetric: undefined=default, or one of:
     'airlineNPS','hotelNPS','spendInc','aiAdopt','booked','business','premium' */
  const el=document.querySelector(sel); if(!el)return;
  const w=Math.max(520,el.clientWidth||520), h=280;
  d3.select(sel).selectAll("*").remove();

  /* ── Pill bar FIRST so it sits above the SVG ─────────────────── */
  const _switcherMetricsTmp=mode==="airline"
    ?["airlineNPS","respondents","spendInc","aiAdopt","premium","booked"]
    :mode==="hotel"
    ?["hotelNPS","respondents","spendInc","aiAdopt","premium","booked"]
    :["respondents","spendInc","aiAdopt","booked","business","premium"];
  const _activeMetricTmp=heatMetric||el.dataset.heatMetric||(mode==="airline"?"airlineNPS":mode==="hotel"?"hotelNPS":"respondents");
  const _pillBar=document.createElement("div");
  _pillBar.style.cssText="display:flex;flex-wrap:wrap;gap:5px;padding:4px 4px 6px;align-items:center;";
  _switcherMetricsTmp.forEach(mk=>{
    const mcfg=METRIC_CFG[mk]; if(!mcfg)return;
    const isActive=mk===_activeMetricTmp;
    const btn=document.createElement("button");
    btn.type="button";
    btn.textContent=mcfg.label;
    btn.style.cssText=`padding:4px 11px;border-radius:20px;border:1px solid;cursor:pointer;font-size:9px;font-weight:${isActive?700:400};white-space:nowrap;background:${isActive?"#452080":"transparent"};color:${isActive?"#fff":"#6f5a9e"};border-color:${isActive?"#452080":"#c8c0dc"};`;
    btn.addEventListener("click",()=>renderGlobalMap(sel,mode,mk));
    _pillBar.appendChild(btn);
  });
  el.appendChild(_pillBar);

  const svg=d3.select(sel).append("svg")
    .attr("width",w).attr("height",h)
    .attr("viewBox",`0 0 ${w} ${h}`);

  let countries=null;
  if(WORLD){
    if(WORLD.type==="FeatureCollection") countries=WORLD;
    else if(window.topojson&&WORLD.objects?.countries) countries=topojson.feature(WORLD,WORLD.objects.countries);
  }
  const projection=d3.geoNaturalEarth1();
  if(countries?.features?.length) projection.fitExtent([[8,8],[w-8,h-36]],countries);
  else projection.scale(Math.min(w/6.4,h/3.1)).translate([w/2,h/2+4]);
  const path=d3.geoPath(projection);
  const g=svg.append("g");

  /* ── GeoJSON name aliases ───────────────────────────────────── */
  const GEO_NAME={
    "Russian Federation":"Russia",
    "Korea, Republic of (South Korea)":"South Korea"
  };
  const geoName=m=>GEO_NAME[m]||m;
  const TINY=new Set(["Bahrain","Singapore"]);

  /* ── Compute per-market metrics from filtered records ────────── */
  const rows=rowFilter?activeRows().filter(rowFilter):activeRows();
  if(!rows.length && DATA){
    /* Defensive: if DATA loaded but activeRows=0, something is wrong.
       Fall back to raw records for map rendering only. */
    console.warn("renderGlobalMap: activeRows()=0 with DATA loaded, using raw records");
  }
  const safeRows = rows.length ? rows : (DATA ? DATA.records : []);
  const byMarket={};
  MARKETS.forEach(m=>{
    const mr=safeRows.filter(r=>r.Market===m);
    if(!mr.length){byMarket[m]={n:0};return;}
    const n=mr.length;
    const npsCalc=key=>{
      const s=mr.map(r=>r[key]).filter(v=>typeof v==="number");
      return s.length?(s.filter(v=>v>=9).length-s.filter(v=>v<=6).length)/s.length*100:null;
    };
    byMarket[m]={
      n,
      airlineNPS: npsCalc("airlineNPS"),
      hotelNPS:   npsCalc("hotelNPS"),
      spendInc:   mr.filter(r=>/increase/i.test(r.spendChange||"")).length/n*100,
      aiAdopt:    mr.filter(r=>/(extremely|somewhat) likely/i.test(r.aiLikelihood||"")).length/n*100,
      booked:     mr.filter(r=>/already booked/i.test(r.planningStage||"")).length/n*100,
      business:   mr.filter(r=>r["Trip Type"]==="BUSINESS").length/n*100,
      premium:    mr.filter(r=>["Business class","First class"].includes(r.cabinClass||"")).length/n*100
    };
  });

  /* ── Active metric ──────────────────────────────────────────── */
;

  /* Default metric by tab mode */
  const defaultMetric=mode==="airline"?"airlineNPS":mode==="hotel"?"hotelNPS":"respondents";
  const activeMetric=heatMetric||el.dataset.heatMetric||defaultMetric;
  el.dataset.heatMetric=activeMetric;
  const cfg=METRIC_CFG[activeMetric]||METRIC_CFG.respondents;

  /* ── Colour scale ────────────────────────────────────────────── */
  let colorScale;
  if(cfg.midpoint!==undefined){
    const pct=(cfg.midpoint-cfg.min)/(cfg.max-cfg.min);
    colorScale=d3.scaleLinear()
      .domain([cfg.min, cfg.min+(cfg.max-cfg.min)*pct, cfg.max])
      .range([cfg.c0, cfg.c50||"#f5c842", cfg.c100]).clamp(true);
  } else {
    colorScale=d3.scaleLinear().domain([cfg.min,cfg.max]).range([cfg.c0,cfg.c100]).clamp(true);
  }

  const getVal=m=>{
    const bm=byMarket[m];
    if(!bm||!bm.n) return null;
    if(activeMetric==="respondents") return bm.n;
    return bm[activeMetric]??null;
  };

  const selected=filterSelections.Market||[];

  /* ── Reverse lookup geoName → market ────────────────────────── */
  const geoToMarket={};
  MARKETS.forEach(m=>{if(!TINY.has(m)) geoToMarket[geoName(m)]=m;});

  /* ── Draw countries ─────────────────────────────────────────── */
  if(countries?.features?.length){
    g.append("g").attr("class","world-land").selectAll("path")
      .data(countries.features).join("path")
      .attr("d",path)
      .attr("fill",f=>{
        const mn=geoToMarket[f.properties.name];
        if(!mn) return "#ede8f5";
        if(selected.includes(mn)) return "#ff7f2a";
        const v=getVal(mn);
        return v!==null?colorScale(v):"#ede8f5";
      })
      .attr("stroke",f=>{
        const mn=geoToMarket[f.properties.name];
        return selected.includes(mn)?"#e05500":"#fff";
      })
      .attr("stroke-width",f=>{
        const mn=geoToMarket[f.properties.name];
        return selected.includes(mn)?2:0.4;
      })
      .style("cursor",f=>geoToMarket[f.properties.name]?"pointer":"default")
      .on("click",(e,f)=>{ const mn=geoToMarket[f.properties.name]; if(mn) selectMarketFromMap(mn); })
      .on("mousemove",(e,f)=>{
        const mn=geoToMarket[f.properties.name]; if(!mn)return;
        const v=getVal(mn);
        if(v===null){hideTip();return;}
        const bm=byMarket[mn]||{};
        showTip(e,{label:mn, value:`${cfg.label}: ${cfg.fmt(v)}  (n=${bm.n})`},true);
      })
      .on("mouseleave",hideTip);
  }

  /* ── Tiny country dots ───────────────────────────────────────── */
  const tinyList=MARKETS.filter(m=>TINY.has(m)&&MARKET_COORDS[m]);
  g.append("g").selectAll("g").data(tinyList).join("g")
    .attr("transform",m=>{const p=projection(MARKET_COORDS[m]);return`translate(${p[0]},${p[1]})`;})
    .style("cursor","pointer")
    .call(s=>{
      s.append("circle").attr("r",5)
        .attr("fill",m=>{
          if(selected.includes(m)) return "#ff7f2a";
          const v=getVal(m); return v!==null?colorScale(v):"#ede8f5";
        })
        .attr("stroke","#fff").attr("stroke-width",1.2);
      s.append("text").attr("x",6).attr("y",3).attr("font-size",7).attr("fill","#444")
        .text(m=>m==="Singapore"?"SG":"BH");
    })
    .on("click",(e,m)=>selectMarketFromMap(m))
    .on("mousemove",(e,m)=>{
      const v=getVal(m); if(v===null){hideTip();return;}
      const bm=byMarket[m]||{};
      showTip(e,{label:m,value:`${cfg.label}: ${cfg.fmt(v)}  (n=${bm.n})`},true);
    })
    .on("mouseleave",hideTip);

  /* Make a selected source market easy to locate on the full-world view. */
  const selectedMarketName=selected.length===1?selected[0]:null;
  if(selectedMarketName&&MARKET_COORDS[selectedMarketName]){
    const p=projection(MARKET_COORDS[selectedMarketName]);
    const selectedGroup=g.append("g").attr("class","selected-market-focus").attr("transform",`translate(${p[0]},${p[1]})`).style("cursor","pointer");
    selectedGroup.append("circle").attr("r",9).attr("fill","#ff7f2a").attr("stroke","#fff").attr("stroke-width",2);
    selectedGroup.append("circle").attr("r",15).attr("fill","none").attr("stroke","#ff7f2a").attr("stroke-width",1.5).attr("opacity",.75);
    selectedGroup.append("text").attr("x",12).attr("y",4).attr("font-size",10).attr("font-weight",800).attr("fill","#452080").text(selectedMarketName);
    selectedGroup.on("mousemove",e=>showTip(e,{label:selectedMarketName,value:`${cfg.label}: ${cfg.fmt(getVal(selectedMarketName)??0)}`},true)).on("mouseleave",hideTip).on("click",()=>selectMarketFromMap(selectedMarketName));
  }

  /* pill bar already built above SVG */

  /* ── Colour legend bar ───────────────────────────────────────── */
  const defs=svg.append("defs");
  const gid=`heatGrad${sel.replace(/\W/g,"")}${activeMetric}`;
  const grad=defs.append("linearGradient").attr("id",gid).attr("x1","0%").attr("x2","100%");
  if(cfg.c50){
    grad.append("stop").attr("offset","0%").attr("stop-color",cfg.c0);
    grad.append("stop").attr("offset","50%").attr("stop-color",cfg.c50);
    grad.append("stop").attr("offset","100%").attr("stop-color",cfg.c100);
  } else {
    grad.append("stop").attr("offset","0%").attr("stop-color",cfg.c0);
    grad.append("stop").attr("offset","100%").attr("stop-color",cfg.c100);
  }
  const legG=svg.append("g").attr("transform",`translate(14,${h-26})`);
  legG.append("rect").attr("width",120).attr("height",7).attr("rx",3).attr("fill",`url(#${gid})`);
  legG.append("text").attr("x",0).attr("y",18).attr("font-size",8).attr("fill","#8a7e98")
    .text(cfg.fmt(cfg.min));
  legG.append("text").attr("x",120).attr("y",18).attr("font-size",8).attr("fill","#8a7e98")
    .attr("text-anchor","end").text(cfg.fmt(cfg.max));
  legG.append("text").attr("x",130).attr("y",6).attr("font-size",8).attr("fill","#8a7e98")
    .text("· "+cfg.label+" · click to filter");
}
function selectMarketFromMap(market){
  filterSelections.Market=[market];
  filterDim="Market"; activeSelections=[market]; segment=market;
  renderFilterMenu("Market"); updateFilterSummaries(); updateSegmentBase(); renderActive();
}

/* ---------- KPIs ---------- */
function renderKpis(){
  /* Compute all KPIs from live filtered records */
  const rows=activeRows();
  const nb=rows.length||1;
  const increase=rows.filter(r=>/increase/i.test(r.spendChange||"")).length/nb;
  const premium=byLabel("cabinClass","Premium economy")+byLabel("cabinClass","Business class")+byLabel("cabinClass","First class");
  const items=[
    ["Holiday-led trips",byLabel("tripPurpose","Holiday or vacation"),"Main purpose of next trip"],
    ["Still researching",byLabel("planningStage","researching destinations"),"Largest planning-stage cohort"],
    ["Travel in 1–3 months",byLabel("tripTiming","1–3 months"),"Near-term departure window"],
    ["Spend expected to rise",increase,"Any level of increase"],
    ["Premium cabin intent",premium,"Premium economy + Business + First"]
  ];
  d3.select("#kpis").selectAll("div.kpi").data(items).join("div").attr("class","kpi").html(d=>`<div class="kpi-label">${d[0]}</div><div class="kpi-value">${fmt(d[1])}</div><div class="kpi-sub">${d[2]} · ${selectionLabel(activeSelections)}</div>`);
  const research=byLabel("planningStage","researching"), booked=byLabel("planningStage","already booked");
  d3.select("#planningInsight").text(`${fmt(research)} researching · ${fmt(booked)} booked`);
}

/* ---------- chart primitives ---------- */
function dimensions(sel,height){const el=document.querySelector(sel),w=Math.max(300,el.clientWidth),m={t:12,r:48,b:24,l:165};return {w,h:height,m,iw:w-m.l-m.r,ih:height-m.t-m.b}}

function horizontalBars(sel,data,opt={}){
  const {w,h,m,iw,ih}=dimensions(sel,opt.height||280); const root=d3.select(sel); root.selectAll("*").remove();
  const svg=root.append("svg").attr("width",w).attr("height",h); const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
  const y=d3.scaleBand().domain(data.map(d=>d.label)).range([0,ih]).padding(.32), max=opt.max||Math.max(.1,d3.max(data,d=>d.value)*1.15), x=d3.scaleLinear().domain([0,max]).range([0,iw]);
  g.append("g").attr("class","gridline").call(d3.axisBottom(x).ticks(4).tickSize(ih).tickFormat("")).selectAll("line").attr("transform",`translate(0,${-ih})`);
  g.selectAll("rect").data(data).join("rect").attr("x",0).attr("y",d=>y(d.label)).attr("height",y.bandwidth()).attr("rx",5).attr("fill",(d,i)=>i===0?palette[0]:"#9fded7").attr("width",d=>x(d.value)).on("mousemove",(e,d)=>showTip(e,d)).on("mouseleave",hideTip);
  g.selectAll(".val").data(data).join("text").attr("class","val").attr("x",d=>x(d.value)+7).attr("y",d=>y(d.label)+y.bandwidth()/2+4).text(d=>fmt(d.value)).attr("font-size",10.5).attr("font-weight",800).attr("fill","#354056");
  const gy=g.append("g").attr("class","axis").call(d3.axisLeft(y).tickSize(0));gy.select(".domain").remove();gy.selectAll("text").each(function(d){const s=d3.select(this),txt=d.length>31?d.slice(0,29)+"…":d;s.text(txt).attr("title",d)});
  g.append("g").attr("class","axis").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).ticks(4).tickFormat(fmt));
}

function donut(sel,data,center,selected=[]){
  const el=document.querySelector(sel),w=Math.max(300,el.clientWidth),h=285;d3.select(sel).selectAll("*").remove();const svg=d3.select(sel).append("svg").attr("width",w).attr("height",h);
  const r=Math.min(92,w*.24),cx=Math.min(w*.36,130),cy=140,pie=d3.pie().value(d=>d.value).sort(null),arc=d3.arc().innerRadius(r*.58).outerRadius(r);
  const g=svg.append("g").attr("transform",`translate(${cx},${cy})`);g.selectAll("path").data(pie(data)).join("path").attr("d",arc).attr("fill",(d,i)=>selected.length&&selected.includes(d.data.label)?palette[1]:palette[i%palette.length]).attr("stroke","#fff").attr("stroke-width",2).on("mousemove",(e,d)=>showTip(e,d.data)).on("mouseleave",hideTip);
  g.append("text").attr("text-anchor","middle").attr("class","donut-center").attr("y",0).text(fmt(d3.max(data,d=>d.value)||0));g.append("text").attr("text-anchor","middle").attr("class","donut-sub").attr("y",17).text(center);
  const leg=svg.append("g").attr("class","legend").attr("transform",`translate(${Math.max(cx+r+28,w*.52)},58)`);const li=leg.selectAll("g").data(data.slice(0,7)).join("g").attr("transform",(d,i)=>`translate(0,${i*28})`);li.append("circle").attr("r",5).attr("fill",(d,i)=>palette[i%palette.length]);li.append("text").attr("x",11).attr("y",4).text(d=>(d.label.length>26?d.label.slice(0,24)+"…":d.label)+`  ${fmt(d.value)}`);
}

function npsColor(v){return v>=50?"#12a594":v>=0?"#f59e57":"#d1495b";}

function gauge(sel,value,opt={}){
  const el=document.querySelector(sel),w=Math.max(260,el.clientWidth),h=210;d3.select(sel).selectAll("*").remove();
  const svg=d3.select(sel).append("svg").attr("width",w).attr("height",h);
  const cx=w/2, cy=h*.72, R=Math.min(100,w*.34);
  const domain=opt.domain||[0,1], color=opt.color||"#12a594";
  const frac=Math.max(0,Math.min(1,(value-domain[0])/(domain[1]-domain[0])));
  const arcBg=d3.arc().innerRadius(R*.72).outerRadius(R).startAngle(-Math.PI/2).endAngle(Math.PI/2);
  const arcFg=d3.arc().innerRadius(R*.72).outerRadius(R).startAngle(-Math.PI/2).endAngle(-Math.PI/2+frac*Math.PI);
  const g=svg.append("g").attr("transform",`translate(${cx},${cy})`);
  g.append("path").attr("d",arcBg).attr("fill","#eef1f6");
  g.append("path").attr("d",arcFg).attr("fill",color);
  g.append("text").attr("class","gauge-value").attr("text-anchor","middle").attr("y",-8).text(opt.format?opt.format(value):value);
  g.append("text").attr("class","gauge-label").attr("text-anchor","middle").attr("y",10).text(opt.label||"");
  svg.append("text").attr("class","gauge-sub").attr("text-anchor","middle").attr("x",cx).attr("y",h-6).text(opt.sub||"");
}

function scatter(sel,points,opt={}){
  const el=document.querySelector(sel),w=Math.max(320,el.clientWidth),h=340;d3.select(sel).selectAll("*").remove();
  const m={t:16,r:24,b:44,l:52},iw=w-m.l-m.r,ih=h-m.t-m.b;
  const svg=d3.select(sel).append("svg").attr("width",w).attr("height",h);
  const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
  const xExt=d3.extent(points,d=>d.x), yExt=d3.extent(points,d=>d.y);
  const pad=(a,b)=>{const p=Math.max(6,(b-a)*.25); return [a-p,b+p];};
  const [x0,x1]=pad(...xExt), [y0,y1]=pad(...yExt);
  const x=d3.scaleLinear().domain([x0,x1]).range([0,iw]);
  const y=d3.scaleLinear().domain([y0,y1]).range([ih,0]);
  const rMax=d3.max(points,d=>d.r)||1, rScale=d3.scaleSqrt().domain([0,rMax]).range([8,28]);
  g.append("g").attr("class","gridline").call(d3.axisBottom(x).ticks(5).tickSize(ih).tickFormat("")).selectAll("line").attr("transform",`translate(0,${-ih})`);
  g.append("g").attr("class","axis").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).ticks(5).tickFormat(opt.xFormat||(d=>d)));
  g.append("g").attr("class","axis").call(d3.axisLeft(y).ticks(5).tickFormat(opt.yFormat||(d=>d)));
  svg.append("text").attr("x",m.l+iw/2).attr("y",h-4).attr("text-anchor","middle").attr("font-size",10.5).attr("fill","#7a859a").text(opt.xLabel||"");
  svg.append("text").attr("transform",`translate(14,${m.t+ih/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size",10.5).attr("fill","#7a859a").text(opt.yLabel||"");
  g.selectAll("circle").data(points).join("circle").attr("class","scatter-dot").attr("cx",d=>x(d.x)).attr("cy",d=>y(d.y)).attr("r",d=>rScale(d.r)).attr("fill",(d,i)=>d.focus || (opt.focus && d.label===shortRegion(opt.focus)) ? palette[1] : palette[i%palette.length]).attr("fill-opacity",.82)
    .on("mousemove",(e,d)=>showTip(e,{label:d.label,value:`${opt.xLabel}: ${(opt.xFormat||(v=>v))(d.x)} · ${opt.yLabel}: ${(opt.yFormat||(v=>v))(d.y)}`},true))
    .on("mouseleave",hideTip);
  g.selectAll(".scatter-label").data(points).join("text").attr("class","scatter-label").attr("x",d=>x(d.x)).attr("y",d=>y(d.y)-rScale(d.r)-6).attr("text-anchor","middle").text(d=>d.label);
}

function lineChart(sel,data,opt={}){
  const el=document.querySelector(sel),w=Math.max(300,el.clientWidth),H=opt.height||260;
  d3.select(sel).selectAll("*").remove();
  const m2={t:16,r:24,b:30,l:44},IW=w-m2.l-m2.r,IH=H-m2.t-m2.b;
  const svg=d3.select(sel).append("svg").attr("width",w).attr("height",H);
  const g=svg.append("g").attr("transform",`translate(${m2.l},${m2.t})`);
  const x=d3.scalePoint().domain(data.map(d=>d.x)).range([0,IW]).padding(.5);
  const y=d3.scaleLinear().domain([0,opt.max||d3.max(data,d=>d.y)*1.2]).range([IH,0]);
  g.append("g").attr("class","gridline").call(d3.axisLeft(y).ticks(4).tickSize(-IW).tickFormat("")).select(".domain").remove();
  g.append("g").attr("class","axis").attr("transform",`translate(0,${IH})`).call(d3.axisBottom(x));
  g.append("g").attr("class","axis").call(d3.axisLeft(y).ticks(4).tickFormat(fmt));
  const line=d3.line().x(d=>x(d.x)).y(d=>y(d.y)).curve(d3.curveMonotoneX);
  const area=d3.area().x(d=>x(d.x)).y0(IH).y1(d=>y(d.y)).curve(d3.curveMonotoneX);
  g.append("path").datum(data).attr("d",area).attr("fill","#12a594").attr("fill-opacity",.08);
  g.append("path").datum(data).attr("class","line-path").attr("d",line).attr("stroke","#12a594");
  g.selectAll("circle").data(data).join("circle").attr("class","line-dot").attr("cx",d=>x(d.x)).attr("cy",d=>y(d.y)).attr("r",d=>opt.focus && (d.x===opt.focus || (opt.focus==="25–44" && (d.x==="25-34"||d.x==="35-44"))) ? 7 : 5).attr("fill",d=>opt.focus && (d.x===opt.focus || (opt.focus==="25–44" && (d.x==="25-34"||d.x==="35-44"))) ? "#ff7f2a" : "#452080")
    .on("mousemove",(e,d)=>showTip(e,{label:d.x,value:d.y})).on("mouseleave",hideTip);
  g.selectAll(".val").data(data).join("text").attr("x",d=>x(d.x)).attr("y",d=>y(d.y)-12).attr("text-anchor","middle").attr("font-size",10.5).attr("font-weight",800).attr("fill","#354056").text(d=>fmt(d.y));
}

function verticalBars(sel,data,opt={}){
  const el=document.querySelector(sel);
  const ranked=[...(data||[])].filter(d=>Number.isFinite(+d.value)).sort((a,b)=>b.value-a.value);
  if(!el)return;
  const w=Math.max(300,el.clientWidth||300),h=opt.height||240,m={t:24,r:16,b:40,l:44},iw=w-m.l-m.r,ih=h-m.t-m.b;
  d3.select(sel).selectAll("*").remove();
  if(!ranked.length){d3.select(sel).append("div").attr("class","empty-chart").text("No data available for this selection.");return;}
  const svg=d3.select(sel).append("svg").attr("width",w).attr("height",h).attr("viewBox",`0 0 ${w} ${h}`);
  const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
  const x=d3.scaleBand().domain(ranked.map(d=>d.label)).range([0,iw]).padding(.28);
  const dataMax=d3.max(ranked,d=>+d.value)||0;
  const max=Math.max(dataMax*1.15,Number.isFinite(+opt.max)?+opt.max:0.1);
  const y=d3.scaleLinear().domain([0,max]).range([ih,0]);
  g.append("g").attr("class","gridline").call(d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat("" )).select(".domain").remove();
  const key=chartFilterKey(sel),selected=key?chartFilters[key]:null;
  g.selectAll("rect.bar").data(ranked).join("rect").attr("class","bar")
    .attr("x",d=>x(d.label)).attr("y",d=>y(Math.max(0,+d.value))).attr("width",x.bandwidth()).attr("height",d=>Math.max(0,ih-y(Math.max(0,+d.value)))).attr("rx",5)
    .attr("fill",(d,i)=>selected===d.label?palette[1]:(i===0?palette[0]:palette[i%palette.length]))
    .style("cursor",key?"pointer":"default")
    .on("click",(e,d)=>{e.stopPropagation();if(key)toggleChartFilter(key,d.label);})
    .on("mousemove",(e,d)=>showTip(e,d)).on("mouseleave",hideTip);
  g.selectAll("text.val").data(ranked).join("text").attr("class","val")
    .attr("x",d=>x(d.label)+x.bandwidth()/2).attr("y",d=>Math.max(11,y(Math.max(0,+d.value))-6))
    .attr("text-anchor","middle").attr("font-size",10).attr("font-weight",800).attr("fill","#354056").text(d=>fmt(d.value));
  const gx=g.append("g").attr("class","axis").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).tickSize(0));
  gx.select(".domain").remove();
  gx.selectAll("text").each(function(d){const s=d3.select(this),t=String(d);s.text(t.length>15?t.slice(0,13)+"…":t).attr("title",t);});
  g.append("g").attr("class","axis").call(d3.axisLeft(y).ticks(4).tickFormat(fmt));
}

function radar(sel,axes,series){
  const el=document.querySelector(sel); if(!el)return;
  const w=Math.max(320,el.clientWidth),h=320;
  d3.select(sel).selectAll("*").remove();
  const svg=d3.select(sel).append("svg").attr("width",w).attr("height",h);
  const cx=w/2-30,cy=h/2-4,R=Math.min(w,h)/2-58;
  const angle=i=>(Math.PI*2*i/axes.length)-Math.PI/2;
  const rScale=d3.scaleLinear().domain([0,1]).range([0,R]);
  const g=svg.append("g").attr("transform",`translate(${cx},${cy})`);
  [.25,.5,.75,1].forEach(ringVal=>{
    const pts=axes.map((a,i)=>{const r=rScale(ringVal);return `${Math.cos(angle(i))*r},${Math.sin(angle(i))*r}`;}).join(" ");
    g.append("polygon").attr("points",pts).attr("fill","none").attr("stroke","#e3ddf0").attr("stroke-width",1);
  });
  axes.forEach((a,i)=>{
    const x=Math.cos(angle(i))*R,y=Math.sin(angle(i))*R;
    g.append("line").attr("x1",0).attr("y1",0).attr("x2",x).attr("y2",y).attr("stroke","#e3ddf0");
    g.append("text").attr("x",Math.cos(angle(i))*(R+18)).attr("y",Math.sin(angle(i))*(R+18)).attr("text-anchor","middle").attr("font-size",9).attr("font-weight",700).attr("fill","#6f637c").text(a.label);
  });
  series.forEach(s=>{
    const pts=axes.map((a,i)=>{const v=Math.max(0,Math.min(1,s.values[a.key]||0));const r=rScale(v);return [Math.cos(angle(i))*r,Math.sin(angle(i))*r];});
    g.append("polygon").attr("points",pts.map(p=>p.join(",")).join(" ")).attr("fill",s.color).attr("fill-opacity",.16).attr("stroke",s.color).attr("stroke-width",2);
    g.selectAll(null).data(axes).join("circle").attr("cx",(a,i)=>pts[i][0]).attr("cy",(a,i)=>pts[i][1]).attr("r",3.5).attr("fill",s.color)
      .on("mousemove",(e,a)=>showTip(e,{label:`${s.name} · ${a.label}`,value:fmt(s.values[a.key]||0)},true))
      .on("mouseleave",hideTip);
  });
  const leg=svg.append("g").attr("transform",`translate(${w-150},16)`);
  const li=leg.selectAll("g").data(series).join("g").attr("transform",(d,i)=>`translate(0,${i*17})`);
  li.append("circle").attr("r",5).attr("fill",d=>d.color);
  li.append("text").attr("x",10).attr("y",4).attr("font-size",9).attr("font-weight",700).attr("fill","#554a62").text(d=>d.name);
}

/* ---------- PNG export ---------- */
function addExportButtons(){
  document.querySelectorAll(".card").forEach(card=>{
    if(!card.querySelector(".chart"))return;
    const head=card.querySelector(".card-head"); if(!head||head.querySelector(".card-head-actions"))return;
    const actions=document.createElement("div"); actions.className="card-head-actions";
    const note=head.querySelector(".mini-note"); if(note)actions.appendChild(note);
    const btn=document.createElement("button");
    btn.type="button"; btn.className="export-btn"; btn.title="Download chart as PNG"; btn.textContent="⬇";
    btn.addEventListener("click",()=>exportChartPNG(card.querySelector(".chart"),card.querySelector("h2")?.textContent||"chart"));
    actions.appendChild(btn); head.appendChild(actions);
  });
}
function exportChartPNG(container,name){
  const svg=container?.querySelector("svg"); if(!svg)return;
  const clone=svg.cloneNode(true);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const bg=document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("width","100%"); bg.setAttribute("height","100%"); bg.setAttribute("fill","#ffffff");
  clone.insertBefore(bg,clone.firstChild);
  const svgData=new XMLSerializer().serializeToString(clone);
  const svgBlob=new Blob([svgData],{type:"image/svg+xml;charset=utf-8"});
  const url=URL.createObjectURL(svgBlob);
  const img=new Image();
  img.onload=()=>{
    const scale=2;
    const width=svg.clientWidth||parseFloat(svg.getAttribute("width"))||600;
    const height=svg.clientHeight||parseFloat(svg.getAttribute("height"))||300;
    const canvas=document.createElement("canvas");
    canvas.width=width*scale; canvas.height=height*scale;
    const ctx=canvas.getContext("2d"); ctx.scale(scale,scale);
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,width,height);
    ctx.drawImage(img,0,0,width,height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob=>{
      const a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download=`${String(name).trim().replace(/\s+/g,"_").toLowerCase()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    });
  };
  img.onerror=()=>URL.revokeObjectURL(url);
  img.src=url;
}

/* ---------- composite panels ---------- */
function spend(sel="#spendChart"){
  const raw=q("spendChange"), inc=raw.filter(d=>d.label.startsWith("Will increase")).reduce((a,b)=>a+b.value,0), same=byLabel("spendChange","remain the same"), dec=raw.filter(d=>d.label.startsWith("Will decrease")).reduce((a,b)=>a+b.value,0), unsure=byLabel("spendChange","Can’t say");
  const data=[{label:"Increase",value:inc},{label:"Same",value:same},{label:"Decrease",value:dec},{label:"Unsure",value:unsure}]; horizontalBars(sel,data,{height:250,max:1});
}
function decision(){
  const data=q("decisionFactors").sort((a,b)=>b.value-a.value);
  const listEl=d3.select("#decisionList");
  if(!listEl.empty()){listEl.selectAll(".rank-item").data(data.slice(0,6)).join("div").attr("class","rank-item").html((d,i)=>`<div class="rank-num">${i+1}</div><div class="rank-label">${d.label}</div><div class="rank-value">${fmt(d.value)}</div>`);}
}

/* ---------- tooltip / util ---------- */
function showTip(e,d,raw){tooltip.style("opacity",1).html(`<strong>${d.label}</strong><br>${raw?d.value:fmt(d.value)+" · "+selectionLabel(activeSelections)}`).style("left",`${e.clientX+12}px`).style("top",`${e.clientY+12}px`)}
function hideTip(){tooltip.style("opacity",0)}
function debounce(fn,ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}

/* ---------- NEW EXCEL DATA ENGINE / MULTI-FILTER INTERACTIONS ---------- */
let chartFilters = {};
let ignoreDashboardFilters = false;

function filterOptions(cfg){
  if(!DATA) return [];
  if(cfg.value==="Class"){
    return currentTab==="hotel"
      ? (DATA.filterOptions.Class||[]).filter(x=>(DATA.filterOptions.Class||[]).includes(x) && (DATA.filterOptions.hotelClass||[]).includes(x))
      : (DATA.filterOptions.Class||[]).filter(x=>(DATA.filterOptions.cabinClass||[]).includes(x));
  }
  return DATA.filterOptions?.[cfg.value] || [];
}
function rowMatchesDimension(r,dim,vals){
  if(!vals || !vals.length) return true;
  if(dim==="Class"){
    const v=currentTab==="hotel"?r.accommodation:r.cabinClass;
    return vals.includes(v);
  }
  if(dim==="Age Group" && vals.includes("25–44")){
    const allowed=vals.flatMap(v=>v==="25–44"?["25-34","35-44"]:[v]);
    return allowed.includes(r[dim]);
  }
  return vals.includes(r[dim]);
}
function passesRecord(r,skipDim=null){
  if(ignoreDashboardFilters) return true;
  for(const [dim,vals] of Object.entries(filterSelections)){
    if(dim===skipDim || !vals || !vals.length) continue;
    if(!rowMatchesDimension(r,dim,vals)) return false;
  }
  for(const [key,label] of Object.entries(chartFilters)){
    if(!questionMatches(r,key,label)) return false;
  }
  return true;
}
function activeRows(){ return (DATA?.records||[]).filter(r=>passesRecord(r)); }
function contextRows(skipDim=null){ return (DATA?.records||[]).filter(r=>passesRecord(r,skipDim)); }
function questionMatches(r,key,label){
  if(key==="Q18" || key==="Q24") return matrixRowMatches(r,key,label);
  if(key==="Q8a") {
    const def=surveyDefinition(key);
    const idx=(def?.items||[]).findIndex(it=>clean(it.label)===clean(label));
    return idx>=0 && Array.isArray(r[key]) && Number(r[key][idx])===1;
  }
  if(key==="Q10a") return Number(r[key])===Number(label);
  if(key==="Age Group") return label==="25–44" ? ["25-34","35-44"].includes(r["Age Group"]) : clean(r["Age Group"])===clean(label);
  if(key==="Region") return clean(r.Region)===clean(label) || clean(shortRegion(r.Region))===clean(label);
  if(key==="aiLikelihood" && label==="Top 2 Box") return ["Extremely likely","Somewhat likely"].includes(clean(r[key]));
  if(key==="aiLikelihood" && label==="Bottom 2 Box") return ["Somewhat unlikely","Extremely unlikely"].includes(clean(r[key]));
  if(key==="airlineLoyaltyImportance" || key==="hotelLoyaltyImportance") {
    if(label==="NET : Top 2 Box") return ["Extremely important","Very important"].includes(clean(r[key]));
    if(label==="NET : Bottom 2 Box") return ["Slightly important","Not at all important"].includes(clean(r[key]));
  }
  const v=r[key];
  if(Array.isArray(v)) return v.includes(label);
  if(key==="airlineNPS" || key==="hotelNPS" || key==="Q15a" || key==="Q21a"){
    if(label==="NPS Score") return Number.isFinite(Number(v));
    const n=Number(String(label).match(/\d+/)?.[0]);
    return Number(v)===n;
  }
  return clean(v)===clean(label);
}

function q(key){
  const rows=activeRows(), def=DATA.questions[key];
  if(!def) return [];
  if(def.type==="multi"){
    return def.items.map(it=>({label:clean(it.label),value:rows.length?rows.filter(r=>Array.isArray(r[key])&&r[key].includes(it.label)).length/rows.length:0}));
  }
  if(def.type==="nps"){
    const vals=rows.map(r=>r[key]).filter(v=>Number.isFinite(v));
    const out=[];
    for(let n=0;n<=10;n++) out.push({label:String(n),value:vals.length?vals.filter(v=>v===n).length/vals.length:0});
    const score=vals.length?vals.reduce((s,v)=>s+(v>=9?1:v<=6?-1:0),0)/vals.length*100:0;
    out.push({label:"NPS Score",value:score});
    return out;
  }
  const counts=new Map();
  rows.forEach(r=>{const v=clean(r[key]);if(v)counts.set(v,(counts.get(v)||0)+1);});
  return [...counts.entries()].map(([label,count])=>({label,value:rows.length?count/rows.length:0}));
}
function valueFor(key,needle,seg){
  const saved=ignoreDashboardFilters;
  ignoreDashboardFilters=true;
  const records=DATA.records.filter(r=>{
    if(seg==="Total"||seg==null) return true;
    if(REGIONS.includes(seg)) return r.Region===seg;
    if(AGES.includes(seg)) return r["Age Group"]===seg;
    if((DATA.filterOptions?.Market||[]).includes(seg)) return r.Market===seg;
    return true;
  });
  ignoreDashboardFilters=saved;
  const def=DATA.questions[key];
  if(!def) return 0;
  if(def.type==="nps"){
    const vals=records.map(r=>r[key]).filter(v=>Number.isFinite(v));
    if(needle==="NPS Score") return vals.length?vals.reduce((s,v)=>s+(v>=9?1:v<=6?-1:0),0)/vals.length*100:0;
    const n=Number(String(needle).match(/\d+/)?.[0]); return vals.length?vals.filter(v=>v===n).length/vals.length:0;
  }
  if(def.type==="multi"){
    const item=def.items.find(it=>clean(it.label)===clean(needle));
    return records.length&&item?records.filter(r=>Array.isArray(r[key])&&r[key].includes(item.label)).length/records.length:0;
  }
  if(def.type==="single"){
    if(needle==="Top 2 Box"||needle==="Bottom 2 Box") return 0;
    const n=records.filter(r=>clean(r[key])===clean(needle)).length;
    return records.length?n/records.length:0;
  }
  return 0;
}
function baseFor(key,seg){
  const saved=ignoreDashboardFilters;
  ignoreDashboardFilters=true;
  let n=0;
  if(seg==="Total"||seg==null) n=DATA.records.length;
  else if(REGIONS.includes(seg)) n=DATA.records.filter(r=>r.Region===seg).length;
  else if((DATA.filterOptions?.Market||[]).includes(seg)) n=DATA.records.filter(r=>r.Market===seg).length;
  else if(AGES.includes(seg)) n=DATA.records.filter(r=>r["Age Group"]===seg).length;
  else if(DATA.filterOptions?.[filterDim]?.includes(seg)) n=DATA.records.filter(r=>filterDim==="Class"?(currentTab==="hotel"?r.accommodation:r.cabinClass):r[filterDim]===seg).length;
  ignoreDashboardFilters=saved;
  return n;
}
function segmentValue(row,key){
  return Number(row?.value||0);
}
function baseForSelection(key,sel){ return baseFor(key,sel); }

function setFilterDim(dim){
  filterDim=dim;
  const cfg=FILTER_CONFIG.find(f=>f.value===dim)||FILTER_CONFIG[0];
  const valid=filterOptions(cfg);
  filterSelections[dim]=(filterSelections[dim]||[]).filter(v=>valid.includes(v));
  activeSelections=[...(filterSelections[dim]||[])];
  segment=selectionLabel(activeSelections);
  updateFilterSummaries(); updateSegmentBase(); renderActive();
}
function initFilterState(){
  FILTER_CONFIG.forEach(cfg=>{
    const opts=filterOptions(cfg);
    const def=cfg.default||[];
    filterSelections[cfg.value]=def.filter(v=>opts.includes(v));
  });
}
function resetFilters(){
  chartFilters={};
  FILTER_CONFIG.forEach(cfg=>{
    const opts=filterOptions(cfg);
    const def=cfg.default||[];
    filterSelections[cfg.value]=def.filter(v=>opts.includes(v));
  });
  setFilterDim("Market");
  buildFilterControlsCascade();
}
function selectionLabel(values){
  if(!values||!values.length)return "All";
  if(values.length===1)return values[0];
  if(values.length===2)return values.join(", ");
  return `${values.length} selected`;
}
function updateSegmentBase(){
  const rows=activeRows();
  d3.select("#segmentBase").text(rows.length?`Active: ${rows.length.toLocaleString()} respondents`:"No respondents");
  d3.select("#chipClear").attr("hidden",Object.keys(chartFilters).length===0 && Object.keys(filterSelections).every(k=>!(filterSelections[k]||[]).length)?true:null);
}
function isDefaultFilter(){
  return Object.values(filterSelections).every(v=>!v.length) && !Object.keys(chartFilters).length;
}
function toggleChartFilter(key,label){
  if(!key || !label || label==="NPS Score") return;
  if(chartFilters[key]===label) delete chartFilters[key]; else chartFilters[key]=label;
  renderActive(); updateFilterSummaries(); updateSegmentBase();
}
function chartFilterKey(sel){
  const id=String(sel).replace(/^#/,"");
  const map={
    planningChart:"planningStage",purposeChart:"tripPurpose",timingChart:"tripTiming",spendChart:"spendChange",
    infoChart:"infoChannels",companionChart:"travelCompanions",bookingChart:"bookingChannels",decisionList:"decisionFactors",decisionChart:"decisionFactors",
    experienceChart:"experiences",leadTimeChart:"planningLeadTime",aiTasksChart:"aiTasks",
    carrierChart:"airlineCarrier",airlineConsiderChart:"airlineConsiderations",cabinChart:"cabinClass",
    airlineLoyaltyChart:"airlineLoyaltyImportance",airlineStrategyChart:"airlineStrategies",
    stayChart:"accommodation",hotelConsiderChart:"hotelConsiderations",hotelLoyaltyChart:"hotelLoyaltyImportance",
    hotelStrategyChart:"hotelStrategies",hotelFeaturesChart:"hotelLoyaltyFeatures",hotelBrandChart:"hotelBrand",
    regionSpendBar:"Region",regionResearchBar:"Region",ageLine:"Age Group"
  };
  return map[id]||null;
}
function addChartClick(sel,selection){
  const key=chartFilterKey(sel);
  if(key) toggleChartFilter(key,selection);
}
function topN(arr,n){ return [...arr].sort((a,b)=>b.value-a.value).slice(0,n); }

/* replace chart primitives with versions that support click-to-filter and full scrolling */
function dimensions(sel,height){
  const el=document.querySelector(sel),w=Math.max(300,el.clientWidth),m={t:12,r:55,b:28,l:180};
  return {w,h:Math.max(height, (el && el.dataset && el.dataset.rows ? +el.dataset.rows*28+55 : height)),m,iw:w-m.l-m.r,ih:Math.max(40,Math.max(height,(el?.dataset?.rows?+el.dataset.rows*28+55:height))-m.t-m.b)};
}
function horizontalBars(sel,data,opt={}){
  const el=document.querySelector(sel);
  const ranked=[...(data||[])].filter(d=>Number.isFinite(+d.value)).sort((a,b)=>b.value-a.value);
  if(el) el.dataset.rows=ranked.length;
  const {w,h,m,iw,ih}=dimensions(sel,Math.max(opt.height||280,ranked.length*28+55));
  const root=d3.select(sel); root.selectAll("*").remove();
  if(!ranked.length){ root.append("div").attr("class","empty-chart").text("No data available for this selection."); return; }
  const svg=root.append("svg").attr("width",w).attr("height",h);
  const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
  const y=d3.scaleBand().domain(ranked.map(d=>d.label)).range([0,ih]).padding(.28);
  const max=opt.max||Math.max(.1,d3.max(ranked,d=>d.value)||0)*1.15;
  const x=d3.scaleLinear().domain([0,max]).range([0,iw]);
  g.append("g").attr("class","gridline").call(d3.axisBottom(x).ticks(4).tickSize(ih).tickFormat("")).selectAll("line").attr("transform",`translate(0,${-ih})`);
  const key=chartFilterKey(sel);
  g.selectAll("rect").data(ranked).join("rect")
    .attr("x",0).attr("y",d=>y(d.label)).attr("height",y.bandwidth()).attr("rx",5)
    .attr("fill",(d,i)=>chartFilters[key]===d.label?"#ff7f2a":(i===0?"#452080":i===1?"#6a3ea8":"#9b8dc1"))
    .attr("width",d=>x(Math.max(0,d.value)))
    .style("cursor",key?"pointer":"default")
    .on("click",(e,d)=>{e.stopPropagation(); if(key) toggleChartFilter(key,d.label);})
    .on("mousemove",(e,d)=>showTip(e,d)).on("mouseleave",hideTip);
  g.selectAll(".val").data(ranked).join("text").attr("class","val")
    .attr("x",d=>Math.min(iw-2,x(d.value)+7)).attr("y",d=>y(d.label)+y.bandwidth()/2+4)
    .text(d=>fmt(d.value)).attr("font-size",10.5).attr("font-weight",800).attr("fill","#354056");
  const gy=g.append("g").attr("class","axis").call(d3.axisLeft(y).tickSize(0)); gy.select(".domain").remove();
  gy.selectAll("text").each(function(d){const s=d3.select(this),t=d.length>42?d.slice(0,40)+"…":d;s.text(t).attr("title",d);});
  g.append("g").attr("class","axis").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).ticks(4).tickFormat(fmt));
}
function donut(sel,data,center,selected=[]){
  const el=document.querySelector(sel),w=Math.max(300,el.clientWidth),h=Math.max(285,Math.min(420,90+data.length*32));
  d3.select(sel).selectAll("*").remove();
  const svg=d3.select(sel).append("svg").attr("width",w).attr("height",h);
  const r=Math.min(92,w*.24),cx=Math.min(w*.36,130),cy=Math.min(140,h/2),pie=d3.pie().value(d=>d.value).sort(null),arc=d3.arc().innerRadius(r*.58).outerRadius(r);
  const key=chartFilterKey(sel);
  const g=svg.append("g").attr("transform",`translate(${cx},${cy})`);
  g.selectAll("path").data(pie(data)).join("path").attr("d",arc)
    .attr("fill",(d,i)=>chartFilters[key]===d.data.label?palette[1]:palette[i%palette.length])
    .attr("stroke","#fff").attr("stroke-width",2).style("cursor",key?"pointer":"default")
    .on("click",(e,d)=>{e.stopPropagation();if(key)toggleChartFilter(key,d.data.label);})
    .on("mousemove",(e,d)=>showTip(e,d.data)).on("mouseleave",hideTip);
  g.append("text").attr("text-anchor","middle").attr("class","donut-center").attr("y",0).text(fmt(d3.max(data,d=>d.value)||0));
  g.append("text").attr("text-anchor","middle").attr("class","donut-sub").attr("y",17).text(center);
  const leg=svg.append("g").attr("class","legend").attr("transform",`translate(${Math.max(cx+r+28,w*.52)},40)`);
  const li=leg.selectAll("g").data(data).join("g").attr("transform",(d,i)=>`translate(0,${i*26})`).style("cursor",key?"pointer":"default");
  li.append("circle").attr("r",5).attr("fill",(d,i)=>chartFilters[key]===d.label?palette[1]:palette[i%palette.length]);
  li.append("text").attr("x",11).attr("y",4).text(d=>(d.label.length>34?d.label.slice(0,32)+"…":d.label)+`  ${fmt(d.value)}`);
  li.on("click",(e,d)=>{e.stopPropagation();if(key)toggleChartFilter(key,d.label);});
}

/* KPI and special helpers */
function byLabel(key,needle){
  return q(key).find(d=>d.label.toLowerCase().includes(String(needle).toLowerCase()))?.value||0;
}
function spendIncreaseCurrent(){
  return q("spendChange").filter(d=>d.label.startsWith("Will increase")).reduce((a,b)=>a+b.value,0);
}
function regionSpendIncrease(seg){
  return valueFor("spendChange","Will increase",seg) + valueFor("spendChange","Will increase moderately",seg) + valueFor("spendChange","Will increase slightly",seg) + valueFor("spendChange","Will increase significantly",seg);
}
function specificQ(key,selected=[]){
  const rows=q(key); return selected.length?rows.filter(d=>selected.includes(d.label)):rows;
}
function findRow(key,needle){ return q(key).find(r=>r.label.toLowerCase().includes(needle.toLowerCase())); }
function withSelection(sel,fn){
  const oldIgnore=ignoreDashboardFilters, oldFilters={...chartFilters};
  ignoreDashboardFilters=true; chartFilters={};
  const result=fn();
  chartFilters=oldFilters; ignoreDashboardFilters=oldIgnore;
  return result;
}
/* keep all chart rows; only insights remain top-N */
function decision(){
  const data=q("decisionFactors");
  const root=d3.select("#decisionList");
  root.selectAll("*").remove();
  data.sort((a,b)=>b.value-a.value).forEach((d,i)=>{
    const row=root.append("div").attr("class","rank-item").style("cursor","pointer");
    row.html(`<div class="rank-num">${i+1}</div><div class="rank-label">${d.label}</div><div class="rank-value">${fmt(d.value)}</div>`);
    row.on("click",()=>toggleChartFilter("decisionFactors",d.label));
  });
}

/* ---------- final data-engine fixes ---------- */
function filterOptions(cfg){
  if(!DATA) return [];
  if(cfg.value==="Class"){
    const source=currentTab==="hotel" ? DATA.records.map(r=>r.accommodation) : DATA.records.map(r=>r.cabinClass);
    return [...new Set(source.filter(Boolean))].sort();
  }
  return DATA.filterOptions?.[cfg.value] || [];
}
function q(key){
  const rows=activeRows(), def=DATA.questions[key];
  if(!def) return [];
  if(def.type==="multi") return (def.items||[]).map(it=>({label:clean(it.label),value:rows.length?rows.filter(r=>Array.isArray(r[key])&&r[key].some(value=>clean(value)===clean(it.label))).length/rows.length:0})).filter(d=>d.label);
  if(def.type==="nps"){
    const vals=rows.map(r=>Number(r[key])).filter(Number.isFinite), out=[];
    for(let n=0;n<=10;n++) out.push({label:String(n),value:vals.length?vals.filter(v=>v===n).length/vals.length:0});
    out.push({label:"NPS Score",value:vals.length?vals.reduce((sum,v)=>sum+(v>=9?1:v<=6?-1:0),0)/vals.length*100:0});
    return out;
  }
  if(def.type==="rank") return surveyQuestionData(def,key);
  if(def.type==="numeric") {
    const counts=new Map(); rows.forEach(r=>{const v=Number(r[key]);if(Number.isFinite(v))counts.set(v,(counts.get(v)||0)+1);});
    return [...counts.entries()].sort((a,b)=>a[0]-b[0]).map(([label,count])=>({label:String(label),value:rows.length?count/rows.length:0}));
  }
  const counts=new Map();
  rows.forEach(r=>{const v=clean(r[key]);if(v)counts.set(v,(counts.get(v)||0)+1);});
  /* Use answering base (non-empty) as denominator to avoid 0% on sparse questions */
  const ansBase=rows.filter(r=>clean(r[key])).length||rows.length||1;
  const out=[...counts.entries()].map(([label,count])=>({label,value:count/ansBase}));
  if(key==="aiLikelihood") {
    const top=rows.length?rows.filter(r=>["Extremely likely","Somewhat likely"].includes(clean(r[key]))).length/rows.length:0;
    const bottom=rows.length?rows.filter(r=>["Somewhat unlikely","Extremely unlikely"].includes(clean(r[key]))).length/rows.length:0;
    out.push({label:"Top 2 Box",value:top},{label:"Bottom 2 Box",value:bottom});
  }
  if(key==="airlineLoyaltyImportance"||key==="hotelLoyaltyImportance") {
    const top=rows.length?rows.filter(r=>["Extremely important","Very important"].includes(clean(r[key]))).length/rows.length:0;
    const bottom=rows.length?rows.filter(r=>["Slightly important","Not at all important"].includes(clean(r[key]))).length/rows.length:0;
    out.push({label:"NET : Top 2 Box",value:top},{label:"NET : Bottom 2 Box",value:bottom});
  }
  return out;
}
function valueFor(key,needle,seg){
  const saved=ignoreDashboardFilters; ignoreDashboardFilters=true;
  const records=DATA.records.filter(r=>{
    if(seg==="Total"||seg==null) return true;
    if(REGIONS.includes(seg)) return r.Region===seg;
    if(AGES.includes(seg)) return r["Age Group"]===seg;
    if((DATA.filterOptions?.Market||[]).includes(seg)) return r.Market===seg;
    return true;
  });
  ignoreDashboardFilters=saved;
  const def=DATA.questions[key]; if(!def||!records.length)return 0;
  if(def.type==="nps"){
    const vals=records.map(r=>r[key]).filter(v=>Number.isFinite(v));
    if(needle==="NPS Score") return vals.length?vals.reduce((s,v)=>s+(v>=9?1:v<=6?-1:0),0)/vals.length*100:0;
    const n=Number(String(needle).match(/\d+/)?.[0]); return vals.length?vals.filter(v=>v===n).length/vals.length:0;
  }
  if(def.type==="multi"){
    const item=def.items.find(it=>clean(it.label).toLowerCase().includes(String(needle).toLowerCase()));
    return item?records.filter(r=>Array.isArray(r[key])&&r[key].includes(item.label)).length/records.length:0;
  }
  if(def.type==="single"){
    const n=records.filter(r=>clean(r[key]).toLowerCase().includes(String(needle).toLowerCase())).length;
    return n/records.length;
  }
  return 0;
}
function regionSpendIncrease(seg){
  const saved=ignoreDashboardFilters; ignoreDashboardFilters=true;
  const rows=DATA.records.filter(r=>{
    if(seg==="Total"||seg==null)return true;
    if(REGIONS.includes(seg))return r.Region===seg;
    if((DATA.filterOptions?.Market||[]).includes(seg))return r.Market===seg;
    return true;
  });
  ignoreDashboardFilters=saved;
  if(!rows.length)return 0;
  return rows.filter(r=>String(r.spendChange||"").startsWith("Will increase")).length/rows.length;
}
function baseFor(key,seg){
  if(seg==="Total"||seg==null)return DATA.records.length;
  if(REGIONS.includes(seg))return DATA.records.filter(r=>r.Region===seg).length;
  if((DATA.filterOptions?.Market||[]).includes(seg))return DATA.records.filter(r=>r.Market===seg).length;
  if(AGES.includes(seg))return DATA.records.filter(r=>r["Age Group"]===seg).length;
  if(filterDim==="Class"){
    const f=currentTab==="hotel"?"accommodation":"cabinClass"; return DATA.records.filter(r=>r[f]===seg).length;
  }
  return DATA.records.filter(r=>r[filterDim]===seg).length;
}


/* ============================================================
   COMPLETE SURVEY QUESTION EXPLORER + FINAL CHART SAFETY FIXES
   ============================================================ */

const SURVEY_ORDER=["Q2","Q3","Q3a","Q4","Q4a","Q4b","Q5","Q6","Q6a","Q7","Q8","Q8a","Q8b","Q9","Q9a","Q9b","Q9c","Q10a","Q10","Q11","Q11a","Q12","Q14","Q15","Q15a","Q16","Q16a","Q16b","Q17","Q18","Q19","Q20","Q21","Q21a","Q22","Q22a","Q22b","Q23","Q24"];

function escapeHtml(v){
  return String(v??"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function surveyDefinition(key){
  if(!DATA) return null;

  // Q18/Q24 and the legacy analytical questions live in DATA.questions.
  // The complete survey metadata for the remaining Q2-Q24 blocks lives in
  // DATA.surveyQuestions. The previous version only looked in DATA.questions,
  // which meant the tab question containers were created but every card was
  // silently skipped. Resolve both sources into one definition contract.
  const analytical=DATA.questions?.[key];
  if(analytical && (analytical.type==="matrix" || analytical.items || analytical.strategies || analytical.rows || analytical.data)) {
    const surveyMeta=(DATA.surveyQuestions||[]).find(x=>x.key===key);
    return {...(surveyMeta||{}), ...analytical, key};
  }

  const meta=(DATA.surveyQuestions||[]).find(x=>x.key===key);
  if(meta) return {...meta,key};

  return analytical ? {...analytical,key} : null;
}

function surveyCatalog(){
  const defs=[];
  for(const key of SURVEY_ORDER){
    const def=surveyDefinition(key);
    if(def) defs.push({...def,key});
  }
  return defs;
}

function surveyQuestionText(def){
  let s=clean(def?.question||"");
  s=s.replace(/\^f\([^)]*\)\^/g,"").replace(/\s+/g," ").trim();
  // The card already displays the Q-number as its section tag. Remove the
  // duplicated leading Q-number from the long source question text.
  s=s.replace(/^Q\d+[a-z]?\s*\.\s*/i,"");
  return s || "Survey question";
}

function surveyQuestionData(def,key){
  const rows=activeRows();
  if(!rows.length) return [];
  if(def.type==="single"){
    const counts=new Map();
    rows.forEach(r=>{const label=clean(r[key]); if(label) counts.set(label,(counts.get(label)||0)+1);});
    /* Use answering base (non-empty) as denominator, not total rows.
       Avoids 0% display when question is conditional/sparse (e.g. Q3a). */
    const answeringBase=rows.filter(r=>clean(r[key])).length||rows.length;
    return [...counts.entries()].map(([label,count])=>({label,value:count/answeringBase}));
  }
  if(def.type==="multi"){
    return (def.items||[]).map(it=>({
      label:clean(it.label),
      value:rows.filter(r=>Array.isArray(r[key])&&r[key].includes(it.label)).length/rows.length
    })).filter(d=>d.label);
  }
  if(def.type==="text_multi"){
    const counts=new Map();
    rows.forEach(r=>{
      const seen=new Set();
      (Array.isArray(r[key])?r[key]:[]).forEach(v=>{
        const label=clean(v);
        if(label&&!seen.has(label)){counts.set(label,(counts.get(label)||0)+1);seen.add(label);}
      });
    });
    return [...counts.entries()].map(([label,count])=>({label,value:count/rows.length}));
  }
  if(def.type==="nps"){
    const vals=rows.map(r=>Number(r[key])).filter(Number.isFinite);
    return d3.range(0,11).map(n=>({label:String(n),value:vals.length?vals.filter(v=>v===n).length/vals.length:0}));
  }
  if(def.type==="rank"){
    const items=def.items||[];
    return items.map((it,i)=>{
      const vals=rows.map(r=>Array.isArray(r[key])?Number(r[key][i]):NaN).filter(Number.isFinite);
      const first=vals.length?vals.filter(v=>v===1).length/vals.length:0;
      const avg=vals.length?d3.mean(vals):0;
      return {label:clean(it.label),value:first,avgRank:avg};
    });
  }
  if(def.type==="matrix") return [];
  if(def.type==="numeric"){
    const counts=new Map();
    rows.forEach(r=>{
      const v=Number(r[key]);
      if(Number.isFinite(v)) counts.set(v,(counts.get(v)||0)+1);
    });
    return [...counts.entries()].sort((a,b)=>a[0]-b[0]).map(([label,count])=>({label:String(label),value:count/rows.length}));
  }
  const counts=new Map();
  rows.forEach(r=>{
    const v=clean(r[key]);
    if(v) counts.set(v,(counts.get(v)||0)+1);
  });
  return [...counts.entries()].map(([label,count])=>({label,value:count/rows.length}));
}

function surveyToggleFilter(key,label){
  if(!key||!label) return;
  if(chartFilters[key]===label) delete chartFilters[key];
  else chartFilters[key]=label;
  renderActive();
  updateFilterSummaries();
  updateSegmentBase();
}

function questionMatches(r,key,label){
  if(key==="Q18" || key==="Q24"){
    return matrixRowMatches(r,key,label);
  }
  if(key==="Q8a"){
    const def=surveyDefinition(key);
    const idx=(def?.items||[]).findIndex(it=>clean(it.label)===clean(label));
    return idx>=0 && Array.isArray(r[key]) && Number(r[key][idx])===1;
  }
  if(key==="Q10a"){
    return Number(r[key])===Number(label);
  }
  const v=r[key];
  if(Array.isArray(v)) return v.includes(label);
  if(key==="airlineNPS" || key==="hotelNPS" || key==="Q15a" || key==="Q21a"){
    if(label==="NPS Score") return Number.isFinite(Number(v));
    const n=Number(String(label).match(/\d+/)?.[0]);
    return Number(v)===n;
  }
  return clean(v)===clean(label);
}

function matrixRowMatches(r,key,label){
  const def=surveyDefinition(key);
  const index=DATA?.matrixIndex?.[key]||[];
  const rowMeta=(def?.rows||[]).find(x=>clean(x.label)===clean(label));
  if(!rowMeta || !Array.isArray(r[key])) return false;
  const wantedField=key==="Q18"?"carrier":"brand";
  const rowId=Number(rowMeta.id);
  return index.some((cell,i)=>Number(cell[wantedField])===rowId && r[key].includes(i));
}

/* Replace the earlier chart key mapper so survey charts can reuse the same click engine. */
function chartFilterKey(sel){
  const el=document.querySelector(sel);
  if(el?.dataset?.surveyKey) return el.dataset.surveyKey;
  const id=String(sel).replace(/^#/,"");
  const map={
    planningChart:"planningStage",purposeChart:"tripPurpose",timingChart:"tripTiming",spendChart:"spendChange",
    infoChart:"infoChannels",companionChart:"travelCompanions",bookingChart:"bookingChannels",decisionList:"decisionFactors",decisionChart:"decisionFactors",
    experienceChart:"experiences",leadTimeChart:"planningLeadTime",aiTasksChart:"aiTasks",
    carrierChart:"airlineCarrier",airlineConsiderChart:"airlineConsiderations",cabinChart:"cabinClass",
    airlineLoyaltyChart:"airlineLoyaltyImportance",airlineStrategyChart:"airlineStrategies",
    stayChart:"accommodation",hotelConsiderChart:"hotelConsiderations",hotelLoyaltyChart:"hotelLoyaltyImportance",
    hotelStrategyChart:"hotelStrategies",hotelFeaturesChart:"hotelLoyaltyFeatures",hotelBrandChart:"hotelBrand",
    regionSpendBar:"Region",regionResearchBar:"Region",ageLine:"Age Group"
  };
  return map[id]||null;
}

/* Final horizontal bar renderer: never lets a fixed axis ceiling push bars outside the card. */
function horizontalBars(sel,data,opt={}){
  const el=document.querySelector(sel);
  const ranked=[...(data||[])]
    .filter(d=>Number.isFinite(+d.value))
    .sort((a,b)=>b.value-a.value);
  if(!el)return;
  el.dataset.rows=ranked.length;
  el.classList.toggle("long-chart",ranked.length>12);

  const w=Math.max(300,el.clientWidth||300);
  const rowsHeight=Math.max(opt.height||280,ranked.length*28+55);
  const h=rowsHeight;
  const m={t:12,r:62,b:30,l:180};
  const iw=Math.max(80,w-m.l-m.r);
  const ih=Math.max(40,h-m.t-m.b);

  const root=d3.select(sel);
  root.selectAll("*").remove();

  if(!ranked.length){
    root.append("div").attr("class","empty-chart").text("No data available for this selection.");
    return;
  }

  const svg=root.append("svg").attr("width",w).attr("height",h).attr("viewBox",`0 0 ${w} ${h}`);
  const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
  const y=d3.scaleBand().domain(ranked.map(d=>d.label)).range([0,ih]).padding(.28);

  const dataMax=Math.max(0,d3.max(ranked,d=>+d.value)||0);
  let max=Number.isFinite(+opt.max)?+opt.max:0;
  max=Math.max(max,dataMax*1.15,0.001);
  if(max<=dataMax) max=dataMax||0.001;
  const x=d3.scaleLinear().domain([0,max]).range([0,iw]);

  g.append("g").attr("class","gridline")
    .call(d3.axisBottom(x).ticks(4).tickSize(ih).tickFormat(""))
    .selectAll("line").attr("transform",`translate(0,${-ih})`);

  const key=chartFilterKey(sel);
  const selected=key?chartFilters[key]:null;

  g.selectAll("rect.bar").data(ranked).join("rect")
    .attr("class","bar")
    .attr("x",0).attr("y",d=>y(d.label))
    .attr("height",y.bandwidth()).attr("rx",5)
    .attr("fill",(d,i)=>selected===d.label?palette[1]:(i===0?palette[0]:"#9fded7"))
    .attr("width",d=>Math.max(0,Math.min(iw,x(Math.max(0,+d.value)))))
    .style("cursor",key?"pointer":"default")
    .on("click",(e,d)=>{e.stopPropagation();if(key)toggleChartFilter(key,d.label);})
    .on("mousemove",(e,d)=>showTip(e,d))
    .on("mouseleave",hideTip);

  g.selectAll("text.val").data(ranked).join("text")
    .attr("class","val")
    .attr("y",d=>y(d.label)+y.bandwidth()/2+4)
    .attr("text-anchor",d=>x(Math.max(0,+d.value))+42>iw?"end":"start")
    .attr("x",d=>x(Math.max(0,+d.value))+42>iw?iw-4:Math.min(iw-4,x(Math.max(0,+d.value))+7))
    .text(d=>fmt(d.value)).attr("font-size",10.5).attr("font-weight",800).attr("fill","#354056");

  const gy=g.append("g").attr("class","axis").call(d3.axisLeft(y).tickSize(0));
  gy.select(".domain").remove();
  gy.selectAll("text").each(function(d){
    const s=d3.select(this),t=String(d);
    s.text(t.length>42?t.slice(0,40)+"…":t).attr("title",t);
  });
  g.append("g").attr("class","axis")
    .attr("transform",`translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(fmt));
}


function renderSurveyVisualization(sel,data,type,opt={}){
  const el=document.querySelector(sel); if(!el)return;
  const ranked=[...(data||[])].filter(d=>Number.isFinite(+d.value)&&String(d.label||"").trim()).sort((a,b)=>b.value-a.value);
  const root=d3.select(sel); root.selectAll("*").remove();
  if(!ranked.length){root.append("div").attr("class","empty-chart").text("No data available for this selection.");return;}
  const w=Math.max(300,el.clientWidth||300), h=opt.height||300;
  const svg=root.append("svg").attr("width",w).attr("height",h).attr("viewBox",`0 0 ${w} ${h}`);

  // Clean Tableau-like ranked dot/lollipop view for answer distributions.
  if(type==="single"||type==="multi"||type==="text_multi"||type==="nps"){
    const rows=ranked, m={t:10,r:68,b:26,l:Math.min(300,Math.max(150,w*.30))};
    const iw=Math.max(100,w-m.l-m.r), rowH=Math.max(23,(h-m.t-m.b)/rows.length), ih=rowH*rows.length;
    if(h < ih+m.t+m.b) svg.attr("height",ih+m.t+m.b).attr("viewBox",`0 0 ${w} ${ih+m.t+m.b}`);
    const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
    const max=Math.max(.001,d3.max(rows,d=>+d.value)||0), x=d3.scaleLinear().domain([0,max*1.12]).range([0,iw]);
    g.selectAll("line.grid").data(x.ticks(4)).join("line").attr("class","grid").attr("x1",d=>x(d)).attr("x2",d=>x(d)).attr("y1",0).attr("y2",ih).attr("stroke","#eee8f5");
    const key=chartFilterKey(sel), selected=key?chartFilters[key]:null;
    const row=g.selectAll("g.answer").data(rows).join("g").attr("class","answer").attr("transform",(d,i)=>`translate(0,${i*rowH+rowH/2})`).style("cursor",key?"pointer":"default");
    row.append("line").attr("x1",0).attr("x2",d=>x(+d.value)).attr("stroke",(d,i)=>selected===d.label?palette[1]:"#c9bfd8").attr("stroke-width",3).attr("stroke-linecap","round");
    row.append("circle").attr("cx",d=>x(+d.value)).attr("r",selected===null?6:7).attr("fill",(d,i)=>selected===d.label?palette[1]:i===0?palette[0]:palette[(i%6)+1]).attr("stroke","#fff").attr("stroke-width",2);
    row.append("text").attr("x",-10).attr("text-anchor","end").attr("dy","3.5").attr("font-size",10).attr("fill","#354056").text(d=>String(d.label).length>42?String(d.label).slice(0,40)+"…":d.label).append("title").text(d=>d.label);
    row.append("text").attr("x",d=>x(+d.value)+10).attr("dy","3.5").attr("font-size",10).attr("font-weight",800).attr("fill","#354056").text(d=>d3.format(".0%")(d.value));
    row.on("mousemove",(e,d)=>showTip(e,{label:d.label,value:d3.format(".1%")(d.value)})).on("mouseleave",hideTip).on("click",(e,d)=>{e.stopPropagation();if(key)toggleChartFilter(key,d.label);});
    g.append("g").attr("class","axis").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.format(".0%")));
    return;
  }

  if(type==="rank"){
    const m={t:16,r:24,b:72,l:46}, iw=w-m.l-m.r, ih=h-m.t-m.b, max=Math.max(.001,d3.max(ranked,d=>+d.value)||1);
    const x=d3.scaleBand().domain(ranked.map(d=>d.label)).range([0,iw]).padding(.28), y=d3.scaleLinear().domain([0,max*1.15]).range([ih,0]);
    const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
    g.selectAll("line.grid").data(y.ticks(4)).join("line").attr("x1",0).attr("x2",iw).attr("y1",d=>y(d)).attr("y2",d=>y(d)).attr("stroke","#eee8f5");
    const key=chartFilterKey(sel),selected=key?chartFilters[key]:null;
    g.selectAll("rect").data(ranked).join("rect").attr("x",d=>x(d.label)).attr("y",d=>y(d.value)).attr("width",x.bandwidth()).attr("height",d=>ih-y(d.value)).attr("rx",4).attr("fill",d=>selected===d.label?palette[1]:palette[0]).style("cursor",key?"pointer":"default").on("click",(e,d)=>{e.stopPropagation();if(key)toggleChartFilter(key,d.label);});
    g.append("g").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).tickFormat(d=>String(d).length>15?String(d).slice(0,13)+"…":d).tickSize(0)).selectAll("text").attr("transform","rotate(-28)").style("text-anchor","end");
    g.append("g").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".0%"))).select(".domain").remove();
    return;
  }
  if(type==="numeric"){
    const vals=ranked.map(d=>+d.label).filter(Number.isFinite), max=d3.max(vals), min=d3.min(vals);
    if(!vals.length){root.append("div").attr("class","empty-chart").text("No numeric data available.");return;}
    const bins=d3.bin().domain([min,max]).thresholds(10)(vals), m={t:18,r:24,b:42,l:48},iw=w-m.l-m.r,ih=h-m.t-m.b,x=d3.scaleLinear().domain([min,max]).range([0,iw]),y=d3.scaleLinear().domain([0,d3.max(bins,b=>b.length)||1]).range([ih,0]),g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
    g.selectAll("rect").data(bins).join("rect").attr("x",d=>x(d.x0)+1).attr("y",d=>y(d.length)).attr("width",d=>Math.max(1,x(d.x1)-x(d.x0)-2)).attr("height",d=>ih-y(d.length)).attr("fill",palette[0]).attr("rx",3);
    g.append("g").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).ticks(5));g.append("g").call(d3.axisLeft(y).ticks(4)).select(".domain").remove();
  }
}
function renderSurveyVisualizationEl(el,data,type,opt={}){
  if(!el) return;
  // Use the element's clientWidth directly (no selector lookup needed)
  const ranked=[...(data||[])].filter(d=>Number.isFinite(+d.value)&&String(d.label||"").trim()).sort((a,b)=>b.value-a.value);
  const root=d3.select(el); root.selectAll("*").remove();
  if(!ranked.length){root.append("div").attr("class","empty-chart").text("No data available for this selection.");return;}
  const w=Math.max(300,el.offsetWidth||el.parentElement?.offsetWidth||600);
  const h=opt.height||300;
  const svg=root.append("svg").attr("width",w).attr("height",h).attr("viewBox",`0 0 ${w} ${h}`);

  if(type==="single"||type==="multi"||type==="text_multi"||type==="nps"){
    const rows=ranked, m2={t:10,r:68,b:26,l:Math.min(300,Math.max(150,w*.30))};
    const iw=Math.max(100,w-m2.l-m2.r), rowH=Math.max(23,(h-m2.t-m2.b)/rows.length), ih=rowH*rows.length;
    if(h < ih+m2.t+m2.b) svg.attr("height",ih+m2.t+m2.b).attr("viewBox",`0 0 ${w} ${ih+m2.t+m2.b}`);
    const g=svg.append("g").attr("transform",`translate(${m2.l},${m2.t})`);
    const maxVal=Math.max(.001,d3.max(rows,d=>+d.value)||0), x=d3.scaleLinear().domain([0,maxVal*1.12]).range([0,iw]);
    g.selectAll("line.grid").data(x.ticks(4)).join("line").attr("class","grid").attr("x1",d=>x(d)).attr("x2",d=>x(d)).attr("y1",0).attr("y2",ih).attr("stroke","#eee8f5");
    const key=el.dataset.surveyKey, selected=key?chartFilters[key]:null;
    const row=g.selectAll("g.answer").data(rows).join("g").attr("class","answer").attr("transform",(d,i)=>`translate(0,${i*rowH+rowH/2})`).style("cursor",key?"pointer":"default");
    row.append("line").attr("x1",0).attr("x2",d=>x(+d.value)).attr("stroke",(d,i)=>selected===d.label?palette[1]:"#c9bfd8").attr("stroke-width",3).attr("stroke-linecap","round");
    row.append("circle").attr("cx",d=>x(+d.value)).attr("r",6).attr("fill",(d,i)=>selected===d.label?palette[1]:i===0?palette[0]:palette[(i%6)+1]).attr("stroke","#fff").attr("stroke-width",2);
    row.append("text").attr("x",-10).attr("text-anchor","end").attr("dy","3.5").attr("font-size",10).attr("fill","#354056").text(d=>String(d.label).length>42?String(d.label).slice(0,40)+"…":d.label).append("title").text(d=>d.label);
    row.append("text").attr("x",d=>x(+d.value)+10).attr("dy","3.5").attr("font-size",10).attr("font-weight",800).attr("fill","#354056").text(d=>d3.format(".0%")(d.value));
    row.on("mousemove",(e,d)=>showTip(e,{label:d.label,value:d3.format(".1%")(d.value)})).on("mouseleave",hideTip).on("click",(e,d)=>{e.stopPropagation();if(key)toggleChartFilter(key,d.label);});
    g.append("g").attr("class","axis").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.format(".0%")));
    return;
  }
  if(type==="rank"){
    const m3={t:16,r:24,b:72,l:46}, iw=w-m3.l-m3.r, ih=h-m3.t-m3.b, maxVal=Math.max(.001,d3.max(ranked,d=>+d.value)||1);
    const x=d3.scaleBand().domain(ranked.map(d=>d.label)).range([0,iw]).padding(.28), y=d3.scaleLinear().domain([0,maxVal*1.15]).range([ih,0]);
    const g=svg.append("g").attr("transform",`translate(${m3.l},${m3.t})`);
    g.selectAll("line.grid").data(y.ticks(4)).join("line").attr("x1",0).attr("x2",iw).attr("y1",d=>y(d)).attr("y2",d=>y(d)).attr("stroke","#eee8f5");
    const key=el.dataset.surveyKey, selected=key?chartFilters[key]:null;
    g.selectAll("rect").data(ranked).join("rect").attr("x",d=>x(d.label)).attr("y",d=>y(d.value)).attr("width",x.bandwidth()).attr("height",d=>ih-y(d.value)).attr("rx",4).attr("fill",d=>selected===d.label?palette[1]:palette[0]).style("cursor",key?"pointer":"default").on("click",(e,d)=>{e.stopPropagation();if(key)toggleChartFilter(key,d.label);});
    g.append("g").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).tickFormat(d=>String(d).length>15?String(d).slice(0,13)+"…":d).tickSize(0)).selectAll("text").attr("transform","rotate(-28)").style("text-anchor","end");
    g.append("g").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".0%"))).select(".domain").remove();
    return;
  }
  if(type==="numeric"){
    const vals=ranked.map(d=>+d.label).filter(Number.isFinite);
    if(!vals.length){root.append("div").attr("class","empty-chart").text("No numeric data available.");return;}
    const minV=d3.min(vals),maxV=d3.max(vals),bins=d3.bin().domain([minV,maxV]).thresholds(10)(vals);
    const m4={t:18,r:24,b:42,l:48},iw=w-m4.l-m4.r,ih=h-m4.t-m4.b;
    const x=d3.scaleLinear().domain([minV,maxV]).range([0,iw]),y=d3.scaleLinear().domain([0,d3.max(bins,b=>b.length)||1]).range([ih,0]);
    const g=svg.append("g").attr("transform",`translate(${m4.l},${m4.t})`);
    g.selectAll("rect").data(bins).join("rect").attr("x",d=>x(d.x0)+1).attr("y",d=>y(d.length)).attr("width",d=>Math.max(1,x(d.x1)-x(d.x0)-2)).attr("height",d=>ih-y(d.length)).attr("fill",palette[0]).attr("rx",3);
    g.append("g").attr("transform",`translate(0,${ih})`).call(d3.axisBottom(x).ticks(5));
    g.append("g").call(d3.axisLeft(y).ticks(4)).select(".domain").remove();
  }
}

function renderRankSurveyQuestionEl(card,chartEl,key,def){
  if(!chartEl) return;
  chartEl.dataset.surveyKey=key;
  const data=surveyQuestionData(def,key).sort((a,b)=>b.value-a.value);
  renderSurveyVisualizationEl(chartEl,data,"rank",{height:300});
  const note=card.querySelector(".survey-secondary");
  if(note){
    const avg=data.filter(d=>Number.isFinite(d.avgRank)).sort((a,b)=>a.avgRank-b.avgRank)
      .slice(0,6).map((d,i)=>`${i+1}. ${escapeHtml(d.label)} · avg rank ${d.avgRank.toFixed(2)}`).join("<br>");
    note.innerHTML=avg||"No rank data available.";
  }
}

function renderMatrixQuestionInto(root,key,def){
  if(!root) return;
  const rows=def.rows||[];
  const strategies=def.strategies||[];
  const index=DATA.matrixIndex?.[key]||[];
  const active=activeRows();
  if(!active.length){
    root.innerHTML='<div class="empty-chart">No respondents match the current filters.</div>';
    return;
  }
  const field=key==="Q18"?"carrier":"brand";
  const cellIndex=new Map();
  index.forEach((cell,i)=>cellIndex.set(`${cell.strategy}-${cell[field]}`,i));
  const counts=rows.map(row=>strategies.map(strategy=>{
    const idx=cellIndex.get(`${strategy.id}-${row.id}`);
    if(idx===undefined)return 0;
    let n=0;
    active.forEach(r=>{if(Array.isArray(r[key])&&r[key].includes(idx))n++;});
    return n/active.length;
  }));
  const selected=chartFilters[key]||null;
  let head=`<thead><tr><th>${key==="Q18"?"Carrier":"Brand"} \\ Strategy</th>`;
  strategies.forEach(s=>head+=`<th title="${escapeHtml(s.label)}">${escapeHtml(s.label.length>24?s.label.slice(0,22)+"…":s.label)}</th>`);
  head+="</tr></thead>";
  let body="<tbody>";
  rows.forEach((row,ri)=>{
    const activeRow=selected===row.label;
    body+=`<tr class="${activeRow?"matrix-selected":""}"><th class="matrix-row-head" data-row="${escapeHtml(row.label)}" title="Click to filter">${escapeHtml(row.label)}</th>`;
    strategies.forEach((s,si)=>{
      const v=counts[ri][si];
      body+=`<td title="${escapeHtml(row.label)} · ${escapeHtml(s.label)} · ${fmt(v)}">${fmt(v)}</td>`;
    });
    body+="</tr>";
  });
  body+="</tbody>";
  root.innerHTML=`<div class="matrix-scroll"><table class="survey-matrix-table">${head}${body}</table></div><div class="matrix-footnote">${rows.length.toLocaleString()} ${field}s × ${strategies.length} strategies · click a row name to filter</div>`;
  root.querySelectorAll(".matrix-row-head").forEach(el2=>{
    el2.addEventListener("click",e=>{
      e.stopPropagation();
      surveyToggleFilter(key,el2.dataset.row);
    });
  });
}

function renderRankSurveyQuestion(card,key,def){
  const chartId=`surveyChart_${key}`;
  const chart=card.querySelector(`#${chartId}`);
  chart.dataset.surveyKey=key;
  const data=surveyQuestionData(def,key).sort((a,b)=>b.value-a.value);
  renderSurveyVisualization(`#${chartId}`,data,"rank",{height:300});
  const note=card.querySelector(".survey-secondary");
  if(note){
    const avg=data.filter(d=>Number.isFinite(d.avgRank)).sort((a,b)=>a.avgRank-b.avgRank)
      .slice(0,6).map((d,i)=>`${i+1}. ${escapeHtml(d.label)} · avg rank ${d.avgRank.toFixed(2)}`).join("<br>");
    note.innerHTML=avg||"No rank data available.";
  }
}

function renderMatrixQuestion(card,key,def){
  const root=card.querySelector(".survey-matrix");
  const rows=def.rows||[];
  const strategies=def.strategies||[];
  const index=DATA.matrixIndex?.[key]||[];
  const active=activeRows();
  if(!active.length){
    root.innerHTML='<div class="empty-chart">No respondents match the current filters.</div>';
    return;
  }

  const field=key==="Q18"?"carrier":"brand";
  const cellIndex=new Map();
  index.forEach((cell,i)=>cellIndex.set(`${cell.strategy}-${cell[field]}`,i));

  const counts=rows.map(row=>strategies.map(strategy=>{
    const idx=cellIndex.get(`${strategy.id}-${row.id}`);
    if(idx===undefined)return 0;
    let n=0;
    active.forEach(r=>{if(Array.isArray(r[key])&&r[key].includes(idx))n++;});
    return n/active.length;
  }));

  const selected=chartFilters[key]||null;
  let head=`<thead><tr><th>${key==="Q18"?"Carrier":"Brand"} \\ Strategy</th>`;
  strategies.forEach(s=>head+=`<th title="${escapeHtml(s.label)}">${escapeHtml(s.label.length>24?s.label.slice(0,22)+"…":s.label)}</th>`);
  head+="</tr></thead>";
  let body="<tbody>";
  rows.forEach((row,ri)=>{
    const activeRow=selected===row.label;
    body+=`<tr class="${activeRow?"matrix-selected":""}"><th class="matrix-row-head" data-row="${escapeHtml(row.label)}" title="Click to filter to ${escapeHtml(row.label)}">${escapeHtml(row.label)}</th>`;
    strategies.forEach((s,si)=>{
      const v=counts[ri][si];
      body+=`<td title="${escapeHtml(row.label)} · ${escapeHtml(s.label)} · ${fmt(v)}">${fmt(v)}</td>`;
    });
    body+="</tr>";
  });
  body+="</tbody>";
  root.innerHTML=`<div class="matrix-scroll"><table class="survey-matrix-table">${head}${body}</table></div><div class="matrix-footnote">${rows.length.toLocaleString()} ${field}s × ${strategies.length} strategies · click a row name to filter</div>`;
  root.querySelectorAll(".matrix-row-head").forEach(el=>{
    el.addEventListener("click",e=>{
      e.stopPropagation();
      surveyToggleFilter(key,el.dataset.row);
    });
  });
}

function renderSurveyCard(def,targetId="surveyQuestionGrid"){
  const key=def.key;
  const qn=key.replace(/^Q/,"Q");
  const type=def.type;
  const wide=["multi","text_multi","matrix"].includes(type) || ["Q18","Q24","Q3","Q7","Q9","Q11","Q12","Q16","Q17","Q22","Q23"].includes(key);
  const card=document.createElement("article");
  card.className=`card survey-card ${wide?"survey-wide":""} ${type==="matrix"?"matrix-card":""}`;
  const note=type==="matrix"?"Full matrix · scroll horizontally/vertically · click a row to filter"
    :type==="text_multi"?"All distinct text responses · descending"
    :type==="rank"?"First-booked share · descending"
    :type==="numeric"?"Distribution of reported budget values"
    :"All answer choices · descending · click to filter";
  // Use scoped unique IDs to avoid collision when same Q appears in multiple tab grids
  const scopedId=`surveyChart_${targetId}_${key}`;
  const matrixScopedId=`surveyMatrix_${targetId}_${key}`;
  card.innerHTML=`
    <div class="card-head">
      <div class="survey-head-copy">
        <span class="section-tag">${escapeHtml(qn)}</span>
        <h2>${escapeHtml(surveyQuestionText(def))}</h2>
      </div>
      <span class="mini-note">${escapeHtml(note)}</span>
    </div>
    <div class="survey-base">Filtered base: ${activeRows().length.toLocaleString()} respondents</div>
    ${type==="matrix"
      ? `<div class="survey-matrix" id="${matrixScopedId}"></div>`
      : type==="rank"
        ? `<div id="${scopedId}" class="chart"></div><div class="survey-secondary"></div>`
        : `<div id="${scopedId}" class="chart"></div>`}
  `;
  const target=document.getElementById(targetId);
  if(target) target.appendChild(card);

  if(type==="matrix"){
    // Pass the matrix div element directly to avoid querySelector ID collision
    const matrixDiv=card.querySelector(`#${matrixScopedId}`);
    renderMatrixQuestionInto(matrixDiv,key,def);
  }else{
    // Use card.querySelector (scoped to this card) — never document.querySelector
    const chart=card.querySelector(`#${scopedId}`);
    if(!chart) return;
    chart.dataset.surveyKey=key;
    const data=surveyQuestionData(def,key);
    const chartHeight = type==="nps" ? 300 : type==="numeric" ? 250 : type==="rank" ? 300 : Math.max(250, Math.min(520, data.length*27+55));
    if(data.length>12) chart.classList.add("long-chart");
    // Pass element directly instead of selector string to avoid cross-grid ID collision
    renderSurveyVisualizationEl(chart,data,type,{height:chartHeight});
    if(type==="rank") renderRankSurveyQuestionEl(card,chart,key,def);
  }
}


/* ---------- TAB-SPECIFIC QUESTION EXPERIENCE ----------
   The main dashboard remains visual/compact, while every survey question relevant
   to the selected tab is also exposed below it. This keeps the Power BI-like
   experience: tab -> related questions -> drill down, without mixing airline,
   hotel and travel-planning questions together. */
const TAB_QUESTION_MAP={
  overview:["Q2","Q3","Q3a","Q4","Q4a","Q4b","Q5","Q6","Q6a","Q10a","Q10"],
  behaviour:["Q7","Q8","Q8a","Q8b","Q9","Q9a","Q9b","Q9c","Q11","Q11a","Q12"],
  airline:["Q14","Q15","Q15a","Q16","Q16a","Q16b","Q17","Q18"],
  hotel:["Q19","Q20","Q21","Q21a","Q22","Q22a","Q22b","Q23","Q24"]
};

function questionAnchorId(key){ return `tab-question-${key}`; }

function renderTabQuestionExplorer(tabName){
  const keys=TAB_QUESTION_MAP[tabName];
  if(!keys)return;
  const grid=document.getElementById(`${tabName}QuestionGrid`);
  const jump=document.getElementById(`${tabName}QuestionJump`);
  if(!grid)return;
  grid.innerHTML="";
  if(jump){
    jump.innerHTML=keys.map(key=>`<button type="button" class="question-pill" data-question-target="${questionAnchorId(key)}">${key}</button>`).join("");
    jump.querySelectorAll(".question-pill").forEach(btn=>btn.addEventListener("click",()=>{
      const target=document.getElementById(btn.dataset.questionTarget);
      if(target) target.scrollIntoView({behavior:"smooth",block:"start"});
    }));
  }
  keys.forEach(key=>{
    const def=surveyDefinition(key);
    if(!def)return;
    renderSurveyCard(def,`${tabName}QuestionGrid`);
    const card=grid.lastElementChild;
    if(card) card.id=questionAnchorId(key);
  });
}

function renderAllQuestions(){
  const grid=document.getElementById("surveyQuestionGrid");
  if(!grid)return;
  grid.innerHTML="";
  const defs=surveyCatalog();
  defs.forEach(def=>renderSurveyCard(def));
  const missing=document.createElement("article");
  missing.className="card survey-missing";
  missing.innerHTML=`<div class="card-head"><div><span class="section-tag">Q13</span><h2>Question not present in source workbook</h2></div></div><p>Q13 is not present in the supplied Excel dataset, so there is no source data to visualize for it.</p>`;
  grid.appendChild(missing);
  const note=document.getElementById("surveyBaseNote");
  if(note)note.textContent=`${activeRows().length.toLocaleString()} active respondents · ${defs.length} source question blocks`;
}

/* Final active-tab router adds the complete survey tab without changing the original tabs. */
function renderActive(){
  if(!DATA)return;
  if(currentTab==="all"){ renderAllQuestions(); return; }
  const fn={overview:renderOverview,behaviour:renderBehaviour,airline:renderAirline,hotel:renderHotel,market:renderMarket,destination:renderDestination,social:renderSocial}[currentTab];
  if(fn)fn();
}

/* If the complete-survey tab is selected, keep its content in sync with filters. */
const _oldSetFilterDim=setFilterDim;
function setFilterDim(dim){
  filterDim=dim;
  const cfg=FILTER_CONFIG.find(f=>f.value===dim)||FILTER_CONFIG[0];
  const valid=filterOptions(cfg);
  filterSelections[dim]=(filterSelections[dim]||[]).filter(v=>valid.includes(v));
  activeSelections=[...(filterSelections[dim]||[])];
  segment=selectionLabel(activeSelections);
  updateFilterSummaries();
  updateSegmentBase();
  renderActive();
}


/* ============================================================
   FINAL FILTER/DATA PATCH — v3
   - Region options come from respondent data
   - No market is selected by default
   - Region filter is fully multi-select
   - Class/Companion options remain data-driven
   - Keep All Survey Questions usable with the same renderer
   ============================================================ */
function filterOptions(cfg){
  if(!DATA || !cfg) return [];
  const key=cfg.value;
  if(key==="Region"){
    return [...new Set((DATA.records||[]).map(r=>clean(r.Region)).filter(Boolean))]
      .sort((a,b)=>REGIONS.indexOf(a)-REGIONS.indexOf(b));
  }
  if(key==="Class"){
    const field=currentTab==="hotel" ? "accommodation" : "cabinClass";
    return [...new Set((DATA.records||[]).map(r=>clean(r[field])).filter(Boolean))].sort();
  }
  if(key==="Companion"){
    return [...new Set((DATA.records||[]).map(r=>clean(r.travelCompanions||r.Companion)).filter(Boolean))].sort();
  }
  if(key==="Trip Type") return TRIP_TYPES.slice();
  if(key==="Age Group") return ["18-24","25-34","35-44","45-54","55-65","65+","25–44"];
  if(key==="Gender") return ["Male","Female","Prefer not to say"];
  if(key==="Income") return ["Low","Medium","High"];
  if(key==="Children") return ["Yes","No"];
  if(key==="Marital Status") return ["Single, never married","Living with partner","Married","Separated","Divorced","Widowed"];
  if(key==="AccomClass") return [...new Set((DATA.records||[]).map(r=>clean(r.accommodation)).filter(Boolean))].sort();
  if(key==="Companion") return [...new Set((DATA.records||[]).map(r=>clean(r.travelCompanions)).filter(Boolean))].sort();
  return (DATA.filterOptions?.[key]||[]).filter(Boolean);
}

function initFilterState(){
  FILTER_CONFIG.forEach(cfg=>{
    /* IMPORTANT: dashboard opens on ALL, never India. */
    filterSelections[cfg.value]=[];
  });
}

function resetFilters(){
  chartFilters={};
  FILTER_CONFIG.forEach(cfg=>{ filterSelections[cfg.value]=[]; });
  filterDim="Market";
  activeSelections=[];
  segment="All";
  buildFilterControlsCascade();
  updateSegmentBase();
  renderActive();
}

function rowMatchesDimension(r,dim,vals){
  if(!vals || !vals.length) return true;
  if(dim==="AccomClass") return vals.includes(clean(r.accommodation));
  if(dim==="Region") return vals.includes(clean(r.Region));
  if(dim==="Market") return vals.includes(clean(r.Market));
  if(dim==="Class"){
    const field=currentTab==="hotel" ? "accommodation" : "cabinClass";
    return vals.includes(clean(r[field]));
  }
  if(dim==="Companion"){
    const v=clean(r.travelCompanions||r.Companion);
    if(Array.isArray(r.travelCompanions)) return r.travelCompanions.some(x=>vals.includes(clean(x)));
    return vals.includes(v);
  }
  if(dim==="Age Group" && vals.includes("25–44")){
    const allowed=vals.flatMap(v=>v==="25–44"?["25-34","35-44"]:[v]);
    return allowed.includes(clean(r[dim]));
  }
  if(dim==="Trip Type") return vals.includes(clean(r[dim]));
  return vals.includes(clean(r[dim]));
}

function updateSegmentBase(){
  const rows=activeRows();
  d3.select("#segmentBase").text(`${rows.length.toLocaleString()} respondents`);
  const hasFilters=Object.values(filterSelections).some(v=>v&&v.length)||Object.keys(chartFilters).length;
  d3.select("#chipClear").attr("hidden",hasFilters?null:true);
}

function setFilterDim(dim){
  filterDim=dim;
  const cfg=FILTER_CONFIG.find(f=>f.value===dim)||FILTER_CONFIG[0];
  const valid=filterOptions(cfg);
  filterSelections[dim]=(filterSelections[dim]||[]).filter(v=>valid.includes(v));
  activeSelections=[...(filterSelections[dim]||[])];
  segment=selectionLabel(activeSelections);
  updateFilterSummaries(); updateSegmentBase(); renderActive();
}
