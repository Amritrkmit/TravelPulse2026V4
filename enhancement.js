
/* ================================================================
   TRAVEL PULSE ENHANCEMENT LAYER
   New charts: Q3 destination funnel, Q8a booking sequence waterfall,
   Q10a USD-normalised budget histogram, Q20 hotel star rating,
   Q4 trip nights donut, destination word cloud, future activities.
   All existing charts also re-sorted and max-axis fixed.
   ================================================================ */

/* ------ USD conversion rates (approximate 2026) ------ */
const USD_FX = {
  'Australia':0.63,'Bahrain':2.65,'Brazil':0.18,'Canada':0.73,'China':0.138,
  'Egypt':0.02,'France':1.08,'Germany':1.08,'India':0.012,'Indonesia':0.000063,
  'Italy':1.08,'Japan':0.0067,'Jordan':1.41,'Kenya':0.0077,'Malaysia':0.224,
  'Netherlands':1.08,'Nigeria':0.00062,'Qatar':0.274,'Russian Federation':0.011,
  'Saudi Arabia':0.267,'Singapore':0.743,'Korea, Republic of (South Korea)':0.00073,
  'Spain':1.08,'Switzerland':1.12,'Thailand':0.028,'Turkey':0.028,
  'United Arab Emirates':0.272,'United Kingdom':1.27,
  'United States of America':1.0,'South Africa':0.054,'Ireland':1.08
};

