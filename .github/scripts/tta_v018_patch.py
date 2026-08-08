from pathlib import Path

p=Path('torn-trade-analyzer.user.js')
s=p.read_text()

assert '// @version      0.1.7' in s
assert "const VERSION = '0.1.7';" in s
s=s.replace('// @version      0.1.7','// @version      0.1.8',1)
s=s.replace("const VERSION = '0.1.7';","const VERSION = '0.1.8';",1)
s=s.replace('Automatically discover item history for the selected period, calculate FIFO realized profit, and chart profit by day/week/month. Data stays on-device.','Fast, period-aware Torn trade analytics with cached FIFO calculations, responsive search/sort/pins, and progressive loading. Data stays on-device.',1)

# Ephemeral busy/loading UI state.
old="""    syncCancel: false,\n    toast: '',\n    demo: false,"""
new="""    syncCancel: false,\n    toast: '',\n    busy: {active:false,title:'',detail:'',cancellable:false},\n    demo: false,"""
assert old in s
s=s.replace(old,new,1)

# Performance/UX CSS additions. Keep existing theme but reduce off-screen layout work and add loading surfaces.
css_anchor="""    `;\n    document.head.appendChild(s);"""
assert css_anchor in s
css=r'''      .tta-item{content-visibility:auto;contain-intrinsic-size:118px;transition:border-color .14s ease,transform .14s ease}.tta-item.expanded{content-visibility:visible}.tta-itemtop:active{background:#1a2530}.tta-btn,.tta-chip,.tta-iconbtn,.tta-back,.tta-pin{transition:transform .12s ease,background .12s ease,border-color .12s ease,opacity .12s ease}
      .tta-periodhint{display:block;margin-top:3px;color:var(--tta-faint);font-size:9px;line-height:1.35}.tta-status-banner{display:flex;align-items:flex-start;gap:8px}.tta-status-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:var(--tta-blue);margin-top:4px;box-shadow:0 0 10px #7fc1ff66}
      .tta-searchwrap{position:relative;min-width:0}.tta-searchglyph{position:absolute;left:11px;top:50%;transform:translateY(-50%);z-index:1;color:var(--tta-faint);font-size:15px;pointer-events:none}.tta-searchwrap .tta-history-search{padding-left:34px;padding-right:39px}.tta-clearsearch{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:31px;height:31px;min-width:31px;min-height:31px;border:0;border-radius:8px;background:transparent;color:var(--tta-muted)!important;font-size:18px;padding:0}.tta-clearsearch[hidden]{display:none}.tta-sortbtn{min-width:126px}
      .tta-liststage{min-height:80px}.tta-listmeta strong{color:var(--tta-text)}
      .tta-loading{position:fixed;inset:0;z-index:2147483001;display:none;place-items:center;background:#05080bd9;padding:20px;pointer-events:auto}.tta-loading.show{display:grid}.tta-loadingcard{width:min(420px,94vw);background:#111a23;border:1px solid #3b5266;border-radius:18px;padding:18px;box-shadow:0 22px 70px #000b;text-align:center}.tta-loadicon{width:52px;height:52px;margin:0 auto 12px;border-radius:16px;background:#172632;border:1px solid #345269;display:grid;place-items:center}.tta-spinner.xl{width:24px;height:24px;border-width:3px}.tta-loadingtitle{font-size:15px;font-weight:900;color:var(--tta-text);line-height:1.3}.tta-loadingdetail{min-height:34px;margin-top:7px;color:var(--tta-muted);font-size:11px;line-height:1.5}.tta-loadingbar{height:4px;margin:13px 0 12px;overflow:hidden;border-radius:999px;background:#091018}.tta-loadingbar span{display:block;width:38%;height:100%;border-radius:inherit;background:var(--tta-green);animation:tta-load-slide 1.25s ease-in-out infinite}@keyframes tta-load-slide{0%{transform:translateX(-120%)}50%{transform:translateX(165%)}100%{transform:translateX(310%)}}.tta-loadingactions{display:flex;justify-content:center;margin-top:5px}.tta-loadinghint{margin-top:9px;color:var(--tta-faint);font-size:9px;line-height:1.4}
      .tta-openloader{position:absolute;inset:0;display:grid;place-items:center;background:var(--tta-bg);color:var(--tta-muted);text-align:center;padding:24px}.tta-openloader>div{display:flex;flex-direction:column;align-items:center;gap:11px}.tta-openloader strong{color:var(--tta-text);font-size:14px}.tta-openloader small{font-size:10px;color:var(--tta-faint)}
      .tta-toast{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .16s ease,transform .16s ease,visibility .16s}.tta-toast.show{opacity:1;visibility:visible;transform:translate(-50%,-4px)}
      #tta-root[aria-busy="true"] .tta-shell{overflow:hidden}
      @media(prefers-reduced-motion:reduce){.tta-loadingbar span,.tta-spinner{animation-duration:2.2s}.tta-item,.tta-btn,.tta-chip,.tta-iconbtn,.tta-back,.tta-pin,.tta-toast{transition:none}}
'''
s=s.replace(css_anchor,css+css_anchor,1)

