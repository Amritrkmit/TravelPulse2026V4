/* Travel Pulse — 3D Airline Intelligence Map
 * Data contract:
 * - Q3 = international destinations considered/will consider
 * - Q3a = destination finally chosen/booked where supplied
 * - Market = source market, not an airport/city
 * - airlineCarrier = preferred carrier
 *
 * IMPORTANT: this visualises survey-derived travel intent, not live flight tracking.
 * City coordinates are geographic enrichment only; survey metrics are never invented.
 */
(function(){
  "use strict";

  let globe = null;
  let initialized = false;
  let geoMode = "considered";
  let autoRotate = false;
  let destinationGeo = null;
  let lastSignature = "";
  let selectedDetail = null;
  let resizeObserver = null;
  let routeSource = "";
  let routeDestination = "";

  const SOURCE_COORDS = {
    "Australia":[134,-25],"Bahrain":[50.5,26],"Brazil":[-51,-10],"Canada":[-106,57],
    "China":[103,35],"Egypt":[30,27],"France":[2,46],"Germany":[10,51],"India":[79,22],
    "Indonesia":[118,-2],"Italy":[12,42],"Japan":[138,37],"Jordan":[36,31],"Kenya":[37,-0.2],
    "Malaysia":[102,4],"Netherlands":[5.3,52.2],"Nigeria":[8,9],"Qatar":[51.2,25.3],
    "Russian Federation":[90,61],"Saudi Arabia":[45,24],"Singapore":[103.8,1.35],
    "South Korea":[127.8,36],"Spain":[-3.5,40],"Switzerland":[8.2,46.8],"Thailand":[101,15],
    "Turkey":[35,39],"United Arab Emirates":[54,24],"United Kingdom":[-2,54],
    "United States of America":[-100,39],"South Africa":[24,-29],"Ireland":[-8,53]
  };

  function esc(v){
    return String(v ?? "").replace(/[&<>"']/g, s => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[s]));
  }
  function clean(v){return String(v ?? "").replace(/\s+/g," ").trim();}
  function fmtPct(v){return `${(Number(v)||0).toFixed(1)}%`;}
  function rows(){ try{return typeof activeRows==="function" ? activeRows() : (DATA?.records||[]);}catch(e){return DATA?.records||[];} }
  function dataReady(){return typeof DATA!=="undefined" && DATA && Array.isArray(DATA.records);}
  function geoFor(raw){
    const g=destinationGeo?.destinations?.[raw];
    return g && Array.isArray(g.coords) ? g : null;
  }
  function selectedDestinationValues(r){
    if(geoMode==="selected"){
      const v=clean(r?.Q3a);
      return v ? v.split(/\s*,\s*/).map(clean).filter(Boolean) : [];
    }
    return Array.isArray(r?.Q3) ? r.Q3.map(clean).filter(Boolean) : [];
  }
  function buildModel(){
    const rs=rows();
    const routeMap=new Map(), destMap=new Map(), marketMap=new Map(), airlineMap=new Map();
    let mappedResponses=0, destinationMentions=0;

    rs.forEach((r,ri)=>{
      const market=clean(r?.Market);
      const origin=SOURCE_COORDS[market];
      if(origin){
        const m=marketMap.get(market)||{name:market,coords:origin,count:0};
        m.count++; marketMap.set(market,m);
      }
      const carrier=clean(r?.airlineCarrier);
      if(market && carrier && origin){
        const key=market+"|||"+carrier;
        const a=airlineMap.get(key)||{name:carrier,market,coords:origin,count:0};
        a.count++; airlineMap.set(key,a);
      }
      const vals=selectedDestinationValues(r);
      if(!vals.length)return;
      let anyMapped=false;
      vals.forEach(raw=>{
        const g=geoFor(raw);
        if(!g)return;
        anyMapped=true; destinationMentions++;
        const dkey=g.label+"|||"+g.kind;
        const d=destMap.get(dkey)||{
          name:g.label,kind:g.kind,coords:g.coords,count:0,rawValues:new Set()
        };
        d.count++; d.rawValues.add(raw); destMap.set(dkey,d);

        if(origin && carrier){
          const rkey=market+"|||"+g.label+"|||"+g.kind;
          const rt=routeMap.get(rkey)||{
            origin:market,destination:g.label,destinationKind:g.kind,
            slat:origin[1],slng:origin[0],elat:g.coords[1],elng:g.coords[0],
            count:0,airlines:new Map(),rawValues:new Set()
          };
          rt.count++; rt.rawValues.add(raw);
          rt.airlines.set(carrier,(rt.airlines.get(carrier)||0)+1);
          routeMap.set(rkey,rt);
        }
      });
      if(anyMapped)mappedResponses++;
    });

    const routes=[...routeMap.values()].map(x=>({
      ...x,
      rawValue:[...x.rawValues][0]||x.destination,
      topAirline:[...x.airlines.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||"Unavailable",
      share:rs.length?x.count/rs.length:0
    })).sort((a,b)=>b.count-a.count);

    const destinations=[...destMap.values()].map(x=>({
      ...x, rawValue:[...x.rawValues][0]||x.name,share:rs.length?x.count/rs.length:0
    })).sort((a,b)=>b.count-a.count);

    const markets=[...marketMap.values()].map(x=>({...x,share:rs.length?x.count/rs.length:0}))
      .sort((a,b)=>b.count-a.count);
    const airlines=[...airlineMap.values()].sort((a,b)=>b.count-a.count);

    return {rs,routes,destinations,markets,airlines,mappedResponses,destinationMentions};
  }

  function renderKpis(model){
    const el=document.getElementById("airline3DKpis"); if(!el)return;
    const topDest=model.destinations[0];
    const topAir=model.airlines[0];
    const visibleRoutes=filteredRoutes(model);
    const k=[
      ["Filtered respondents",model.rs.length.toLocaleString()],
      ["Mapped destination mentions",model.destinationMentions.toLocaleString()],
      ["Top destination",topDest?.name||"Unavailable"],
      ["Top airline activity",topAir?.name||"Unavailable"],
      ["Visible route records",visibleRoutes.length.toLocaleString()]
    ];
    el.innerHTML=k.map(([l,v])=>`<div class="airline-3d-kpi"><span class="kpi-label">${esc(l)}</span><span class="kpi-value" title="${esc(v)}">${esc(v)}</span></div>`).join("");
    renderTopAirlines(model);
  }

  function renderTopAirlines(model){
    const el=document.getElementById("airlineTopFlights");
    if(!el)return;
    const visibleRoutes=filteredRoutes(model);
    if(routeSource||routeDestination){
      const routeGroups={};
      visibleRoutes.forEach(r=>r.airlines.forEach((n,a)=>{routeGroups[a]=(routeGroups[a]||0)+n;}));
      const cards=Object.entries(routeGroups).sort((a,b)=>b[1]-a[1]).slice(0,8);
      el.innerHTML=cards.map((x,i)=>`<article class="airline-flight-card airline-flight-${i%5}">
        <span class="airline-flight-score">${x[1]}</span>
        <div><strong>${esc(x[0])}</strong><small>Route mentions · selected connection</small></div>
      </article>`).join("");
      return;
    }
    const groups=new Map();
    model.rs.forEach(r=>{
      const carrier=clean(r.airlineCarrier);
      const score=Number(r.airlineNPS);
      if(!carrier||!Number.isFinite(score))return;
      const item=groups.get(carrier)||{carrier,scores:[],mentions:0};
      item.scores.push(score); item.mentions++;
      groups.set(carrier,item);
    });
    const cards=[...groups.values()].map(x=>{
      const promoters=x.scores.filter(v=>v>=9).length;
      const detractors=x.scores.filter(v=>v<=6).length;
      return {...x,nps:(promoters-detractors)/x.scores.length*100};
    }).sort((a,b)=>b.mentions-a.mentions).slice(0,8);
    el.innerHTML=cards.map((x,i)=>`<article class="airline-flight-card airline-flight-${i%5}">
      <span class="airline-flight-score">${Math.round(x.nps)}</span>
      <div><strong>${esc(x.carrier)}</strong><small>Airline NPS · ${x.mentions} respondents</small></div>
    </article>`).join("");
  }

  function populateRouteFilters(model){
    const source=document.getElementById("airlineRouteSource");
    const destination=document.getElementById("airlineRouteDestination");
    if(!source||!destination)return;
    const fill=(el,values,allLabel,current)=>{
      const keep=el.value||current;
      el.innerHTML=`<option value="">${allLabel}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
      el.value=values.includes(keep)?keep:"";
    };
    fill(source,[...new Set(model.routes.map(r=>r.origin))].sort(),"All sources",routeSource);
    fill(destination,[...new Set(model.routes.map(r=>r.destination))].sort(),"All destinations",routeDestination);
    routeSource=source.value; routeDestination=destination.value;
  }

  function filteredRoutes(model){
    return model.routes.filter(r=>(!routeSource||r.origin===routeSource)&&(!routeDestination||r.destination===routeDestination));
  }

  function renderRouteSelection(model){
    const el=document.getElementById("airline3DDetail");
    if(!el)return;
    const routes=filteredRoutes(model);
    if(!routeSource&&!routeDestination){
      if(!selectedDetail)renderDetail(null,null);
      return;
    }
    if(!routes.length){
      selectedDetail=null;
      el.innerHTML='<div class="airline-3d-detail-empty"><span class="detail-kicker">NO ROUTE MATCH</span><h3>'
        +esc(routeSource||"All sources")+' to '+esc(routeDestination||"All destinations")
        +'</h3><p>No survey-derived connecting route matches this source and destination selection.</p><div class="map-filter-chip">Try another route combination</div></div>';
      return;
    }
    if(routeSource&&routeDestination){
      renderDetail("route",routes[0],model);
      return;
    }
    const airlineCounts={};
    let total=0;
    routes.forEach(r=>{
      total+=r.count;
      r.airlines.forEach((n,a)=>{airlineCounts[a]=(airlineCounts[a]||0)+n;});
    });
    const top=Object.entries(airlineCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
    selectedDetail=null;
    let airlineRows="";
    top.forEach(item=>{airlineRows+='<div class="map-detail-row"><span>'+esc(item[0])+'</span><b>'+item[1]+'</b></div>';});
    let routeRows="";
    routes.slice(0,8).forEach(r=>{routeRows+='<div class="map-detail-row"><span>'+esc(r.origin)+' to '+esc(r.destination)+'</span><b>'+r.count+'</b></div>';});
    el.innerHTML='<div><span class="detail-kicker">ROUTE CONNECTIONS</span><div class="map-detail-title">'
      +esc(routeSource||"All sources")+' to '+esc(routeDestination||"All destinations")
      +'</div><div class="map-detail-route">'+routes.length+' matching route records - survey-derived travel intent</div>'
      +'<div class="map-detail-grid"><div class="map-detail-stat"><b>'+total+'</b><span>mentions</span></div><div class="map-detail-stat"><b>'+routes.length+'</b><span>connections</span></div></div>'
      +'<div class="map-detail-section"><h4>Airline activity</h4><div class="map-detail-list">'+airlineRows+'</div></div>'
      +'<div class="map-detail-section"><h4>Visible connections</h4><div class="map-detail-list">'+routeRows+'</div></div></div>';
  }

  function renderDetail(type,obj,model){
    const el=document.getElementById("airline3DDetail"); if(!el)return;
    if(!obj){
      el.innerHTML=`<div class="airline-3d-detail-empty">
        <span class="detail-kicker">INTERACTIVE MAP</span>
        <h3>Global → country → city</h3>
        <p>Select a route, destination, source market or airline marker. The selection uses the existing dashboard filters where a matching survey field exists.</p>
        <div class="map-filter-chip">Survey-derived travel intent</div>
      </div>`;
      return;
    }
    selectedDetail={type,obj};
    if(type==="route"){
      const top=[...obj.airlines.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
      el.innerHTML=`<div>
        <span class="detail-kicker">ROUTE DETAIL</span>
        <div class="map-detail-title">${esc(obj.origin)} → ${esc(obj.destination)}</div>
        <div class="map-detail-route">${esc(obj.destinationKind==="city"?"City-level destination":"Country-level destination")} · survey-derived international travel intent</div>
        <div class="map-detail-grid">
          <div class="map-detail-stat"><b>${obj.count}</b><span>mentions</span></div>
          <div class="map-detail-stat"><b>${fmtPct(obj.share*100)}</b><span>filtered share</span></div>
          <div class="map-detail-stat"><b>${esc(obj.topAirline)}</b><span>top airline</span></div>
          <div class="map-detail-stat"><b>${model.rs.length}</b><span>filtered base</span></div>
        </div>
        <div class="map-detail-section"><h4>Airline activity</h4><div class="map-detail-list">
          ${top.map(([a,n])=>`<div class="map-detail-row"><span>${esc(a)}</span><b>${n}</b></div>`).join("")}
        </div></div>
        <div class="map-detail-section"><h4>Data boundary</h4><p>Origin is the respondent source market because the survey does not provide an origin airport/city field. Destination is taken from Q3/Q3a.</p></div>
        <div class="map-filter-chip">Click route again to filter destination</div>
      </div>`;
    } else if(type==="destination"){
      el.innerHTML=`<div>
        <span class="detail-kicker">DESTINATION DETAIL</span>
        <div class="map-detail-title">${esc(obj.name)}</div>
        <div class="map-detail-route">${esc(obj.kind)} · ${geoMode==="selected"?"Q3a selected/booked destination":"Q3 considered destination"}</div>
        <div class="map-detail-grid">
          <div class="map-detail-stat"><b>${obj.count}</b><span>mentions</span></div>
          <div class="map-detail-stat"><b>${fmtPct(obj.share*100)}</b><span>filtered share</span></div>
        </div>
        <div class="map-detail-section"><h4>Available geographic detail</h4><p>${obj.kind==="city"?"City coordinate is available for this response.":"Only a country/territory-level geographic match is available."}</p></div>
        <div class="map-filter-chip">Click marker to filter the dashboard</div>
      </div>`;
    } else if(type==="airline"){
      el.innerHTML=`<div>
        <span class="detail-kicker">AIRLINE ACTIVITY</span>
        <div class="map-detail-title">${esc(obj.name)}</div>
        <div class="map-detail-route">${esc(obj.market)} source market</div>
        <div class="map-detail-grid">
          <div class="map-detail-stat"><b>${obj.count}</b><span>respondents</span></div>
          <div class="map-detail-stat"><b>${fmtPct(obj.count/Math.max(model.rs.length,1)*100)}</b><span>filtered share</span></div>
        </div>
        <div class="map-detail-section"><h4>Interpretation</h4><p>This marker represents survey respondents selecting this carrier in the source market. It is not an airline headquarters location.</p></div>
        <div class="map-filter-chip">Click marker to filter carrier</div>
      </div>`;
    } else {
      el.innerHTML=`<div>
        <span class="detail-kicker">SOURCE MARKET</span>
        <div class="map-detail-title">${esc(obj.name)}</div>
        <div class="map-detail-grid"><div class="map-detail-stat"><b>${obj.count}</b><span>respondents</span></div></div>
        <p>Clicking a source-market marker applies the existing Market filter.</p>
      </div>`;
    }
  }

  function clearMapSelection(){
    selectedDetail=null;
    renderDetail(null,null);
  }

  function applyDestinationFilter(obj){
    const raw=obj?.rawValue;
    if(!raw)return;
    try{
      if(typeof toggleChartFilter==="function"){
        toggleChartFilter(geoMode==="selected"?"Q3a":"Q3", raw);
      }
    }catch(e){console.warn("Destination filter unavailable",e);}
  }
  function applyAirlineFilter(obj){
    try{ if(typeof toggleChartFilter==="function") toggleChartFilter("airlineCarrier",obj.name); }
    catch(e){console.warn("Airline filter unavailable",e);}
  }
  function applyMarketFilter(obj){
    try{
      if(typeof filterSelections!=="undefined" && filterSelections){
        filterSelections.Market=[obj.name];
        if(typeof setFilterDim==="function") setFilterDim("Market");
      }
    }catch(e){console.warn("Market filter unavailable",e);}
  }

  function makeGlobe(){
    const el=document.getElementById("airline3DMap");
    if(!el)return;
    if(typeof Globe!=="function"){
      fallback("3D globe library could not be loaded.");
      return;
    }
    try{
      globe=new Globe(el)
        .backgroundColor("#070811")
        .showAtmosphere(true)
        .atmosphereColor("#8f7ac6")
        .atmosphereAltitude(0.16)
        .globeImageUrl("https://unpkg.com/three-globe@2.45.0/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("https://unpkg.com/three-globe@2.45.0/example/img/earth-topology.png")
        .backgroundImageUrl("https://unpkg.com/three-globe@2.45.0/example/img/night-sky.png")
        .showGraticules(false)
        .polygonsData([])
        .polygonAltitude(0.005)
        .polygonCapColor(()=>"rgba(90,72,125,0.20)")
        .polygonSideColor(()=>"rgba(75,55,110,0.16)")
        .polygonStrokeColor(()=>"rgba(180,160,210,0.25)")
        .pointsData([])
        .pointLat(d=>d.lat).pointLng(d=>d.lng)
        .pointAltitude(d=>d.kind==="market"?0.03:d.kind==="airline"?0.045:0.02)
        .pointRadius(d=>d.radius)
        .pointColor(d=>d.color)
        .pointsMerge(false)
        .labelsData([])
        .labelLat(d=>d.lat).labelLng(d=>d.lng)
        .labelText(d=>d.label)
        .labelSize(d=>d.size||0.65)
        .labelColor(d=>d.color||"#fff")
        .labelDotRadius(0.15)
        .labelAltitude(d=>d.altitude||0.035)
        .arcsData([])
        .arcStartLat(d=>d.slat).arcStartLng(d=>d.slng)
        .arcEndLat(d=>d.elat).arcEndLng(d=>d.elng)
        .arcColor(d=>d.color)
        .arcAltitudeAutoScale(0.45)
        .arcStroke(d=>d.stroke||0.45)
        .arcDashLength(0.28).arcDashGap(1.2).arcDashInitialGap(d=>d.initialGap||0)
        .arcDashAnimateTime(2200)
        .ringsData([])
        .ringLat(d=>d.lat).ringLng(d=>d.lng)
        .ringColor(d=>d.color)
        .ringMaxRadius(d=>d.maxRadius||2.2)
        .ringPropagationSpeed(2)
        .ringRepeatPeriod(900)
        .onPointClick(handlePoint)
        .onArcClick(handleArc);

      const controls=globe.controls();
      controls.enablePan=false;
      controls.minDistance=120;
      controls.maxDistance=500;
      controls.autoRotate=autoRotate;
      controls.autoRotateSpeed=0.35;

      resizeObserver=new ResizeObserver(()=>{try{globe.width(el.clientWidth).height(el.clientHeight)}catch(e){}});
      resizeObserver.observe(el);
      initialized=true;
    }catch(e){
      console.error(e);
      fallback("WebGL could not initialize in this browser.");
    }
  }

  function renderLayers(model){
    if(!globe)return;
    const points=[];
    const labels=[];
    const rings=[];

    model.markets.slice(0,40).forEach(m=>{
      points.push({kind:"market",name:m.name,lat:m.coords[1],lng:m.coords[0],radius:0.34+Math.min(0.9,m.count/model.rs.length*3),color:"#ff7f2a",obj:m});
    });
    model.destinations.slice(0,90).forEach(d=>{
      points.push({kind:d.kind,name:d.name,lat:d.coords[1],lng:d.coords[0],radius:d.kind==="city"?0.18:0.23,color:"#7b5cff",obj:d});
    });
    model.airlines.slice(0,60).forEach(a=>{
      points.push({kind:"airline",name:a.name,lat:a.coords[1],lng:a.coords[0],radius:0.12+Math.min(0.5,a.count/model.rs.length*2),color:"#12a594",obj:a});
    });

    model.markets.slice(0,18).forEach(m=>{
      labels.push({lat:m.coords[1],lng:m.coords[0],label:m.name,size:0.55,color:"#ffb21a",altitude:0.055});
    });
    model.destinations.slice(0,20).forEach(d=>{
      labels.push({lat:d.coords[1],lng:d.coords[0],label:d.name,size:d.kind==="city"?0.62:0.5,color:"#ddd1ff",altitude:0.04});
    });

    const routes=filteredRoutes(model).slice(0,160).map((r,i)=>({
      ...r,
      color: i<10 ? ["#ffb21a","#ff7f2a","#b99cff"] : ["#6f5a9e","#5f536f"],
      stroke:0.25+Math.min(1.2,r.count/Math.max(1,model.routes[0]?.count||1)*1.1),
      initialGap:(i%7)/7
    }));

    model.destinations.slice(0,25).forEach((d,i)=>{
      rings.push({lat:d.coords[1],lng:d.coords[0],color:["#7b5cff","#ffb21a"],maxRadius:1.2+Math.min(3,d.count/model.rs.length*12)});
    });

    globe.pointsData(points).labelsData(labels).arcsData(routes).ringsData(rings);

    if(typeof WORLD!=="undefined" && WORLD?.features){
      globe.polygonsData(WORLD.features);
    }
    if(selectedDetail){
      // Re-rendering keeps detail panel stable.
      const obj=selectedDetail.obj;
      if(obj?.coords){
        rings.push({lat:obj.coords[1],lng:obj.coords[0],color:["#fff","#ffb21a"],maxRadius:3.2});
      }
    }
  }

  function handlePoint(p){
    if(!p)return;
    const model=buildModel();
    if(p.kind==="market"){
      renderDetail("market",p.obj,model);
      applyMarketFilter(p.obj);
      focus(p.obj.coords);
    } else if(p.kind==="airline"){
      renderDetail("airline",p.obj,model);
      applyAirlineFilter(p.obj);
      focus(p.obj.coords);
    } else {
      renderDetail("destination",p.obj,model);
      applyDestinationFilter(p.obj);
      focus(p.obj.coords);
    }
  }
  function handleArc(r){
    if(!r)return;
    const model=buildModel();
    renderDetail("route",r,model);
    applyDestinationFilter({rawValue:r.rawValue});
    focus([r.slng,r.slat]);
  }
  function focus(coords){
    if(!globe || !coords)return;
    try{
      globe.pointOfView({lat:coords[1],lng:coords[0],altitude:1.45},900);
    }catch(e){}
  }

  function fallback(msg){
    const el=document.getElementById("airline3DMap");
    const row=document.querySelector(".airline-2d-fallback-row");
    if(el){
      el.classList.add("is-fallback");
      el.innerHTML=`<div class="airline-3d-error"><div><strong>3D view unavailable</strong><span>${esc(msg)}<br>Showing the existing 2D map below.</span></div></div>`;
    }
    if(row)row.style.display="grid";
  }

  function bindControls(){
    document.querySelectorAll("[data-geo-mode]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        geoMode=btn.getAttribute("data-geo-mode")||"considered";
        document.querySelectorAll("[data-geo-mode]").forEach(b=>b.classList.toggle("active",b===btn));
        renderAirline3DMap(true);
      });
    });
    const reset=document.getElementById("airline3DReset");
    if(reset)reset.addEventListener("click",()=>{
      clearMapSelection();
      if(globe)globe.pointOfView({lat:20,lng:0,altitude:2.35},900);
    });
    const source=document.getElementById("airlineRouteSource");
    const destination=document.getElementById("airlineRouteDestination");
    const clear=document.getElementById("airlineRouteClear");
    if(source)source.addEventListener("change",()=>{routeSource=source.value;renderAirline3DMap(true);});
    if(destination)destination.addEventListener("change",()=>{routeDestination=destination.value;renderAirline3DMap(true);});
    if(clear)clear.addEventListener("click",()=>{routeSource="";routeDestination="";selectedDetail=null;if(source)source.value="";if(destination)destination.value="";renderAirline3DMap(true);});
    const rotate=document.getElementById("airline3DAutoRotate");
    if(rotate)rotate.addEventListener("click",()=>{
      autoRotate=!autoRotate;
      if(globe)globe.controls().autoRotate=autoRotate;
      rotate.textContent=autoRotate?"⏸ Pause":"⟳ Rotate";
    });
    const full=document.getElementById("airline3DFullscreen");
    if(full)full.addEventListener("click",()=>{
      const shell=document.querySelector(".airline-3d-card");
      if(shell?.requestFullscreen)shell.requestFullscreen().catch(()=>{});
    });
  }

  async function loadGeo(){
    try{
      const r=await fetch("destination-geo.json",{cache:"no-store"});
      if(r.ok)destinationGeo=await r.json();
    }catch(e){destinationGeo={destinations:{}};}
  }

  window.renderAirline3DMap=function(force){
    const host=document.getElementById("airline3DMap");
    if(!host || !dataReady())return;
    const model=buildModel();
    renderKpis(model);
    populateRouteFilters(model);
    renderRouteSelection(model);
    if(!initialized)makeGlobe();
    if(!globe)return;
    const sig=JSON.stringify([geoMode,model.rs.length,model.routes.slice(0,10).map(x=>[x.origin,x.destination,x.count]),model.destinations.slice(0,10).map(x=>[x.name,x.count]),model.airlines.slice(0,8).map(x=>[x.name,x.count])]);
    if(force || sig!==lastSignature){
      lastSignature=sig;
      renderLayers(model);
    }
    if(selectedDetail)renderDetail(selectedDetail.type,selectedDetail.obj,model);
  };

  window.Airline3DMap={
    reset:clearMapSelection,
    setMode:m=>{geoMode=m==="selected"?"selected":"considered";renderAirline3DMap(true)},
    focus,
    getMode:()=>geoMode
  };

  loadGeo().then(()=>{
    bindControls();
    // Give the existing app/enhancement lifecycle time to finish loading DATA/WORLD.
    setTimeout(()=>renderAirline3DMap(true),120);
  });
})();