/* ------ Q3 Destination Funnel ------ */
function renderDestinationFunnel(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const rows = activeRows();
  const stageLabels = [
    {key:'yet', label:'Not yet started', match:'yet to start'},
    {key:'research', label:'Researching', match:'researching'},
    {key:'planning', label:'Planning itinerary', match:'planning my itin'},
    {key:'arranging', label:'Making arrangements', match:'making travel'},
    {key:'booked', label:'Already booked', match:'already booked'}
  ];

  // Count top destinations
  const destCount = new Map();
  rows.forEach(r => {
    (Array.isArray(r.Q3) ? r.Q3 : []).forEach(dest => {
      const d = (dest||'').trim().replace(/\b\w/g,c=>c.toUpperCase());
      if (d.length > 1) destCount.set(d, (destCount.get(d)||0)+1);
    });
  });
  const topDests = [...destCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([d])=>d);

  // For each dest, get funnel
  const funnelData = topDests.map(dest => {
    const dr = rows.filter(r => Array.isArray(r.Q3) && r.Q3.some(x=>x&&x.toLowerCase().includes(dest.toLowerCase())));
    return {
      dest,
      total: dr.length,
      stages: stageLabels.map(s => ({
        label: s.label,
        pct: dr.length ? dr.filter(r=>r.planningStage&&r.planningStage.toLowerCase().includes(s.match)).length/dr.length : 0
      }))
    };
  });

  const stageColors = ['#9b8dc1','#6f5a9e','#452080','#ff7f2a','#4eae68'];
  const w = Math.max(500, el.offsetWidth||650), h = Math.max(320, topDests.length*38+80);
  const m = {t:16,r:16,b:60,l:130}, iw=w-m.l-m.r, ih=h-m.t-m.b;

  d3.select(sel).selectAll('*').remove();
  const svg = d3.select(sel).append('svg').attr('width',w).attr('height',h);
  const g = svg.append('g').attr('transform',`translate(${m.l},${m.t})`);

  const y = d3.scaleBand().domain(topDests).range([0,ih]).padding(0.28);
  const x = d3.scaleLinear().domain([0,1]).range([0,iw]);

  // Stacked bars
  funnelData.forEach(fd => {
    let xoff = 0;
    fd.stages.forEach((s,si) => {
      const bw = x(s.pct);
      g.append('rect')
        .attr('x',xoff).attr('y',y(fd.dest)).attr('width',Math.max(0,bw)).attr('height',y.bandwidth())
        .attr('fill',stageColors[si]).attr('rx',si===0?4:0)
        .on('mousemove',(e)=>showTip(e,{label:`${fd.dest} · ${s.label}`,value:s.pct},true))
        .on('mouseleave',hideTip);
      if (bw > 22) {
        g.append('text').attr('x',xoff+bw/2).attr('y',y(fd.dest)+y.bandwidth()/2+4)
          .attr('text-anchor','middle').attr('font-size',9).attr('fill','#fff').attr('font-weight',700)
          .text(d3.format('.0%')(s.pct));
      }
      xoff += bw;
    });
    // total label
    g.append('text').attr('x',-8).attr('y',y(fd.dest)+y.bandwidth()/2+4)
      .attr('text-anchor','end').attr('font-size',10).attr('fill','#354056')
      .text(`${fd.dest} (n=${fd.total})`);
  });

  // Legend
  const leg = svg.append('g').attr('transform',`translate(${m.l},${h-m.b+14})`);
  stageLabels.forEach((s,si) => {
    const lx = si*(iw/stageLabels.length);
    leg.append('rect').attr('x',lx).attr('y',0).attr('width',12).attr('height',12).attr('fill',stageColors[si]).attr('rx',2);
    leg.append('text').attr('x',lx+16).attr('y',10).attr('font-size',9).attr('fill','#6f637c').text(s.label);
  });

  g.append('g').attr('class','axis').attr('transform',`translate(0,${ih})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.0%')));
}

/* ------ Q8a Booking Sequence Waterfall ------ */
function renderBookingSequence(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const rows = activeRows();
  const items = ['Flights','Visa','Hotel / accommodation',
    'Local transport','Activities & tours','Travel insurance'];
  const shortItems = ['Flights','Visa','Hotel','Transport','Activities','Insurance'];

  const data = items.map((item,i) => {
    const ranks = rows.map(r=>Array.isArray(r.Q8a)&&r.Q8a[i]?r.Q8a[i]:null).filter(Boolean);
    return {
      label: shortItems[i],
      full: item,
      first: rows.length ? rows.filter(r=>Array.isArray(r.Q8a)&&r.Q8a[i]===1).length/rows.length : 0,
      avgRank: ranks.length ? ranks.reduce((a,b)=>a+b,0)/ranks.length : 0
    };
  });

  const w = Math.max(400, el.offsetWidth||600), h = 280;
  const m = {t:20,r:20,b:60,l:40}, iw=w-m.l-m.r, ih=h-m.t-m.b;
  d3.select(sel).selectAll('*').remove();
  const svg = d3.select(sel).append('svg').attr('width',w).attr('height',h);
  const g = svg.append('g').attr('transform',`translate(${m.l},${m.t})`);

  const x = d3.scaleBand().domain(data.map(d=>d.label)).range([0,iw]).padding(0.28);
  const maxFirst = d3.max(data,d=>d.first)||0.6;
  const y = d3.scaleLinear().domain([0,maxFirst*1.15]).range([ih,0]);

  g.append('g').attr('class','gridline').call(d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat('')).select('.domain').remove();

  g.selectAll('rect.bar').data(data).join('rect').attr('class','bar')
    .attr('x',d=>x(d.label)).attr('y',d=>y(d.first))
    .attr('width',x.bandwidth()).attr('height',d=>Math.max(0,ih-y(d.first))).attr('rx',4)
    .attr('fill',(d,i)=>i===0?'#452080':'#9fded7')
    .on('mousemove',(e,d)=>showTip(e,{label:`${d.full} — first booked`,value:d.first},false))
    .on('mouseleave',hideTip);

  g.selectAll('text.val').data(data).join('text').attr('class','val')
    .attr('x',d=>x(d.label)+x.bandwidth()/2).attr('y',d=>Math.max(14,y(d.first)-5))
    .attr('text-anchor','middle').attr('font-size',10).attr('font-weight',800).attr('fill','#354056')
    .text(d=>fmt(d.first));

  // Avg rank line
  const y2 = d3.scaleLinear().domain([1,6]).range([0,ih]);
  const line = d3.line().x(d=>x(d.label)+x.bandwidth()/2).y(d=>y2(d.avgRank));
  g.append('path').datum(data).attr('d',line).attr('fill','none').attr('stroke','#ff7f2a').attr('stroke-width',2).attr('stroke-dasharray','4,3');
  g.selectAll('circle.avg').data(data).join('circle').attr('class','avg')
    .attr('cx',d=>x(d.label)+x.bandwidth()/2).attr('cy',d=>y2(d.avgRank)).attr('r',4)
    .attr('fill','#ff7f2a').attr('stroke','#fff').attr('stroke-width',1.5)
    .on('mousemove',(e,d)=>showTip(e,{label:`${d.full} — avg rank`,value:d.avgRank.toFixed(1)},true))
    .on('mouseleave',hideTip);

  const gx = g.append('g').attr('class','axis').attr('transform',`translate(0,${ih})`).call(d3.axisBottom(x).tickSize(0));
  gx.select('.domain').remove();
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(4).tickFormat(fmt));

  // Legend
  const leg = svg.append('g').attr('transform',`translate(${m.l},${h-14})`);
  leg.append('rect').attr('width',10).attr('height',10).attr('fill','#452080').attr('rx',2);
  leg.append('text').attr('x',14).attr('y',9).attr('font-size',9).attr('fill','#6f637c').text('% booked first');
  leg.append('line').attr('x1',110).attr('x2',122).attr('y1',5).attr('y2',5).attr('stroke','#ff7f2a').attr('stroke-width',2).attr('stroke-dasharray','4,3');
  leg.append('circle').attr('cx',116).attr('cy',5).attr('r',3).attr('fill','#ff7f2a');
  leg.append('text').attr('x',126).attr('y',9).attr('font-size',9).attr('fill','#6f637c').text('avg booking rank');
}

/* ------ Q10a USD Budget Histogram ------ */
function renderBudgetHistogram(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const rows = activeRows();
  const budgets = rows.map(r => {
    const v = r.Q10a, rate = USD_FX[r.Market];
    if (!v || !rate) return null;
    const usd = v * rate;
    return (usd >= 100 && usd <= 100000) ? usd : null;
  }).filter(Boolean);

  if (!budgets.length) { d3.select(sel).html('<div class="empty-chart">No budget data.</div>'); return; }

  const bins = [
    {label:'<$500',lo:0,hi:500},{label:'$500–1k',lo:500,hi:1000},
    {label:'$1–2k',lo:1000,hi:2000},{label:'$2–3.5k',lo:2000,hi:3500},
    {label:'$3.5–5k',lo:3500,hi:5000},{label:'$5–7.5k',lo:5000,hi:7500},
    {label:'$7.5–10k',lo:7500,hi:10000},{label:'$10–20k',lo:10000,hi:20000},
    {label:'>$20k',lo:20000,hi:Infinity}
  ];
  const data = bins.map(b => ({label:b.label, value:budgets.filter(v=>v>=b.lo&&v<b.hi).length/budgets.length}));
  const mean = budgets.reduce((a,b)=>a+b,0)/budgets.length;
  const median = [...budgets].sort((a,b)=>a-b)[Math.floor(budgets.length/2)];

  const w = Math.max(400,el.offsetWidth||600), h = 240;
  const m = {t:24,r:16,b:44,l:46}, iw=w-m.l-m.r, ih=h-m.t-m.b;
  d3.select(sel).selectAll('*').remove();

  // Stats above chart
  const stats = d3.select(sel).append('div').style('display','flex').style('gap','16px').style('margin-bottom','8px');
  [{label:'Mean',val:`$${Math.round(mean).toLocaleString()}`},{label:'Median',val:`$${Math.round(median).toLocaleString()}`},{label:'n',val:budgets.length}].forEach(s=>{
    const c=stats.append('div').style('font-size','11px');
    c.append('span').style('color','#8a7e98').style('font-size','9px').text(s.label+' ');
    c.append('strong').style('color','#452080').text(s.val);
  });

  const svg = d3.select(sel).append('svg').attr('width',w).attr('height',h);
  const g = svg.append('g').attr('transform',`translate(${m.l},${m.t})`);
  const x = d3.scaleBand().domain(data.map(d=>d.label)).range([0,iw]).padding(0.2);
  const y = d3.scaleLinear().domain([0,d3.max(data,d=>d.value)*1.2]).range([ih,0]);

  g.append('g').attr('class','gridline').call(d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat('')).select('.domain').remove();
  g.selectAll('rect').data(data).join('rect')
    .attr('x',d=>x(d.label)).attr('y',d=>y(d.value))
    .attr('width',x.bandwidth()).attr('height',d=>Math.max(0,ih-y(d.value))).attr('rx',4)
    .attr('fill',(d,i)=>i===3||i===4?'#452080':'#9fded7')
    .on('mousemove',(e,d)=>showTip(e,d)).on('mouseleave',hideTip);
  g.selectAll('text.val').data(data).join('text').attr('class','val')
    .attr('x',d=>x(d.label)+x.bandwidth()/2).attr('y',d=>Math.max(11,y(d.value)-4))
    .attr('text-anchor','middle').attr('font-size',9).attr('font-weight',800).attr('fill','#354056')
    .text(d=>d.value>0.02?fmt(d.value):'');
  const gx=g.append('g').attr('class','axis').attr('transform',`translate(0,${ih})`).call(d3.axisBottom(x).tickSize(0));
  gx.select('.domain').remove();
  gx.selectAll('text').attr('font-size',8.5);
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(4).tickFormat(fmt));
  svg.append('text').attr('x',m.l+iw/2).attr('y',h-2).attr('text-anchor','middle').attr('font-size',9).attr('fill','#8a7e98')
    .text('USD-normalised trip budget · approximate 2026 FX rates · outliers <$100 or >$100k excluded');
}

/* ------ Q20 Hotel Star Rating Donut ------ */
function renderHotelStarRating(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const data = q('Q20').filter(d=>d.value>0.005&&!d.label.includes('apply')).sort((a,b)=>b.value-a.value);
  donut(sel, data, 'Star rating');
}

/* ------ Q4 Trip Nights ------ */
function renderTripNights(sel) {
  const el = document.querySelector(sel); if(!el) return;
  const data = q('Q4').filter(d=>d.value>0.005).sort((a,b)=>{
    const order=['1–2 nights','3–4 nights','5–6 nights','7–8 nights','9–10 nights','10+ nights'];
    return order.indexOf(a.label)-order.indexOf(b.label);
  });
  horizontalBars(sel, data, {height: Math.max(200, data.length*28+55)});
}

/* ------ Destination Word Cloud (canvas-based) ------ */
function renderDestWordCloud(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const rows = activeRows();
  const destCount = new Map();
  rows.forEach(r => {
    (Array.isArray(r.Q3) ? r.Q3 : []).forEach(dest => {
      const d = (dest||'').trim().replace(/\b\w/g,c=>c.toUpperCase());
      if (d.length > 1 && d.length < 40) destCount.set(d,(destCount.get(d)||0)+1);
    });
  });
  const entries = [...destCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30);
  const total = entries.reduce((s,[,c])=>s+c,0)||1;

  const w = Math.max(400,el.offsetWidth||600), h = 200;
  d3.select(sel).selectAll('*').remove();
  const svg = d3.select(sel).append('svg').attr('width',w).attr('height',h);
  const colors = ['#452080','#9b8dc1','#6f5a9e','#ff7f2a','#4eae68','#ffb21a'];

  const maxCount = entries[0]?.[1]||1;
  const minFont = 10, maxFont = 36;
  let cx = 16, cy = 20, lineH = 0;
  entries.forEach(([dest,cnt],i) => {
    const fs = minFont + (cnt/maxCount)*(maxFont-minFont);
    const tw = dest.length * fs * 0.58;
    if (cx + tw > w - 16) { cx = 16; cy += lineH + 6; lineH = 0; }
    svg.append('text').attr('x',cx).attr('y',cy+fs*0.8)
      .attr('font-size',fs).attr('fill',colors[i%colors.length])
      .attr('font-family','Manrope,sans-serif').attr('font-weight',700).text(dest)
      .on('mousemove',(e)=>showTip(e,{label:dest,value:cnt/rows.length},true))
      .on('mouseleave',hideTip);
    cx += tw + 12;
    lineH = Math.max(lineH, fs);
  });
}

/* ------ Future Activities Bar ------ */
function renderFutureActivities(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const data = q('futureActivities').filter(d=>d.label!=='None of the above'&&d.value>0);
  horizontalBars(sel, data, {height: Math.max(200, data.length*30+55)});
}

/* ------ Q9a Experiences at destination ------ */
function renderDestExperiences(sel) {
  const el = document.querySelector(sel); if (!el) return;
  horizontalBars(sel, q('Q9a'), {height: Math.max(240, q('Q9a').length*28+55)});
}

/* ------ Q8b Package type ------ */
function renderPackageType(sel) {
  const el = document.querySelector(sel); if (!el) return;
  donut(sel, q('Q8b').filter(d=>d.value>0.005), 'Package');
}

/* ================================================================
   OVERRIDE RENDER FUNCTIONS with enhanced versions
   ================================================================ */

function renderOverview(){
  renderGlobalMap('#overviewMap','source');
  renderMapInsight('#mapInsight','source');
  renderKpis();
  renderSentimentPulse();
  horizontalBars('#planningChart',q('planningStage'),{height:260,max:0.65});
  donut('#purposeChart',q('tripPurpose').filter(d=>d.value>0.001),'Trip mix');
  horizontalBars('#timingChart',q('tripTiming'),{height:250,max:0.65});
  spend();
  // NEW: destination funnel + word cloud
  renderDestinationFunnel('#destFunnelChart');
  renderDestWordCloud('#destWordCloud');
  renderFutureActivities('#futureActivitiesChart');
  renderTTKpi('#ttLeisureKpi',  'LEISURE',  'Leisure');
  renderTTKpi('#ttBusinessKpi', 'BUSINESS', 'Business');
  renderTTKpi('#ttBleisureKpi', 'BLEISURE', 'Bleisure');
  renderOverviewInsight();
  renderTabQuestionExplorer('overview');
}

function renderSentimentPulse(){
  const rows=activeRows();
  const scoreMix=field=>{
    const scores=rows.map(r=>Number(r[field])).filter(Number.isFinite);
    const total=scores.length;
    return {
      total,
      nps:total?scores.reduce((sum,v)=>sum+(v>=9?1:v<=6?-1:0),0)/total*100:0,
      promoters:total?scores.filter(v=>v>=9).length/total:0,
      passives:total?scores.filter(v=>v>=7&&v<=8).length/total:0,
      detractors:total?scores.filter(v=>v<=6).length/total:0
    };
  };
  const airline=scoreMix('airlineNPS'), hotel=scoreMix('hotelNPS');
  const spend=rows.length?rows.filter(r=>/^Will increase/i.test(clean(r.spendChange))).length/rows.length:0;
  const ai=rows.length?rows.filter(r=>/^(Extremely|Somewhat) likely$/i.test(clean(r.aiLikelihood))).length/rows.length:0;
  const kpis=[
    ['Airline NPS',`${Math.round(airline.nps)}`,'Q15a'],
    ['Hotel NPS',`${Math.round(hotel.nps)}`,'Q21a'],
    ['Spend increasing',fmt(spend),'Q10'],
    ['AI adoption',fmt(ai),'Q9b']
  ];
  const kpiRoot=document.querySelector('#sentimentPulseKpis');
  if(kpiRoot)kpiRoot.innerHTML=kpis.map((item,i)=>`<article class="sentiment-pulse-kpi sentiment-pulse-kpi-${i}"><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]} · n=${rows.length.toLocaleString()}</small></article>`).join('');
  const chart=document.querySelector('#sentimentPulseChart');
  if(!chart)return;
  const groups=[{label:'Airline',...airline},{label:'Hotel',...hotel}];
  d3.select(chart).selectAll('*').remove();
  if(!rows.length){d3.select(chart).append('div').attr('class','empty-chart').text('No sentiment data for this selection.');return;}
  const width=Math.max(420,chart.clientWidth||720), height=190, margin={top:18,right:24,bottom:34,left:80}, innerWidth=width-margin.left-margin.right, innerHeight=height-margin.top-margin.bottom;
  const svg=d3.select(chart).append('svg').attr('width',width).attr('height',height);
  const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  const x=d3.scaleLinear().domain([0,1]).range([0,innerWidth]), y=d3.scaleBand().domain(groups.map(d=>d.label)).range([0,innerHeight]).padding(.35), sub=d3.scaleBand().domain(['promoters','passives','detractors']).range([0,y.bandwidth()]).padding(.16);
  const colors={promoters:'#3db87e',passives:'#ffb21a',detractors:'#d9384a'};
  g.append('g').attr('class','axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  groups.forEach(row=>['promoters','passives','detractors'].forEach(key=>g.append('rect').attr('x',0).attr('y',y(row.label)+sub(key)).attr('width',x(row[key])).attr('height',sub.bandwidth()).attr('fill',colors[key]).attr('rx',2)));
  g.append('g').attr('class','axis').attr('transform',`translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(5).tickFormat(fmt));
  const legend=svg.append('g').attr('transform',`translate(${margin.left},4)`);
  [['Promoters','promoters'],['Passives','passives'],['Detractors','detractors']].forEach(([label,key],i)=>{legend.append('rect').attr('x',i*92).attr('width',9).attr('height',9).attr('fill',colors[key]);legend.append('text').attr('x',i*92+13).attr('y',8).attr('font-size',8).attr('fill','#6f637c').text(label);});
}