# Reopening is instant when the existing DOM is still valid; only first open gets a loading shell.
old="fab.addEventListener('click',e=>{if(fab.dataset.suppressClick==='1'){e.preventDefault();e.stopPropagation();return;}state.open=true;render();});"
new="fab.addEventListener('click',e=>{if(fab.dataset.suppressClick==='1'){e.preventDefault();e.stopPropagation();return;}openAnalyzer();});"
assert old in s
s=s.replace(old,new,1)

# Replace repeated full-array scans with a transaction index and reusable caches.
a=s.index('  function effectiveTransactions() {')
b=s.index('\n  const SORT_OPTIONS=[',a)
cache_block=r'''  let demoTxCache=null;
  const perfCache={
    txRef:null,byItem:new Map(),lastById:new Map(),itemIds:[],fifo:new Map(),summaries:new Map(),series:new Map(),overall:new Map(),
    catalogRef:null,catalogMap:new Map(),trackedTxRef:null,trackedCatalogRef:null,tracked:[],searchTimer:null,legacySearchTimer:null
  };

  function resetAnalyticsCache() {
    perfCache.txRef=null;perfCache.byItem=new Map();perfCache.lastById=new Map();perfCache.itemIds=[];
    perfCache.fifo.clear();perfCache.summaries.clear();perfCache.series.clear();perfCache.overall.clear();
    perfCache.trackedTxRef=null;perfCache.trackedCatalogRef=null;perfCache.tracked=[];
  }

  function effectiveTransactions() {
    if (state.transactions.length || !state.demo) return state.transactions;
    if(!demoTxCache)demoTxCache=demoTransactions();
    return demoTxCache;
  }

  function ensureTxIndex() {
    const tx=effectiveTransactions();
    if(perfCache.txRef===tx)return perfCache;
    const byItem=new Map(),lastById=new Map();
    for(const t of tx){
      const id=Number(t?.itemId);if(!(id>0))continue;
      if(!byItem.has(id))byItem.set(id,[]);
      byItem.get(id).push(t);
      const ts=Number(t?.timestamp)||0;if(ts>(lastById.get(id)||0))lastById.set(id,ts);
    }
    for(const rows of byItem.values())rows.sort((a,b)=>a.timestamp-b.timestamp||String(a.id).localeCompare(String(b.id)));
    perfCache.txRef=tx;perfCache.byItem=byItem;perfCache.lastById=lastById;perfCache.itemIds=[...byItem.keys()];
    perfCache.fifo.clear();perfCache.summaries.clear();perfCache.series.clear();perfCache.overall.clear();
    perfCache.trackedTxRef=null;perfCache.trackedCatalogRef=null;perfCache.tracked=[];
    return perfCache;
  }

  function getCatalogMap() {
    if(perfCache.catalogRef===state.catalog)return perfCache.catalogMap;
    perfCache.catalogRef=state.catalog;
    perfCache.catalogMap=new Map((state.catalog||[]).map(x=>[Number(x.id),x]));
    perfCache.trackedCatalogRef=null;
    return perfCache.catalogMap;
  }

  function catalogItem(id) {
    id=Number(id);
    const found=getCatalogMap().get(id);
    return found || {id,name:`Item #${id}`,type:'Item',image:`https://www.torn.com/images/items/${id}/large.png`,marketPrice:0};
  }

  function effectiveTracked() {
    const idx=ensureTxIndex();
    if(!idx.itemIds.length&&state.demo)return demoTracked();
    if(perfCache.trackedTxRef===idx.txRef&&perfCache.trackedCatalogRef===state.catalog)return perfCache.tracked;
    perfCache.tracked=idx.itemIds.map(catalogItem).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
    perfCache.trackedTxRef=idx.txRef;perfCache.trackedCatalogRef=state.catalog;
    return perfCache.tracked;
  }

  function periodCacheKey() {
    const r=dateRange();
    return `${state.dateMode}|${state.customFrom}|${state.customTo}|${Math.floor(r.from/60)}|${Math.floor(r.to/60)}`;
  }
'''
s=s[:a]+cache_block+s[b:]

# history list now reuses the indexed last-activity map.
a=s.index('  function historyItemRows() {')
b=s.index('\n\n  function subtractCalendarMonth',a)
history_block=r'''  function historyItemRows() {
    const q=String(state.itemSearch||'').trim().toLowerCase();
    const pinned=new Set((state.pinnedIds||[]).map(Number));
    const idx=ensureTxIndex();
    const rows=effectiveTracked()
      .filter(item=>!q || item.name.toLowerCase().includes(q) || String(item.id).includes(q))
      .map(item=>({item,summary:summaryFor(item.id),lastActivity:idx.lastById.get(Number(item.id))||0,pinned:pinned.has(Number(item.id))}))
      .filter(row=>row.summary.events.length>0);
    rows.sort((a,b)=>{
      if(a.pinned!==b.pinned)return a.pinned?-1:1;
      let d=0;
      if(state.sortMode==='profit')d=b.summary.profit-a.summary.profit;
      else if(state.sortMode==='acquired')d=b.summary.bought-a.summary.bought;
      else if(state.sortMode==='sold')d=b.summary.sold-a.summary.sold;
      else if(state.sortMode==='name')d=a.item.name.localeCompare(b.item.name);
      else d=b.lastActivity-a.lastActivity;
      return d || a.item.name.localeCompare(b.item.name) || a.item.id-b.item.id;
    });
    return rows;
  }'''
s=s[:a]+history_block+s[b:]

# Avoid large spread arguments for All history.
old="if(state.dateMode==='all'&&allTx.length)from=Math.min(...allTx.map(x=>x.timestamp));"
new="if(state.dateMode==='all'&&allTx.length){from=Infinity;for(const x of allTx){const ts=Number(x?.timestamp);if(Number.isFinite(ts)&&ts<from)from=ts;}if(!Number.isFinite(from))from=0;}"
assert old in s
s=s.replace(old,new,1)

# Cached FIFO, summaries, totals and chart series. FIFO uses a queue head instead of Array.shift().
a=s.index('  function fifoAnalytics(itemId) {')
b=s.index('\n\n  function chartSvg',a)
analytics_block=r'''  function fifoAnalytics(itemId) {
    const id=Number(itemId),idx=ensureTxIndex();
    if(perfCache.fifo.has(id))return perfCache.fifo.get(id);
    const tx=idx.byItem.get(id)||[];
    const lots=[];let lotHead=0;const events=[];
    for(const t of tx){
      if(t.side==='buy'){
        if(t.qty>0&&t.total>=0)lots.push({qty:t.qty,unit:t.qty?t.total/t.qty:0});
        events.push({...t,realizedProfit:0,matchedQty:0,unmatchedQty:0});
      }else if(t.side==='sell'){
        let remain=t.qty,basis=0,matched=0;
        while(remain>0&&lotHead<lots.length){
          const lot=lots[lotHead],take=Math.min(remain,lot.qty);
          basis+=take*lot.unit;matched+=take;remain-=take;lot.qty-=take;
          if(lot.qty<=1e-9)lotHead++;
        }
        const net=t.netTotal??t.total;
        const matchedRevenue=t.qty>0?net*(matched/t.qty):0;
        events.push({...t,costBasis:basis,realizedProfit:matchedRevenue-basis,matchedQty:matched,unmatchedQty:remain});
      }
    }
    let remainingQty=0,remainingCost=0;
    for(let i=lotHead;i<lots.length;i++){remainingQty+=lots[i].qty;remainingCost+=lots[i].qty*lots[i].unit;}
    const result={events,remainingQty,remainingCost};perfCache.fifo.set(id,result);return result;
  }

  function summaryFor(itemId) {
    const id=Number(itemId),key=`${periodCacheKey()}|${id}`;
    if(perfCache.summaries.has(key))return perfCache.summaries.get(key);
    const {from,to}=dateRange(),a=fifoAnalytics(id),events=[];let bought=0,sold=0,buySpend=0,sellRevenue=0,profit=0,unmatched=0;const sources=new Set();
    for(const x of a.events){
      if(x.timestamp<from||x.timestamp>to)continue;
      events.push(x);
      if(x.side==='buy'){bought+=x.qty;buySpend+=x.total;if(x.source)sources.add(x.source);}
      else if(x.side==='sell'){sold+=x.qty;sellRevenue+=(x.netTotal??x.total);profit+=(x.realizedProfit||0);unmatched+=(x.unmatchedQty||0);}
    }
    const result={bought,sold,buySpend,sellRevenue,profit,sources:[...sources],unmatched,events,remainingQty:a.remainingQty,remainingCost:a.remainingCost};
    perfCache.summaries.set(key,result);return result;
  }

  function overall() {
    const key=periodCacheKey();if(perfCache.overall.has(key))return perfCache.overall.get(key);
    let profit=0,bought=0,sold=0,unmatched=0;
    for(const id of ensureTxIndex().itemIds){const x=summaryFor(id);profit+=x.profit;bought+=x.bought;sold+=x.sold;unmatched+=x.unmatched;}
    const result={profit,bought,sold,unmatched};perfCache.overall.set(key,result);return result;
  }

  function profitSeries(itemId=null) {
    const cacheKey=`${periodCacheKey()}|${state.granularity}|${itemId==null?'all':Number(itemId)}`;
    if(perfCache.series.has(cacheKey))return perfCache.series.get(cacheKey);
    const {from,to}=dateRange(),m=new Map(),ids=itemId!=null?[Number(itemId)]:ensureTxIndex().itemIds;
    const keyFn=state.granularity==='week'?weekKey:state.granularity==='month'?monthKey:dayKey;
    for(const id of ids){
      for(const x of fifoAnalytics(id).events){
        if(x.side!=='sell'||x.timestamp<from||x.timestamp>to)continue;
        const k=keyFn(x.timestamp);m.set(k,(m.get(k)||0)+(x.realizedProfit||0));
      }
    }
    const result=[...m.entries()].sort((a,b)=>a[0]-b[0]).map(([t,v])=>({t,v}));perfCache.series.set(cacheKey,result);return result;
  }'''
s=s[:a]+analytics_block+s[b:]