function renderSocial(){
  const all=DATA?.socialRecords||[];
  const picker=document.querySelector('#socialWaveSelect');
  if(picker&&!picker.dataset.bound){picker.dataset.bound='1';picker.addEventListener('change',renderSocial);}
  const wave=picker?.value||'all';
  const rows=wave==='all'?all:all.filter(r=>clean(r.wave)===wave);
  const countBy=(field,limit=10)=>[...d3.rollup(rows,v=>v.length,r=>clean(r[field])).entries()]
    .filter(d=>d[0]).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(d=>({label:d[0],value:d[1]/Math.max(1,rows.length)}));
  const sentiment=countBy('sentiment',3), positive=rows.filter(r=>clean(r.sentiment)==='Positive').length, negative=rows.filter(r=>clean(r.sentiment)==='Negative').length;
  const kpis=[['Social mentions',rows.length.toLocaleString(),'Brandwatch'],['Positive',fmt(positive/Math.max(1,rows.length)),'Sentiments'],['Neutral',fmt(rows.filter(r=>clean(r.sentiment)==='Neutral').length/Math.max(1,rows.length)),'Sentiments'],['Negative',fmt(negative/Math.max(1,rows.length)),'Sentiments']];
  const root=document.querySelector('#socialKpis');
  if(root)root.innerHTML=kpis.map((x,i)=>`<article class="social-kpi"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');
  d3.select('#socialInsight').text(`${rows.length.toLocaleString()} Brandwatch records · ${wave==='all'?'all waves':wave} · ${fmt((rows.length-negative)/Math.max(1,rows.length))} non-negative conversation`);
  horizontalBars('#socialSentimentChart',sentiment,{height:180,max:Math.max(.1,(sentiment[0]?.value||.1)*1.15)});
  horizontalBars('#socialThemeChart',countBy('themes'),{height:Math.max(230,countBy('themes').length*28+55),max:Math.max(.1,(countBy('themes')[0]?.value||.1)*1.15)});
  horizontalBars('#socialDestinationChart',countBy('destination'),{height:Math.max(230,countBy('destination').length*28+55),max:Math.max(.1,(countBy('destination')[0]?.value||.1)*1.15)});
  horizontalBars('#socialMarketChart',countBy('sourceMarket'),{height:Math.max(230,countBy('sourceMarket').length*28+55),max:Math.max(.1,(countBy('sourceMarket')[0]?.value||.1)*1.15)});
  renderSocialWaveChart(rows);
}

function renderSocialWaveChart(activeRows){
  const el=document.querySelector('#socialWaveChart'); if(!el)return;
  const source=DATA?.socialRecords||[], waves=[...new Set(source.map(r=>clean(r.wave)).filter(Boolean))].sort();
  const values=waves.map(w=>{const rows=source.filter(r=>clean(r.wave)===w), total=rows.length||1;return {wave:w,Positive:rows.filter(r=>clean(r.sentiment)==='Positive').length/total,Neutral:rows.filter(r=>clean(r.sentiment)==='Neutral').length/total,Negative:rows.filter(r=>clean(r.sentiment)==='Negative').length/total};});
  const width=Math.max(420,el.clientWidth||650),height=210,margin={top:20,right:18,bottom:42,left:60},iw=width-margin.left-margin.right,ih=height-margin.top-margin.bottom;
  d3.select(el).selectAll('*').remove(); const svg=d3.select(el).append('svg').attr('width',width).attr('height',height),g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  const x=d3.scaleBand().domain(waves).range([0,iw]).padding(.25),y=d3.scaleLinear().domain([0,1]).range([ih,0]),colors={Positive:'#3db87e',Neutral:'#ffb21a',Negative:'#d9384a'};
  g.append('g').attr('class','axis').attr('transform',`translate(0,${ih})`).call(d3.axisBottom(x)); g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(4).tickFormat(fmt));
  values.forEach(row=>{let offset=0;['Positive','Neutral','Negative'].forEach(key=>{const h=row[key];g.append('rect').attr('x',x(row.wave)).attr('y',y(offset+h)).attr('width',x.bandwidth()).attr('height',y(offset)-y(offset+h)).attr('fill',colors[key]);offset+=h;});});
  const legend=svg.append('g').attr('transform',`translate(${margin.left},5)`);['Positive','Neutral','Negative'].forEach((key,i)=>{legend.append('rect').attr('x',i*78).attr('width',9).attr('height',9).attr('fill',colors[key]);legend.append('text').attr('x',i*78+13).attr('y',8).attr('font-size',8).attr('fill','#6f637c').text(key);});
}

function renderAirline(){
  if (typeof renderAirline3DMap === 'function') renderAirline3DMap();
  renderGlobalMap('#airlineMap','airline');
  renderMapInsight('#airlineMapInsight','airline');
  horizontalBars('#carrierChart',q('airlineCarrier'),{height:290,max:0.15});
  const nps=byLabel('airlineNPS','NPS Score');
  gauge('#airlineNpsGauge',nps,{domain:[-100,100],format:d3.format('.0f'),label:'NPS',sub:`${selectionLabel(activeSelections)} airline recommend score`,color:npsColor(nps)});
  horizontalBars('#airlineConsiderChart',q('airlineConsiderations'),{height:300,max:0.45});
  donut('#cabinChart',specificQ('cabinClass',filterDim==='Class'&&currentTab==='airline'?activeSelections:[]),'Cabin',filterDim==='Class'&&currentTab==='airline'?activeSelections:[]);
  donut('#airlineLoyaltyChart',q('airlineLoyaltyImportance').filter(d=>!d.label.startsWith('NET')),'Importance');
  horizontalBars('#airlineStrategyChart',q('airlineStrategies'),{height:300,max:0.75});
  renderAirlineLoyaltyFeatures('#airlineLoyaltyFeatChart');
  renderAirlineInsight();
  renderNpsMix('#airlineSentimentMix','airlineCarrier','airlineNPS','Airline');
  renderTabQuestionExplorer('airline');
}

function renderHotel(){
  renderHotelKpis();
  renderGlobalMap('#hotelMap','hotel');
  renderMapInsight('#hotelMapInsight','hotel');
  horizontalBars('#stayChart',specificQ('accommodation',filterDim==='Class'&&currentTab==='hotel'?activeSelections:[]),{height:275,max:0.8,selected:filterDim==='Class'&&currentTab==='hotel'?activeSelections:[]});
  const nps=byLabel('hotelNPS','NPS Score');
  gauge('#hotelNpsGauge',nps,{domain:[-100,100],format:d3.format('.0f'),label:'NPS',sub:`${selectionLabel(activeSelections)} hotel recommend score`,color:npsColor(nps)});
  horizontalBars('#hotelConsiderChart',q('hotelConsiderations'),{height:300,max:0.45});
  donut('#hotelLoyaltyChart',q('hotelLoyaltyImportance').filter(d=>!d.label.startsWith('NET')),'Importance');
  horizontalBars('#hotelStrategyChart',q('hotelStrategies'),{height:300,max:0.7});
  horizontalBars('#hotelFeaturesChart',q('hotelLoyaltyFeatures'),{height:270,max:0.75});
  if(DATA.questions.hotelBrand){
    horizontalBars('#hotelBrandChart',q('hotelBrand'),{height:Math.max(320,q('hotelBrand').length*28+55)});
  }
  // NEW: Q20 star rating, Q10a USD budget
  renderHotelStarRating('#hotelStarChart');
  renderBudgetHistogram('#budgetHistChart');
  renderHotelInsight();
  renderNpsMix('#hotelSentimentMix','hotelBrand','hotelNPS','Hotel');
  renderTabQuestionExplorer('hotel');
}

function renderHotelKpis(){
  const el=document.querySelector('#hotelKpis');
  if(!el) return;
  const groups=new Map();
  activeRows().forEach(r=>{
    const brand=clean(r.hotelBrand);
    const score=Number(r.hotelNPS);
    if(!brand||!Number.isFinite(score)) return;
    const item=groups.get(brand)||{brand,scores:[]};
    item.scores.push(score);
    groups.set(brand,item);
  });
  const cards=[...groups.values()]
    .map(x=>({...x,nps:x.scores.length?(x.scores.filter(v=>v>=9).length-x.scores.filter(v=>v<=6).length)/x.scores.length*100:0}))
    .sort((a,b)=>b.scores.length-a.scores.length).slice(0,8);
  el.innerHTML=cards.map((x,i)=>`<article class="hotel-kpi-card hotel-kpi-${i%5}">
    <span class="hotel-kpi-score">${Math.round(x.nps)}</span>
    <div><strong>${escapeHtml(x.brand)}</strong><small>Hotel NPS · ${x.scores.length} respondents</small></div>
  </article>`).join('');
}

function renderDestination(){
  const rows=activeRows();
  const total=rows.length||1;
  const destinations=new Map();
  rows.forEach(r=>{
    (Array.isArray(r.Q3)?r.Q3:[]).forEach(raw=>{
      const label=clean(raw); if(!label)return;
      const item=destinations.get(label)||{label,total:0,booked:0,planning:0};
      item.total++;
      const stage=clean(r.planningStage).toLowerCase();
      if(clean(r.Q3a).toLowerCase().includes(label.toLowerCase())||stage.includes('booked')||stage.includes('arrangements')) item.booked++;
      else if(stage.includes('research')||stage.includes('planning')||stage.includes('itinerary')) item.planning++;
      destinations.set(label,item);
    });
  });
  const top=[...destinations.values()].sort((a,b)=>b.total-a.total).slice(0,12);
  const topDestination=top[0];
  const booked=top.reduce((n,d)=>n+d.booked,0), planning=top.reduce((n,d)=>n+d.planning,0);
  d3.select('#destinationInsight').html(topDestination
    ? `<b>${escapeHtml(topDestination.label)}</b> is the most considered destination (${fmt(topDestination.total/total)} of active respondents). ${fmt(booked/Math.max(1,top.reduce((n,d)=>n+d.total,0)))} of top destination mentions are booked or arranged.`
    : 'No destination mentions match the current filters.');
  const kpis=[
    ['Top destination',topDestination?.label||'—'],
    ['Destination mentions',top.reduce((n,d)=>n+d.total,0).toLocaleString()],
    ['Booked / arranged',booked.toLocaleString()],
    ['Actively planning',planning.toLocaleString()]
  ];
  d3.select('#destinationKpis').html(kpis.map((x,i)=>`<article class="destination-kpi destination-kpi-${i}"><span>${escapeHtml(x[0])}</span><strong>${escapeHtml(x[1])}</strong></article>`).join(''));
  horizontalBars('#destinationIntentChart',top.map(d=>({label:d.label,value:d.total/total})),{height:Math.max(300,top.length*30+55),max:Math.max(.1,(top[0]?.total||1)/total*1.15)});
  horizontalBars('#destinationStatusChart',[
    {label:'Booked / arranged',value:booked/Math.max(1,top.reduce((n,d)=>n+d.total,0))},
    {label:'Actively planning',value:planning/Math.max(1,top.reduce((n,d)=>n+d.total,0))},
    {label:'Early consideration',value:Math.max(0,1-(booked+planning)/Math.max(1,top.reduce((n,d)=>n+d.total,0)))}
  ],{height:190,max:1});
  const reach=top.map(d=>({
    label:d.label,
    value:new Set(rows.filter(r=>Array.isArray(r.Q3)&&r.Q3.some(x=>clean(x).toLowerCase()===d.label.toLowerCase())).map(r=>r.Market)).size/Math.max(1,MARKETS.length)
  })).sort((a,b)=>b.value-a.value);
  horizontalBars('#destinationReachChart',reach,{height:Math.max(280,reach.length*28+55),max:Math.max(.1,d3.max(reach,d=>d.value)||.1)*1.1});
  d3.select('#destinationMarketTable').html(`<div class="destination-table-head"><span>Source market</span><span>Top destination</span><span>Mentions</span><span>Booked / arranged</span></div>`+REGIONS.flatMap(region=>{
    const marketRows=rows.filter(r=>r.Region===region), counts=new Map();
    marketRows.forEach(r=>(Array.isArray(r.Q3)?r.Q3:[]).forEach(raw=>counts.set(clean(raw),(counts.get(clean(raw))||0)+1)));
    const best=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
    if(!best)return [];
    const marketBooked=marketRows.filter(r=>clean(r.Q3a).toLowerCase().includes(best[0].toLowerCase())||/booked|arrangements/i.test(clean(r.planningStage))).length;
    return `<div class="destination-table-row"><strong>${escapeHtml(shortRegion(region))}</strong><span>${escapeHtml(best[0])}</span><span>${best[1]}</span><span>${marketBooked}</span></div>`;
  }).join(''));
  renderDestinationStageMix(top,rows);
}

function renderNpsMix(sel,field,scoreField,label){
  const picker=document.querySelector(`#${sel.slice(1)}Type`);
  if(picker&&!picker.dataset.bound){picker.dataset.bound='1';picker.addEventListener('change',()=>renderNpsMix(sel,field,scoreField,label));}
  renderNpsMixChart(sel,field,scoreField,label,picker?.value||'grouped');
}

function renderNpsMixChart(sel,field,scoreField,label,mode){
  const el=document.querySelector(sel); if(!el)return;
  const groups=new Map();
  activeRows().forEach(r=>{
    const name=clean(r[field]), score=Number(r[scoreField]);
    if(!name||!Number.isFinite(score))return;
    const item=groups.get(name)||{label:name,promoters:0,passives:0,detractors:0,total:0};
    if(score>=9)item.promoters++; else if(score>=7)item.passives++; else item.detractors++;
    item.total++; groups.set(name,item);
  });
  const rows=[...groups.values()].sort((a,b)=>b.total-a.total).slice(0,10);
  d3.select(sel).selectAll('*').remove();
  if(!rows.length){d3.select(sel).append('div').attr('class','empty-chart').text('No comparison data for this selection.');return;}
  if(mode==='pie'){
    const totals=['promoters','passives','detractors'].map(key=>({label:key[0].toUpperCase()+key.slice(1),value:rows.reduce((n,r)=>n+r[key],0)}));
    donut(sel,totals,`${label} sentiment`); return;
  }
  if(mode==='line'){drawComparisonLine(sel,rows,d=>((d.promoters-d.detractors)/d.total*100),`${label} NPS`);return;}
  const width=Math.max(560,el.clientWidth||700), rowHeight=30, height=rows.length*rowHeight+42, margin={top:22,right:48,bottom:20,left:175};
  const innerWidth=width-margin.left-margin.right;
  const svg=d3.select(sel).append('svg').attr('width',width).attr('height',height);
  const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  const y=d3.scaleBand().domain(rows.map(d=>d.label)).range([0,rows.length*rowHeight]).padding(.25);
  const sub=d3.scaleBand().domain(['promoters','passives','detractors']).range([0,y.bandwidth()]).padding(.18);
  const x=d3.scaleLinear().domain([0,1]).range([0,innerWidth]);
  g.append('g').attr('class','axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  rows.forEach(row=>{if(mode==='stacked'){let offset=0;[['promoters','#4eae68','Promoters'],['passives','#ffb21a','Passives'],['detractors','#ef476f','Detractors']].forEach(([key,color,title])=>{const pct=row[key]/row.total;g.append('rect').attr('x',x(offset)).attr('y',y(row.label)+y.bandwidth()*.2).attr('width',x(pct)).attr('height',y.bandwidth()*.6).attr('fill',color).attr('rx',2).on('mousemove',e=>showTip(e,{label:`${row.label} · ${title}`,value:`${fmt(pct)} · n=${row.total}`},true)).on('mouseleave',hideTip);offset+=pct;});}else{[['promoters','#4eae68','Promoters'],['passives','#ffb21a','Passives'],['detractors','#ef476f','Detractors']].forEach(([key,color,title])=>{const pct=row[key]/row.total;g.append('rect').attr('x',0).attr('y',y(row.label)+sub(key)).attr('width',x(pct)).attr('height',sub.bandwidth()).attr('fill',color).attr('rx',2).on('mousemove',e=>showTip(e,{label:`${row.label} · ${title}`,value:`${fmt(pct)} · n=${row.total}`},true)).on('mouseleave',hideTip);});}g.append('text').attr('x',Math.min(innerWidth+4,x(1)+4)).attr('y',y(row.label)+y.bandwidth()/2+4).attr('font-size',9).attr('font-weight',800).attr('fill','#452080').text(`n=${row.total}`);});
  const legend=svg.append('g').attr('transform',`translate(${margin.left},8)`);
  [['Promoters','#4eae68'],['Passives','#ffb21a'],['Detractors','#ef476f']].forEach(([text,color],i)=>{legend.append('rect').attr('x',i*92).attr('width',9).attr('height',9).attr('fill',color);legend.append('text').attr('x',i*92+13).attr('y',8).attr('font-size',8).attr('fill','#6f637c').text(text);});
}

function drawComparisonLine(sel,rows,valueFor,label){
  const el=document.querySelector(sel); if(!el)return;
  d3.select(sel).selectAll('*').remove();
  const width=Math.max(560,el.clientWidth||700),height=260,margin={top:28,right:45,bottom:55,left:48};
  const svg=d3.select(sel).append('svg').attr('width',width).attr('height',height);
  const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`),iw=width-margin.left-margin.right,ih=height-margin.top-margin.bottom;
  const values=rows.map(valueFor),x=d3.scalePoint().domain(rows.map(d=>d.label)).range([0,iw]).padding(.4),y=d3.scaleLinear().domain([d3.min(values.concat([0]))-5,d3.max(values.concat([0]))+5]).range([ih,0]);
  g.append('g').attr('class','gridline').call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat('')).select('.domain').remove();
  g.append('path').datum(rows).attr('fill','none').attr('stroke','#452080').attr('stroke-width',2.5).attr('d',d3.line().x(d=>x(d.label)).y(d=>y(valueFor(d))));
  g.selectAll('circle').data(rows).join('circle').attr('cx',d=>x(d.label)).attr('cy',d=>y(valueFor(d))).attr('r',5).attr('fill','#ff7f2a').attr('stroke','#fff').attr('stroke-width',2).on('mousemove',(e,d)=>showTip(e,{label:`${d.label} · ${label}`,value:`${d3.format('.0f')(valueFor(d))} · n=${d.total||'—'}`},true)).on('mouseleave',hideTip);
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(5).tickFormat(d=>`${d}%`)).select('.domain').remove();
  const xAxis=g.append('g').attr('class','axis').attr('transform',`translate(0,${ih})`).call(d3.axisBottom(x).tickSize(0));xAxis.select('.domain').remove();xAxis.selectAll('text').attr('transform','rotate(-35)').attr('text-anchor','end').attr('font-size',8);
}

function renderDestinationStageMix(top,rows){
  const picker=document.querySelector('#destinationStageMixType');
  if(picker&&!picker.dataset.bound){picker.dataset.bound='1';picker.addEventListener('change',()=>renderDestinationStageMix(top,rows));}
  const mode=picker?.value||'grouped';
  const el=document.querySelector('#destinationStageMix'); if(!el)return;
  const data=top.slice(0,8).map(dest=>{
    const matching=rows.filter(r=>Array.isArray(r.Q3)&&r.Q3.some(x=>clean(x).toLowerCase()===dest.label.toLowerCase()));
    const counts={research:0,planning:0,arranged:0,booked:0};
    matching.forEach(r=>{const stage=clean(r.planningStage).toLowerCase();if(stage.includes('booked'))counts.booked++;else if(stage.includes('arrangement'))counts.arranged++;else if(stage.includes('planning')||stage.includes('itinerary'))counts.planning++;else counts.research++;});
    return {label:dest.label,total:matching.length,...counts};
  }).filter(d=>d.total);
  d3.select('#destinationStageMix').selectAll('*').remove();
  if(!data.length){d3.select('#destinationStageMix').append('div').attr('class','empty-chart').text('No planning-stage data for this selection.');return;}
  if(mode==='pie'){
    donut('#destinationStageMix',['research','planning','arranged','booked'].map(key=>({label:key[0].toUpperCase()+key.slice(1),value:data.reduce((n,r)=>n+r[key],0)})),'Planning stage'); return;
  }
  if(mode==='line'){drawComparisonLine('#destinationStageMix',data,d=>d.booked/d.total*100,'Booked readiness');return;}
  const width=Math.max(560,el.clientWidth||700), height=data.length*30+42, margin={top:22,right:20,bottom:20,left:175}, innerWidth=width-margin.left-margin.right;
  const svg=d3.select('#destinationStageMix').append('svg').attr('width',width).attr('height',height),g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  const y=d3.scaleBand().domain(data.map(d=>d.label)).range([0,data.length*30]).padding(.25),x=d3.scaleLinear().domain([0,1]).range([0,innerWidth]);
  g.append('g').attr('class','axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  const sub=d3.scaleBand().domain(['research','planning','arranged','booked']).range([0,y.bandwidth()]).padding(.15);
  data.forEach(row=>{if(mode==='stacked'){let offset=0;[['research','#9b8dc1','Researching'],['planning','#452080','Planning'],['arranged','#ffb21a','Arrangements'],['booked','#4eae68','Booked']].forEach(([key,color,title])=>{const pct=row[key]/row.total;g.append('rect').attr('x',x(offset)).attr('y',y(row.label)+y.bandwidth()*.2).attr('width',x(pct)).attr('height',y.bandwidth()*.6).attr('fill',color).attr('rx',2).on('mousemove',e=>showTip(e,{label:`${row.label} · ${title}`,value:`${fmt(pct)} · n=${row.total}`},true)).on('mouseleave',hideTip);offset+=pct;});}else{[['research','#9b8dc1','Researching'],['planning','#452080','Planning'],['arranged','#ffb21a','Arrangements'],['booked','#4eae68','Booked']].forEach(([key,color,title])=>{const pct=row[key]/row.total;g.append('rect').attr('x',0).attr('y',y(row.label)+sub(key)).attr('width',x(pct)).attr('height',sub.bandwidth()).attr('fill',color).attr('rx',2).on('mousemove',e=>showTip(e,{label:`${row.label} · ${title}`,value:`${fmt(pct)} · n=${row.total}`},true)).on('mouseleave',hideTip);});}});
  [['Researching','#9b8dc1'],['Planning','#452080'],['Arrangements','#ffb21a'],['Booked','#4eae68']].forEach(([text,color],i)=>{svg.append('rect').attr('x',margin.left+i*105).attr('y',8).attr('width',9).attr('height',9).attr('fill',color);svg.append('text').attr('x',margin.left+i*105+13).attr('y',16).attr('font-size',8).attr('fill','#6f637c').text(text);});
}

/* ================================================================
   GAP FIXES — Q11/Q11a spend strategies, Q16b loyalty features,
   TT traveller-type KPI tiles
   ================================================================ */

/* ------ TT Traveller-Type KPI tile ------ */
function renderTTKpi(sel, ttType, label) {
  const el = document.querySelector(sel); if (!el) return;
  const rows = activeRows();
  const total = rows.length || 1;
  const count = rows.filter(r => r['Trip Type'] === ttType).length;
  const pct = count / total;
  const colors = { LEISURE: '#452080', BUSINESS: '#ff7f2a', BLEISURE: '#4eae68' };
  const color = colors[ttType] || '#452080';

  el.innerHTML = '';
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:90px;gap:4px;';
  div.innerHTML = `
    <div style="font-size:32px;font-weight:800;font-family:Manrope,sans-serif;color:${color};line-height:1">${d3.format('.1%')(pct)}</div>
    <div style="font-size:9px;color:#8a7e98;font-weight:700;text-transform:uppercase;letter-spacing:.05em">${count.toLocaleString()} of ${total.toLocaleString()} respondents</div>
    <div style="width:100%;max-width:120px;height:4px;background:#eee8f7;border-radius:2px;overflow:hidden;">
      <div style="height:100%;border-radius:2px;background:${color};width:${(pct*100).toFixed(1)}%"></div>
    </div>`;
  el.appendChild(div);
}

/* ------ Q11a Spend Increase strategies ------ */
function renderSpendIncrease(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const rows = activeRows().filter(r => String(r.spendChange || '').startsWith('Will increase'));
  const base = rows.length;
  if (!base) { d3.select(sel).html('<div class="empty-chart">No respondents planning to increase spend in current filter.</div>'); return; }
  const def = DATA.questions['Q11a'];
  if (!def) return;
  const data = (def.items || []).map(it => ({
    label: it.label,
    value: rows.filter(r => Array.isArray(r['Q11a']) && r['Q11a'].includes(it.label)).length / base
  })).filter(d => d.value > 0 && !d.label.toLowerCase().startsWith('other'));
  data.sort((a, b) => b.value - a.value);
  // Add base note
  d3.select(sel).append('div')
    .style('font-size','9px').style('color','#8a7e98').style('padding','4px 6px')
    .text(`Base: ${base.toLocaleString()} respondents planning to increase spend`);
  horizontalBars(sel, data, { height: Math.max(300, data.length * 28 + 55) });
}

/* ------ Q11 Spend Reduction strategies ------ */
function renderSpendDecrease(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const rows = activeRows().filter(r => String(r.spendChange || '').toLowerCase().includes('decrease'));
  const base = rows.length;
  if (!base) {
    d3.select(sel).html('<div class="empty-chart" style="padding:20px;text-align:center;font-size:10px;color:#8a7e98;">No respondents planning to decrease spend in current filter.<br><small>This question is conditional on Q10 = "Will decrease"</small></div>');
    return;
  }
  const def = DATA.questions['Q11'];
  if (!def) return;
  const data = (def.items || []).map(it => ({
    label: it.label,
    value: rows.filter(r => Array.isArray(r['Q11']) && r['Q11'].includes(it.label)).length / base
  })).filter(d => d.value > 0 && !d.label.toLowerCase().startsWith('other'));
  data.sort((a, b) => b.value - a.value);
  d3.select(sel).append('div')
    .style('font-size','9px').style('color','#8a7e98').style('padding','4px 6px')
    .text(`Base: ${base.toLocaleString()} respondents planning to decrease spend`);
  horizontalBars(sel, data, { height: Math.max(200, data.length * 28 + 55) });
}

/* ------ Q16b Airline Loyalty Features ------ */
function renderAirlineLoyaltyFeatures(sel) {
  const el = document.querySelector(sel); if (!el) return;
  const data = q('airlineLoyaltyFeatures')
    .filter(d => d.value > 0 && !d.label.toLowerCase().startsWith('other'))
    .sort((a, b) => b.value - a.value);
  horizontalBars(sel, data, { height: Math.max(280, data.length * 28 + 55) });
}

/* === Gap fixes called from existing render functions === */



/* ================================================================
   Q10 + Q3 INTERACTION FIXES
   - Q10 composite bars now filter against the real Q10 answers.
   - Q3 destination funnel is clickable by destination.
   - Funnel tooltips always show percentages.
   - Clicking a selected item again clears that chart filter.
   ================================================================ */

/* Q10 uses display labels (Increase/Same/Decrease/Unsure), while the
   underlying records contain the full Q10 answer text. */
function questionMatches(r, key, label) {
  if (key === "spendChange") {
    const v = String(r?.spendChange ?? "").trim().toLowerCase();
    const l = String(label ?? "").trim().toLowerCase();

    if (l === "increase") return v.startsWith("will increase");
    if (l === "same") return v.includes("remain the same");
    if (l === "decrease") return v.startsWith("will decrease");
    if (l === "unsure") return v.includes("can’t say") || v.includes("can't say");

    return v === l;
  }

  /* Q3 is free-text / multi-value. Match destination case-insensitively
     so the display-cased funnel labels work with the original responses. */
  if (key === "Q3") {
    const wanted = String(label ?? "").trim().toLowerCase();
    if (!wanted) return false;
    return Array.isArray(r?.Q3) &&
      r.Q3.some(v => String(v ?? "").trim().toLowerCase() === wanted);
  }

  /* Preserve the existing application's matching rules for everything else. */
  if (key === "Q18" || key === "Q24") return matrixRowMatches(r, key, label);
  if (key === "Q8a") {
    const def = surveyDefinition(key);
    const idx = (def?.items || []).findIndex(it => clean(it.label) === clean(label));
    return idx >= 0 && Array.isArray(r[key]) && Number(r[key][idx]) === 1;
  }
  if (key === "Q10a") return Number(r[key]) === Number(label);
  if (key === "Age Group") {
    return label === "25–44"
      ? ["25-34", "35-44"].includes(r["Age Group"])
      : clean(r["Age Group"]) === clean(label);
  }
  if (key === "Region") {
    return clean(r.Region) === clean(label) || clean(shortRegion(r.Region)) === clean(label);
  }
  if (key === "aiLikelihood" && label === "Top 2 Box") {
    return ["Extremely likely", "Somewhat likely"].includes(clean(r[key]));
  }
  if (key === "aiLikelihood" && label === "Bottom 2 Box") {
    return ["Somewhat unlikely", "Extremely unlikely"].includes(clean(r[key]));
  }
  if (key === "airlineLoyaltyImportance" || key === "hotelLoyaltyImportance") {
    if (label === "NET : Top 2 Box")
      return ["Extremely important", "Very important"].includes(clean(r[key]));
    if (label === "NET : Bottom 2 Box")
      return ["Slightly important", "Not at all important"].includes(clean(r[key]));
  }

  const v = r[key];
  if (Array.isArray(v)) return v.includes(label);

  if (key === "airlineNPS" || key === "hotelNPS" || key === "Q15a" || key === "Q21a") {
    if (label === "NPS Score") return Number.isFinite(Number(v));
    const n = Number(String(label).match(/\d+/)?.[0]);
    return Number(v) === n;
  }

  return clean(v) === clean(label);
}

/* Add Q3 to the common chart-filter registry. */
function chartFilterKey(sel) {
  const el = document.querySelector(sel);
  if (el?.dataset?.surveyKey) return el.dataset.surveyKey;

  const id = String(sel).replace(/^#/, "");
  const map = {
    planningChart:"planningStage",
    purposeChart:"tripPurpose",
    timingChart:"tripTiming",
    spendChart:"spendChange",
    infoChart:"infoChannels",
    companionChart:"travelCompanions",
    bookingChart:"bookingChannels",
    decisionList:"decisionFactors",
    experienceChart:"experiences",
    leadTimeChart:"planningLeadTime",
    aiTasksChart:"aiTasks",
    carrierChart:"airlineCarrier",
    airlineConsiderChart:"airlineConsiderations",
    cabinChart:"cabinClass",
    airlineLoyaltyChart:"airlineLoyaltyImportance",
    airlineStrategyChart:"airlineStrategies",
    stayChart:"accommodation",
    hotelConsiderChart:"hotelConsiderations",
    hotelLoyaltyChart:"hotelLoyaltyImportance",
    hotelStrategyChart:"hotelStrategies",
    hotelFeaturesChart:"hotelLoyaltyFeatures",
    hotelBrandChart:"hotelBrand",
    regionSpendBar:"Region",
    regionResearchBar:"Region",
    ageLine:"Age Group",
    destFunnelChart:"Q3",
    destinationIntentChart:"Q3"
  };
  return map[id] || null;
}

/* Q3 funnel: destination click + percentage tooltips. */
function renderDestinationFunnel(sel) {
  const el = document.querySelector(sel);
  if (!el) return;

  const rows = activeRows();
  const selected = chartFilters?.Q3 || null;

  const stageLabels = [
    {key:'yet',       label:'Not yet started',    match:'yet to start'},
    {key:'research',  label:'Researching',        match:'researching'},
    {key:'planning',  label:'Planning itinerary', match:'planning my itin'},
    {key:'arranging', label:'Making arrangements',match:'making travel'},
    {key:'booked',    label:'Already booked',     match:'already booked'}
  ];

  const destCount = new Map();
  rows.forEach(r => {
    (Array.isArray(r.Q3) ? r.Q3 : []).forEach(dest => {
      const raw = String(dest ?? "").trim();
      const d = raw.replace(/\b\w/g, c => c.toUpperCase());
      if (d.length > 1) destCount.set(d, (destCount.get(d) || 0) + 1);
    });
  });

  const topDests = [...destCount.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0,8)
    .map(([d]) => d);

  const funnelData = topDests.map(dest => {
    const wanted = dest.toLowerCase();
    const dr = rows.filter(r =>
      Array.isArray(r.Q3) &&
      r.Q3.some(x => String(x ?? "").trim().toLowerCase() === wanted)
    );

    return {
      dest,
      total: dr.length,
      stages: stageLabels.map(s => ({
        label: s.label,
        pct: dr.length
          ? dr.filter(r =>
              String(r.planningStage ?? "").toLowerCase().includes(s.match)
            ).length / dr.length
          : 0
      }))
    };
  });

  const stageColors = ['#9b8dc1','#6f5a9e','#452080','#ff7f2a','#4eae68'];
  const w = Math.max(500, el.offsetWidth || 650);
  const h = Math.max(320, topDests.length * 38 + 80);
  const m = {t:16,r:16,b:60,l:130};
  const iw = w - m.l - m.r;
  const ih = h - m.t - m.b;

  d3.select(sel).selectAll('*').remove();

  if (!rows.length || !topDests.length) {
    d3.select(sel).append('div')
      .attr('class','empty-chart')
      .text('No data available for this selection.');
    return;
  }

  const svg = d3.select(sel)
    .append('svg')
    .attr('width', w)
    .attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`);

  const g = svg.append('g')
    .attr('transform', `translate(${m.l},${m.t})`);

  const y = d3.scaleBand()
    .domain(topDests)
    .range([0, ih])
    .padding(0.28);

  const x = d3.scaleLinear()
    .domain([0,1])
    .range([0,iw]);

  funnelData.forEach(fd => {
    let xoff = 0;

    fd.stages.forEach((s,si) => {
      const bw = x(s.pct);

      const rect = g.append('rect')
        .attr('x', xoff)
        .attr('y', y(fd.dest))
        .attr('width', Math.max(0,bw))
        .attr('height', y.bandwidth())
        .attr('fill', stageColors[si])
        .attr('rx', si === 0 ? 4 : 0)
        .style('cursor', 'pointer')
        .attr('opacity', selected && selected !== fd.dest ? 0.45 : 1);

      rect
        .on('mousemove', e => {
          showTip(e, {
            label: `${fd.dest} · ${s.label}`,
            value: d3.format('.1%')(s.pct)
          }, true);
        })
        .on('mouseleave', hideTip)
        .on('click', e => {
          e.stopPropagation();
          toggleChartFilter('Q3', fd.dest);
        });

      if (bw > 22) {
        g.append('text')
          .attr('x', xoff + bw/2)
          .attr('y', y(fd.dest) + y.bandwidth()/2 + 4)
          .attr('text-anchor','middle')
          .attr('font-size',9)
          .attr('fill','#fff')
          .attr('font-weight',700)
          .style('pointer-events','none')
          .text(d3.format('.0%')(s.pct));
      }

      xoff += bw;
    });

    g.append('text')
      .attr('x', -8)
      .attr('y', y(fd.dest) + y.bandwidth()/2 + 4)
      .attr('text-anchor','end')
      .attr('font-size',10)
      .attr('fill', selected === fd.dest ? '#452080' : '#354056')
      .attr('font-weight', selected === fd.dest ? 800 : 400)
      .style('cursor','pointer')
      .text(`${fd.dest} (n=${fd.total})`)
      .on('mousemove', e => showTip(e, {
        label: fd.dest,
        value: d3.format('.1%')(fd.total / Math.max(rows.length,1))
      }, true))
      .on('mouseleave', hideTip)
      .on('click', e => {
        e.stopPropagation();
        toggleChartFilter('Q3', fd.dest);
      });
  });

  const leg = svg.append('g')
    .attr('transform', `translate(${m.l},${h-m.b+14})`);

  stageLabels.forEach((s,si) => {
    const lx = si * (iw/stageLabels.length);
    leg.append('rect')
      .attr('x',lx).attr('y',0)
      .attr('width',12).attr('height',12)
      .attr('fill',stageColors[si]).attr('rx',2);

    leg.append('text')
      .attr('x',lx+16).attr('y',10)
      .attr('font-size',9)
      .attr('fill','#6f637c')
      .text(s.label);
  });

  g.append('g')
    .attr('class','axis')
    .attr('transform',`translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.0%')));
}

/* Q3 word cloud: clicking a destination applies the same Q3 filter. */
/* ================================================================
   Q3 · DESTINATIONS CONSIDERED
   TRUE WORD-CLOUD LAYOUT
   - Large dominant word in centre
   - Smaller words around it
   - Horizontal + vertical + diagonal words
   - Collision-free spiral placement
   - Real survey frequencies
   - Tooltip shows %
   - Click destination to filter dashboard
   ================================================================ */

function renderDestWordCloud(sel) {
  const el = document.querySelector(sel);
  if (!el) return;

  const rows = activeRows();

  d3.select(sel).selectAll("*").remove();

  if (!rows.length) {
    d3.select(sel)
      .append("div")
      .attr("class", "empty-chart")
      .text("No data available for this selection.");
    return;
  }

  /* ---------------------------------------------------------------
     COLLECT DESTINATIONS
     Keep the ORIGINAL destination text so chart filtering works
     against the actual Q3 array values.
     --------------------------------------------------------------- */

  const counts = new Map();

  rows.forEach(r => {
  if (!Array.isArray(r.Q3)) return;

  r.Q3.forEach(value => {
    const raw = String(value || "").trim();

    if (!raw) return;
    if (raw.length < 2 || raw.length > 45) return;

    // REMOVE Urdu / Arabic-script entries
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(raw)) {
      return;
    }

    const key = raw.toLowerCase();

    if (!counts.has(key)) {
      counts.set(key, {
        label: raw,
        count: 1
      });
    } else {
      counts.get(key).count++;
    }
  });
});

  const words = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 45);

  if (!words.length) {
    d3.select(sel)
      .append("div")
      .attr("class", "empty-chart")
      .text("No destination data available.");
    return;
  }

  /* ---------------------------------------------------------------
     SIZE
     Make the most-mentioned destination dramatically larger.
     --------------------------------------------------------------- */

  const maxCount = words[0].count;
  const minSize = 12;
  const maxSize = Math.min(
    64,
    Math.max(46, (el.offsetWidth || 650) * 0.075)
  );

  words.forEach((d, i) => {
    const ratio = d.count / maxCount;

    /*
      Non-linear scaling gives the leader a strong visual presence,
      similar to the reference image.
    */
    d.size =
      minSize +
      Math.pow(ratio, 0.58) * (maxSize - minSize);

    /* Mostly horizontal, but deliberately introduce vertical /
       diagonal words like the reference. */
    if (i === 0) {
      d.angle = 0;
    } else {
      const angles = [
        0,
        0,
        0,
        0,
        90,
        -90,
        45,
        -45
      ];

      d.angle = angles[i % angles.length];
    }

    d.weight = i < 3 ? 800 : 650;
  });

  /* ---------------------------------------------------------------
     RESPONSIVE CANVAS
     --------------------------------------------------------------- */

  const width = Math.max(
    500,
    el.clientWidth || 650
  );

  const height = Math.max(
    270,
    Math.min(
      380,
      270 + words.length * 1.8
    )
  );

  const svg = d3.select(sel)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  /* Reference-like muted palette */
  const palette = [
    "#4b6508",
    "#5b7410",
    "#6d7f17",
    "#334d1d",
    "#254d38",
    "#6d552d",
    "#805b25",
    "#4f4628",
    "#71811b"
  ];

  const selected =
    typeof chartFilters !== "undefined"
      ? chartFilters.Q3
      : null;

  /* ---------------------------------------------------------------
     WORD PLACEMENT
     --------------------------------------------------------------- */

  const placed = [];

  function estimatedBox(d, x, y) {

    const textWidth =
      Math.max(
        12,
        d.label.length * d.size * 0.53
      );

    const textHeight =
      d.size * 1.05;

    const rad = Math.abs(d.angle) * Math.PI / 180;

    const rotatedWidth =
      Math.abs(textWidth * Math.cos(rad)) +
      Math.abs(textHeight * Math.sin(rad));

    const rotatedHeight =
      Math.abs(textWidth * Math.sin(rad)) +
      Math.abs(textHeight * Math.cos(rad));

    return {
      x1: x - rotatedWidth / 2 - 3,
      y1: y - rotatedHeight / 2 - 3,
      x2: x + rotatedWidth / 2 + 3,
      y2: y + rotatedHeight / 2 + 3
    };
  }

  function collision(a, b) {
    return !(
      a.x2 < b.x1 ||
      a.x1 > b.x2 ||
      a.y2 < b.y1 ||
      a.y1 > b.y2
    );
  }

  function inside(box) {
    return (
      box.x1 > 4 &&
      box.y1 > 4 &&
      box.x2 < width - 4 &&
      box.y2 < height - 4
    );
  }

  /* ---------------------------------------------------------------
     SPIRAL SEARCH
     Starts in centre and expands outward.
     This is what makes it look like a genuine word cloud rather
     than a grid/list.
     --------------------------------------------------------------- */

  function findPosition(d, index) {

    const cx = width / 2;
    const cy = height / 2;

    /*
      Slightly move the largest word upward so the cloud feels
      balanced like the supplied reference.
    */
    const startY =
      index === 0
        ? cy - 4
        : cy;

    let angle = index * 0.71;
    let radius = index === 0 ? 0 : 4;

    for (let step = 0; step < 2600; step++) {

      if (index === 0) {
        const box = estimatedBox(
          d,
          cx,
          startY
        );

        if (inside(box)) {
          return {
            x: cx,
            y: startY,
            box
          };
        }

        break;
      }

      /*
        Archimedean spiral.
      */
      angle += 0.22;
      radius += 0.72;

      const x =
        cx +
        Math.cos(angle) * radius;

      const y =
        startY +
        Math.sin(angle) *
        radius *
        0.68;

      const box = estimatedBox(
        d,
        x,
        y
      );

      if (!inside(box)) continue;

      let hit = false;

      for (const p of placed) {
        if (collision(box, p)) {
          hit = true;
          break;
        }
      }

      if (!hit) {
        return {
          x,
          y,
          box
        };
      }
    }

    return null;
  }

  /* ---------------------------------------------------------------
     DRAW WORDS
     --------------------------------------------------------------- */

  words.forEach((d, i) => {

    const pos = findPosition(d, i);

    if (!pos) return;

    placed.push(pos.box);

    const pct =
      d.count / Math.max(rows.length, 1);

    const isSelected =
      selected &&
      String(selected).toLowerCase() ===
      String(d.label).toLowerCase();

    const text = svg.append("text")
      .attr("x", pos.x)
      .attr("y", pos.y)
      .attr(
        "transform",
        `rotate(${d.angle},${pos.x},${pos.y})`
      )
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-family",
        "Arial, Helvetica, sans-serif"
      )
      .attr("font-size", d.size)
      .attr("font-weight",
        isSelected ? 900 : d.weight
      )
      .attr("fill",
        isSelected
          ? "#452080"
          : palette[i % palette.length]
      )
      .style("cursor", "pointer")
      .style(
        "opacity",
        selected && !isSelected
          ? 0.38
          : 1
      )
      .style(
        "transition",
        "opacity .15s ease, transform .15s ease"
      )
      .text(d.label);

    /* -------------------------------------------------------------
       TOOLTIP
       ------------------------------------------------------------- */

    text
      .on("mousemove", function(e) {

        showTip(
          e,
          {
            label: d.label,
            value: d3.format(".1%")(pct)
          },
          true
        );

      })
      .on("mouseleave", function() {
        hideTip();
      });

    /* -------------------------------------------------------------
       CLICK = GLOBAL Q3 FILTER
       ------------------------------------------------------------- */

    text.on("click", function(e) {

      e.stopPropagation();

      if (
        typeof toggleChartFilter === "function"
      ) {
        toggleChartFilter(
          "Q3",
          d.label
        );
      }

    });
  });

  /* ---------------------------------------------------------------
     SMALL FOOTNOTE
     --------------------------------------------------------------- */

  svg.append("text")
    .attr("x", width - 8)
    .attr("y", height - 7)
    .attr("text-anchor", "end")
    .attr("font-size", 9)
    .attr("fill", "#9b93a4")
    .text(
      "Size = destination mentions · Click to filter"
    );
}