# Dashboard list is independently refreshable; closed cards no longer build hidden chart/details HTML.
a=s.index('  function dashboardHtml() {')
b=s.index('\n\n  function addItemHtml',a)
dash_block=r'''  function pinnedCountFor(items) {
    const pins=new Set((state.pinnedIds||[]).map(Number));let n=0;for(const x of items)if(pins.has(Number(x.id)))n++;return n;
  }

  function itemListMetaText(rows,allItems) {
    return `${qty(rows.length)} in this period · ${qty(allItems.length)} discovered total · ${qty(pinnedCountFor(allItems))} pinned`;
  }

  function itemListHtml(rows,allItems) {
    if(rows.length)return rows.map(r=>itemCard(r.item,r.summary)).join('');
    if(state.itemSearch)return `<div class="tta-empty">No items match “${esc(state.itemSearch)}” in this period.</div>`;
    return `<div class="tta-empty">${allItems.length?'No item activity exists in the selected period. Try a longer period or Sync to backfill it.':'No item history has been discovered yet. Press Sync to scan your Torn logs.'}</div>`;
  }

  function renderItemList() {
    if(state.view!=='dashboard')return;
    const list=document.getElementById('tta-item-list');if(!list)return;
    const shell=document.querySelector('#tta-root .tta-shell'),scroll=shell?.scrollTop||0;
    const rows=historyItemRows(),allItems=effectiveTracked();
    list.innerHTML=itemListHtml(rows,allItems);
    const meta=document.getElementById('tta-list-meta');if(meta)meta.textContent=itemListMetaText(rows,allItems);
    const count=document.getElementById('tta-item-count');if(count)count.textContent=qty(rows.length);
    const sort=document.getElementById('tta-sort-btn');if(sort)sort.textContent=`⇅ ${sortLabel()}`;
    const clear=document.querySelector('[data-act="clearItemSearch"]');if(clear)clear.hidden=!state.itemSearch;
    if(shell)shell.scrollTop=scroll;
  }

  function dashboardHtml() {
    const s=overall(),rows=historyItemRows(),allItems=effectiveTracked(),range=dateRange();
    const requested=selectedPeriodBounds();
    const coverageFrom=Number(state.sync?.coverageFrom);
    const needsBackfill=hasApiKey()&&state.sync?.firstSyncComplete&&requested.from>0&&(!Number.isFinite(coverageFrom)||coverageFrom>requested.from);
    const periodLabel=state.dateMode==='all'?'All available history':`${dateStr(range.from)} – ${dateStr(Math.min(range.to,nowSec()))}`;
    const lastSync=state.sync?.lastSync?`Last sync ${new Date(state.sync.lastSync*1000).toLocaleString()}`:'Not synced yet';
    return `${header('Trade Analyzer', `v${VERSION} · optimized FIFO analytics`)}<div class="tta-content">
      ${!hasApiKey()?`<div class="tta-banner"><strong>Preview mode.</strong> Add your Torn API key in <strong>Settings → API Key</strong> (or use Torn PDA's injected key) to load your real history. The key and analyzed data stay on this device.</div>`:''}
      ${hasApiKey()&&!state.sync?.autoDiscoveryComplete?`<div class="tta-banner"><strong>History discovery:</strong> Run Sync once to discover recognizable acquisitions and sales for your selected period.</div>`:''}
      ${needsBackfill?`<div class="tta-banner"><strong>More history needed:</strong> This period starts ${esc(dateStr(requested.from))}, earlier than the local cache. Press <strong>Sync</strong> to backfill it.</div>`:''}
      <div class="tta-period"><div><small>Date period</small><strong>${esc(periodLabel)}</strong><span class="tta-periodhint">${esc(lastSync)} · ${qty(state.transactions.length)} cached rows</span></div><button class="tta-btn secondary" data-act="sync" ${state.syncing?'disabled':''}>${state.syncing?'<span class="tta-sync"><span class="tta-spinner"></span>Syncing</span>':'↻ Sync history'}</button></div>
      ${state.syncProgress?`<div class="tta-banner tta-status-banner"><span class="tta-status-dot"></span><span id="tta-sync-progress-text">${esc(state.syncProgress)}</span></div>`:''}
      <div class="tta-chips">${[['7d','7 days'],['30d','30 days'],['month','1 month'],['all','All'],['custom','Custom']].map(([k,l])=>`<button class="tta-chip ${state.dateMode===k?'active':''}" data-date="${k}">${l}</button>`).join('')}</div>
      ${state.dateMode==='custom'?`<div class="tta-customdates"><input type="date" data-custom="from" value="${esc(state.customFrom)}"><input type="date" data-custom="to" value="${esc(state.customTo)}"></div>`:''}
      <div class="tta-summary"><div class="tta-stat main"><label>Realized profit</label><b class="${s.profit>=0?'pos':'neg'}">${money(s.profit)}</b></div><div class="tta-stat"><label>Acquired</label><b>${qty(s.bought)}</b></div><div class="tta-stat"><label>Sold</label><b>${qty(s.sold)}</b></div></div>
      <div class="tta-chartcard"><div class="tta-charthead"><h3>Profit earned</h3><div class="tta-seg">${['day','week','month'].map(g=>`<button class="${state.granularity===g?'active':''}" data-gran="${g}">${g[0].toUpperCase()+g.slice(1)}</button>`).join('')}</div></div>${chartSvg(profitSeries())}</div>
      <div class="tta-sectionhead"><h3>Items in selected period · <span id="tta-item-count">${qty(rows.length)}</span></h3></div>
      <div class="tta-listtools"><div class="tta-searchwrap"><span class="tta-searchglyph">⌕</span><input id="tta-history-search" class="tta-history-search" placeholder="Search item name or ID…" value="${esc(state.itemSearch||'')}" autocomplete="off" aria-label="Search discovered items"><button class="tta-clearsearch" data-act="clearItemSearch" aria-label="Clear search" ${state.itemSearch?'':'hidden'}>×</button></div><button id="tta-sort-btn" class="tta-btn secondary tta-sortbtn" data-act="cycleSort" title="Tap to change sorting">⇅ ${esc(sortLabel())}</button></div>
      <div id="tta-list-meta" class="tta-listmeta">${esc(itemListMetaText(rows,allItems))}</div>
      <div id="tta-item-list" class="tta-liststage">${itemListHtml(rows,allItems)}</div>
    </div>`;
  }

  function itemCard(item,precomputed=null) {
    const s=precomputed||summaryFor(item.id),exp=Number(state.expanded)===Number(item.id);
    const pinned=(state.pinnedIds||[]).map(Number).includes(Number(item.id));
    const src=s.sources.length?s.sources.slice(0,3).join(' · '):'No acquisitions in selected period';
    let details='';
    if(exp){
      const series=profitSeries(item.id),avgBuy=s.bought?s.buySpend/s.bought:0,avgSell=s.sold?s.sellRevenue/s.sold:0;
      const freeQty=s.events.filter(x=>x.side==='buy'&&x.free).reduce((n,x)=>n+x.qty,0);
      details=`<div class="tta-minirow"><div class="tta-ministat"><small>Avg cost</small><b>${money(avgBuy,true)}</b></div><div class="tta-ministat"><small>Avg sell</small><b>${money(avgSell,true)}</b></div><div class="tta-ministat"><small>Inventory</small><b>${qty(s.remainingQty)}</b></div></div><div class="tta-charthead"><h3>${esc(item.name)} profit</h3><small>${s.events.length} events</small></div>${chartSvg(series,92)}<div class="tta-note">Profit uses FIFO: each sale is matched against your oldest recorded acquisitions. ${s.unmatched?`⚠ ${qty(s.unmatched)} sold item(s) have no earlier recorded acquisition cost, so those units are excluded from realized profit.`:'All sold units in this period have recorded cost basis.'}${freeQty?` · ${qty(freeQty)} free-acquired item(s) use a $0 cost basis.`:''}</div>`;
    }
    return `<div class="tta-item ${exp?'expanded':''}" data-item="${item.id}"><div class="tta-itemtop" data-act="toggleItem" data-id="${item.id}" role="button" tabindex="0" aria-expanded="${exp?'true':'false'}">${itemIcon(item)}<div class="tta-itemcopy"><div class="tta-itemname">${esc(item.name)}</div><div class="tta-source">${esc(src)}</div></div><div class="tta-profitbox"><button class="tta-pin ${pinned?'active':''}" data-act="togglePin" data-id="${item.id}" aria-pressed="${pinned?'true':'false'}" aria-label="${pinned?'Unpin':'Pin'} ${esc(item.name)}" title="${pinned?'Unpin item':'Pin item to top'}">${pinned?'📌':'☆'}</button><div class="tta-profit ${s.profit>=0?'pos':'neg'}">${money(s.profit,true)}</div><div class="tta-chevron">${exp?'▲ details':'▼ details'}</div></div></div><div class="tta-metrics"><div class="tta-metric"><small>Acquired</small><b>${qty(s.bought)}</b></div><div class="tta-metric"><small>Sold</small><b>${qty(s.sold)}</b></div><div class="tta-metric"><small>Profit</small><b class="${s.profit>=0?'pos':'neg'}">${money(s.profit,true)}</b></div></div><div class="tta-accordion">${details}</div></div>`;
  }'''
s=s[:a]+dash_block+s[b:]

# Rendering/loading helpers + one delegated event system instead of hundreds of per-node handlers.
a=s.index('  function render(options={}) {')
b=s.index('\n\n  async function ensureCatalog',a)
ui_block=r'''  function loadingHtml() {
    const b=state.busy||{};
    return `<div id="tta-loading" class="tta-loading ${b.active?'show':''}" role="status" aria-live="polite" aria-hidden="${b.active?'false':'true'}"><div class="tta-loadingcard"><div class="tta-loadicon"><span class="tta-spinner xl"></span></div><div id="tta-loading-title" class="tta-loadingtitle">${esc(b.title||'Working…')}</div><div id="tta-loading-detail" class="tta-loadingdetail">${esc(b.detail||'Preparing your data…')}</div><div class="tta-loadingbar"><span></span></div><div class="tta-loadingactions"><button id="tta-loading-stop" class="tta-btn danger" data-act="cancelSync" ${b.cancellable?'':'hidden'}>Stop sync</button></div><div class="tta-loadinghint">The analyzer stays on this device. You can stop a history scan safely.</div></div></div>`;
  }

  function updateBusyDom() {
    const root=document.getElementById('tta-root'),el=document.getElementById('tta-loading'),b=state.busy||{};
    if(root)root.setAttribute('aria-busy',b.active?'true':'false');if(!el)return;
    el.classList.toggle('show',!!b.active);el.setAttribute('aria-hidden',b.active?'false':'true');
    const title=document.getElementById('tta-loading-title'),detail=document.getElementById('tta-loading-detail'),stop=document.getElementById('tta-loading-stop');
    if(title)title.textContent=b.title||'Working…';if(detail)detail.textContent=b.detail||'Preparing your data…';if(stop)stop.hidden=!b.cancellable;
  }

  function setBusy(active,title='',detail='',cancellable=false) {
    state.busy={active:!!active,title,detail,cancellable:!!cancellable};updateBusyDom();
  }
  function setBusyDetail(detail) {state.busy={...(state.busy||{}),detail};updateBusyDom();}
  function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
  async function withBusy(title,detail,fn,{cancellable=false}={}) {setBusy(true,title,detail,cancellable);await nextPaint();try{return await fn();}finally{setBusy(false);}}

  function setSyncProgress(msg) {
    state.syncProgress=String(msg||'');
    const text=document.getElementById('tta-sync-progress-text');if(text)text.textContent=state.syncProgress;
    if(state.syncing)setBusyDetail(state.syncProgress);
  }

  async function openAnalyzer() {
    state.open=true;
    const fab=document.getElementById('tta-fab');if(fab)fab.style.display='none';
    const root=document.getElementById('tta-root');if(!root)return;
    root.classList.add('show');root.setAttribute('aria-hidden','false');
    if(root.querySelector('.tta-shell')&&root.dataset.view===state.view)return;
    root.innerHTML='<div class="tta-openloader"><div><span class="tta-spinner xl"></span><strong>Opening Trade Analyzer</strong><small>Preparing cached history and analytics…</small></div></div>';
    await nextPaint();render({preserveScroll:false});
  }

  function render(options={}) {
    const root=document.getElementById('tta-root');if(!root)return;
    const previousView=root.dataset.view||'',previousShell=root.querySelector('.tta-shell');
    const preserveScroll=options.preserveScroll??(previousView===state.view),previousScroll=preserveScroll&&previousShell?previousShell.scrollTop:0;
    const fab=document.getElementById('tta-fab');if(fab)fab.style.display=state.open?'none':'inline-flex';
    if(!state.open){root.classList.remove('show');root.setAttribute('aria-hidden','true');return;}
    root.classList.add('show');root.setAttribute('aria-hidden','false');
    const wasDemo=state.demo;state.demo=!hasApiKey()&&!state.transactions.length;if(wasDemo!==state.demo)resetAnalyticsCache();
    if(state.demo&&!state.catalog.length)state.catalog=demoCatalog();
    root.innerHTML=`<div class="tta-shell">${state.view==='add'?addItemHtml():state.view==='settings'?settingsHtml():dashboardHtml()}</div>${loadingHtml()}<div id="tta-toast" class="tta-toast ${state.toast?'show':''}">${esc(state.toast||'')}</div>`;
    root.dataset.view=state.view;root.setAttribute('aria-busy',state.busy?.active?'true':'false');bind();
    if(preserveScroll){const shell=root.querySelector('.tta-shell');if(shell)shell.scrollTop=previousScroll;}
  }

  let toastTimer=null;
  function toast(msg) {
    state.toast=String(msg||'');const el=document.getElementById('tta-toast');
    if(el){el.textContent=state.toast;el.classList.add('show');}
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(state.toast===msg){state.toast='';const n=document.getElementById('tta-toast');if(n)n.classList.remove('show');}},2400);
  }

  function bind() {
    const root=document.getElementById('tta-root');if(!root||root.dataset.delegated==='1')return;root.dataset.delegated='1';
    root.addEventListener('click',async e=>{
      const dateEl=e.target.closest('[data-date]');
      if(dateEl&&root.contains(dateEl)){state.dateMode=dateEl.dataset.date;save('dateMode',state.dateMode);state.expanded=null;await withBusy('Updating period','Recalculating cached analytics for the selected dates…',async()=>render());return;}
      const granEl=e.target.closest('[data-gran]');
      if(granEl&&root.contains(granEl)){state.granularity=granEl.dataset.gran;save('granularity',state.granularity);await withBusy('Updating chart','Grouping realized profit by the selected interval…',async()=>render());return;}
      const el=e.target.closest('[data-act]');if(!el||!root.contains(el))return;e.stopPropagation();const act=el.dataset.act;
      if(act==='close'){state.open=false;setBusy(false);render();}
      else if(act==='back'){state.view='dashboard';state.search='';render();}
      else if(act==='settings'){state.view='settings';render();}
      else if(act==='addItem'){state.view='add';await withBusy('Loading catalog','Preparing the Torn item catalog…',async()=>{await ensureCatalog();render();});setTimeout(()=>document.getElementById('tta-search')?.focus(),30);}
      else if(act==='toggleItem'){state.expanded=Number(state.expanded)===Number(el.dataset.id)?null:Number(el.dataset.id);renderItemList();}
      else if(act==='togglePin'){
        const id=Number(el.dataset.id),pins=new Set((state.pinnedIds||[]).map(Number));if(pins.has(id))pins.delete(id);else pins.add(id);state.pinnedIds=[...pins];save('pinnedIds',state.pinnedIds);renderItemList();
      }
      else if(act==='cycleSort'){const i=Math.max(0,SORT_OPTIONS.findIndex(x=>x.id===state.sortMode));state.sortMode=SORT_OPTIONS[(i+1)%SORT_OPTIONS.length].id;save('sortMode',state.sortMode);renderItemList();}
      else if(act==='clearItemSearch'){state.itemSearch='';save('itemSearch','');const input=document.getElementById('tta-history-search');if(input){input.value='';input.focus();}renderItemList();}
      else if(act==='confirmAdd'){addTracked(Number(el.dataset.id));}
      else if(act==='removeItem'){removeTracked(Number(el.dataset.id));}
      else if(act==='sync'){syncAll();}
      else if(act==='cancelSync'){state.syncCancel=true;setSyncProgress('Stopping after the current API request…');}
      else if(act==='saveApiKey'){
        const input=document.getElementById('tta-api-key');let key=String(input?.value||'').trim();if(input?.dataset.placeholderKey==='1'&&/^•+$/.test(key))key=String(state.apiKey||'').trim();
        if(key.length<16){toast('Enter a valid Torn API key first.');return;}state.apiKey=key;save('apiKey',key);state.demo=false;render();
        try{
          let info=null;await withBusy('Checking API key','Verifying access and refreshing the item catalog…',async()=>{info=await inspectActiveKey();await apiGet('/user/log',{limit:1});state.catalog=[];state.catalogVersion=0;save('catalog',[]);save('catalogVersion',0);await ensureCatalog(true);});
          toast(`API key confirmed (${info?.type||'access level '+(info?.level||'?')}).`);state.view='dashboard';render();await syncAll();
        }catch(err){if(/Incorrect Key|incorrect format/i.test(String(err.message||err))){state.apiKey='';save('apiKey','');}setBusy(false);render();toast(`API key test failed: ${err.message}`);}
      }
      else if(act==='clearApiKey'){state.apiKey='';save('apiKey','');state.demo=!hasApiKey();resetAnalyticsCache();render();toast(injectedApiKey()?'Saved key cleared. Torn PDA key will be used.':'Saved API key cleared.');}
      else if(act==='refreshCatalog'){
        await withBusy('Refreshing catalog','Downloading the latest Torn item catalog…',async()=>{state.catalog=[];state.catalogVersion=0;save('catalog',[]);save('catalogVersion',0);await ensureCatalog(true);});render();toast(`Item catalog refreshed · ${qty(state.catalog.length)} items.`);
      }
      else if(act==='resetData'&&confirm('Reset all Torn Trade Analyzer discovered item history and local transaction data?')){
        ['tracked','transactions','sync','pinnedIds','itemSearch','sortMode'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.pinnedIds=[];state.itemSearch='';state.sortMode='recent';state.sync={lastSync:0,firstSyncComplete:false};state.expanded=null;resetAnalyticsCache();render();toast('Analyzer data reset.');
      }
    });

    root.addEventListener('input',e=>{
      const target=e.target;
      if(target.id==='tta-history-search'){
        state.itemSearch=target.value;save('itemSearch',state.itemSearch);clearTimeout(perfCache.searchTimer);perfCache.searchTimer=setTimeout(()=>renderItemList(),120);
      }else if(target.id==='tta-search'){
        state.search=target.value;clearTimeout(perfCache.legacySearchTimer);perfCache.legacySearchTimer=setTimeout(()=>{render();const n=document.getElementById('tta-search');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);}},140);
      }
    });

    root.addEventListener('change',async e=>{
      const target=e.target;if(!target.dataset.custom)return;if(target.dataset.custom==='from')state.customFrom=target.value;else state.customTo=target.value;save('customFrom',state.customFrom);save('customTo',state.customTo);state.expanded=null;
      await withBusy('Updating custom period','Applying the selected dates to cached analytics…',async()=>render());
    });

    root.addEventListener('focusin',e=>{const target=e.target;if(target.id==='tta-api-key'&&target.dataset.placeholderKey==='1'){target.value='';target.dataset.placeholderKey='0';}});
  }'''
s=s[:a]+ui_block+s[b:]

# Catalog loading no longer rebuilds the complete UI just to update progress text.
a=s.index('  async function ensureCatalog(force=false) {')
b=s.index('\n\n  function addTracked',a)
catalog_block=r'''  async function ensureCatalog(force=false) {
    if(state.demo&&!hasApiKey())return;
    const cacheCurrent=state.catalog.length&&state.catalogVersion===CATALOG_SCHEMA_VERSION;if(cacheCurrent&&!force)return;
    if(!hasApiKey()){state.catalog=demoCatalog();return;}
    try{
      if(state.busy?.active)setBusyDetail('Loading the complete Torn item catalog…');
      const data=await apiGet('/torn/items');
      state.catalog=(data.items||[]).filter(x=>x&&Number(x.id)>0&&x.name).map(x=>({id:Number(x.id),name:String(x.name),image:x.image||'',type:x.type||'',marketPrice:x.value?.market_price||0})).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
      state.catalogVersion=CATALOG_SCHEMA_VERSION;save('catalog',state.catalog);save('catalogVersion',state.catalogVersion);perfCache.catalogRef=null;
    }catch(e){toast(e.message);}
  }'''
s=s[:a]+catalog_block+s[b:]

# Direct progress updates during historical paging; no full DOM rebuild per API page.
old="state.syncProgress=`${label} · page ${page} · back to ${dateStr(Math.max(period.from,Math.min(cursorTo,nowSec())))} · ${qty(found.size)} item rows`;render();"
new="setSyncProgress(`${label} · page ${page} · back to ${dateStr(Math.max(period.from,Math.min(cursorTo,nowSec())))} · ${qty(found.size)} item rows`);"
assert old in s
s=s.replace(old,new,1)

# Sync uses the dedicated loading interface and renders the expensive dashboard only once at completion.
a=s.index('  async function syncAll() {')
b=s.index('\n\n  function demoCatalog',a)
sync_block=r'''  async function syncAll() {
    if(state.syncing)return;
    if(!hasApiKey()){state.demo=true;toast('Add a Torn API key in Settings → API Key to sync real history.');return;}
    const period=selectedPeriodBounds();
    const periodText=period.from>0?`${dateStr(period.from)} – ${dateStr(Math.min(period.to,nowSec()))}`:'all available history';
    state.syncing=true;state.syncCancel=false;setSyncProgress(`Preparing historical scan for ${periodText}…`);setBusy(true,'Syncing trade history',state.syncProgress,true);
    const syncBtn=document.querySelector('#tta-root [data-act="sync"]');if(syncBtn){syncBtn.disabled=true;syncBtn.innerHTML='<span class="tta-sync"><span class="tta-spinner"></span>Syncing</span>';}
    await nextPaint();
    try{
      await ensureCatalog();
      setBusyDetail('Verifying API access and log types…');
      const keyInfo=await inspectActiveKey();const probe=await probeUserLogs();const types=relevantLogTypes(await ensureLogTypes(true));
      if(!types.length)throw new Error('No relevant Torn transaction or free-acquisition log types were detected.');
      setSyncProgress(`Scanning the complete selected period: ${periodText}…`);
      let scan=await fetchFilteredHistory(types.map(x=>x.id),period);
      if(scan.diagnostics.rawRows===0){setSyncProgress('Filtered period scan returned no raw rows. Trying compatibility scan for the same dates…');scan=await fetchUnfilteredHistory(period);}
      scan.diagnostics.keyType=keyInfo.type;scan.diagnostics.keyLevel=keyInfo.level;scan.diagnostics.keySource=keySource();scan.diagnostics.customLogPermissions=keyInfo.customLogPermissions;scan.diagnostics.probeRows=probe.rows.length;
      const fresh=scan.transactions,outside=state.transactions.filter(t=>Number(t.timestamp)<period.from||Number(t.timestamp)>period.to),merged=new Map(outside.map(x=>[x.id,x]));fresh.forEach(x=>merged.set(x.id,x));
      state.transactions=[...merged.values()].sort((a,b)=>a.timestamp-b.timestamp);save('transactions',state.transactions);resetAnalyticsCache();
      state.sync.lastSync=nowSec();state.sync.firstSyncComplete=!state.syncCancel;state.sync.autoDiscoveryComplete=!state.syncCancel;
      if(!state.syncCancel){const oldCoverage=Number(state.sync.coverageFrom);state.sync.coverageFrom=Number.isFinite(oldCoverage)?Math.min(oldCoverage,period.from):period.from;state.sync.coverageTo=Math.max(Number(state.sync.coverageTo)||0,Math.min(period.to,nowSec()));}
      state.sync.diagnostics=scan.diagnostics;save('sync',state.sync);
      const mode=scan.diagnostics.mode==='unfiltered-fallback'?'compatibility scan':'filtered scan';
      if(state.syncCancel)setSyncProgress(`Sync stopped · ${qty(scan.diagnostics.rawRows)} raw logs scanned · ${qty(fresh.length)} item rows collected.`);
      else if(!fresh.length)setSyncProgress(`${mode} completed for ${periodText} · ${qty(scan.diagnostics.rawRows)} raw logs scanned · no recognizable item acquisitions or sales found.`);
      else setSyncProgress(`Historical sync complete for ${periodText} · ${qty(fresh.length)} item rows · ${qty(scan.diagnostics.rawRows)} raw logs across ${qty(scan.diagnostics.pages)} pages.`);
    }catch(e){setSyncProgress(`Sync error: ${e.message}`);}
    finally{state.syncing=false;setBusy(false);render();}
  }'''
s=s[:a]+sync_block+s[b:]

p.write_text(s)
