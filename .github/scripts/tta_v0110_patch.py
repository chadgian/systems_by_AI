from pathlib import Path

p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.9' in s
assert "const VERSION = '0.1.9';" in s
s=s.replace('// @version      0.1.9','// @version      0.1.10',1)
s=s.replace("const VERSION = '0.1.9';","const VERSION = '0.1.10';",1)
s=s.replace('Fast, period-aware Torn trade analytics with cached FIFO calculations, hide/pin/search/sort controls, and progressive loading. Data stays on-device.','Fast, period-aware Torn trade analytics with market values, item details, cached FIFO calculations, hide/pin/search/sort controls, and progressive loading. Data stays on-device.',1)

old="""    catalog: load('catalog', []),
    catalogVersion: load('catalogVersion', 0),
    logTypes: load('logTypes', []),"""
new="""    catalog: load('catalog', []),
    catalogVersion: load('catalogVersion', 0),
    catalogUpdatedAt: load('catalogUpdatedAt', 0),
    logTypes: load('logTypes', []),"""
assert old in s
s=s.replace(old,new,1)

old="""      .tta-item{background:var(--tta-card);border:1px solid var(--tta-line);border-radius:15px;margin-bottom:10px;overflow:hidden}.tta-itemtop{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:11px;align-items:center;min-height:70px;padding:10px 11px;cursor:pointer}.tta-thumbwrap{position:relative;width:48px;height:48px;display:grid;place-items:center;align-self:center;justify-self:center;background:#0b1219;border:1px solid #2e4152;border-radius:12px;overflow:hidden}.tta-thumb{display:block;width:40px;height:40px;max-width:40px;max-height:40px;object-fit:contain;object-position:center;padding:0;margin:0;background:transparent;border:0}.tta-thumbfallback{display:none;position:absolute;inset:0;place-items:center;color:var(--tta-faint);font-size:20px}.tta-itemcopy{min-width:0;align-self:center}.tta-itemname{color:var(--tta-text);font-weight:850;font-size:13px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tta-source{font-size:10px;color:var(--tta-muted);margin-top:4px;line-height:1.35;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tta-profitbox"""
new="""      .tta-item{background:var(--tta-card);border:1px solid var(--tta-line);border-radius:15px;margin-bottom:10px;overflow:hidden}.tta-itemtop{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:11px;align-items:center;min-height:70px;padding:10px 11px;cursor:pointer}.tta-thumbwrap{position:relative;width:48px;height:48px;display:grid;place-items:center;align-self:center;justify-self:center;background:#0b1219;border:1px solid #2e4152;border-radius:12px;overflow:hidden}.tta-thumb{display:block;width:40px;height:40px;max-width:40px;max-height:40px;object-fit:contain;object-position:center;padding:0;margin:0;background:transparent;border:0}.tta-thumbfallback{display:none;position:absolute;inset:0;place-items:center;color:var(--tta-faint);font-size:20px}.tta-itemcopy{min-width:0;align-self:center}.tta-itemname{color:var(--tta-text);font-weight:850;font-size:13px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tta-source{font-size:10px;color:var(--tta-muted);margin-top:4px;line-height:1.35;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tta-itemfacts{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.tta-factpill{display:inline-flex;align-items:center;min-height:21px;padding:3px 6px;border:1px solid #314556;border-radius:999px;background:#0d151d;color:var(--tta-faint);font-size:8.5px;font-weight:750;line-height:1;white-space:nowrap}.tta-factpill.market{border-color:#315c4d;background:#11261f;color:var(--tta-green);font-size:9px}.tta-profitbox"""
assert old in s
s=s.replace(old,new,1)

old="""  function itemCard(item,precomputed=null) {
    const s=precomputed||summaryFor(item.id),exp=Number(state.expanded)===Number(item.id);
    const pinned=(state.pinnedIds||[]).map(Number).includes(Number(item.id));
    const src=s.sources.length?s.sources.slice(0,3).join(' · '):'No acquisitions in selected period';
    let details='';
    if(exp){
      const series=profitSeries(item.id),avgBuy=s.bought?s.buySpend/s.bought:0,avgSell=s.sold?s.sellRevenue/s.sold:0;
      const freeQty=s.events.filter(x=>x.side==='buy'&&x.free).reduce((n,x)=>n+x.qty,0);
      details=`<div class=\"tta-minirow\"><div class=\"tta-ministat\"><small>Avg cost</small><b>${money(avgBuy,true)}</b></div><div class=\"tta-ministat\"><small>Avg sell</small><b>${money(avgSell,true)}</b></div><div class=\"tta-ministat\"><small>Inventory</small><b>${qty(s.remainingQty)}</b></div></div><div class=\"tta-charthead\"><h3>${esc(item.name)} profit</h3><small>${s.events.length} events</small></div>${chartSvg(series,92)}<div class=\"tta-note\">Profit uses FIFO: each sale is matched against your oldest recorded acquisitions. ${s.unmatched?`⚠ ${qty(s.unmatched)} sold item(s) have no earlier recorded acquisition cost, so those units are excluded from realized profit.`:'All sold units in this period have recorded cost basis.'}${freeQty?` · ${qty(freeQty)} free-acquired item(s) use a $0 cost basis.`:''}</div>`;
    }
    return `<div class=\"tta-item ${exp?'expanded':''}\" data-item=\"${item.id}\"><div class=\"tta-itemtop\" data-act=\"toggleItem\" data-id=\"${item.id}\" role=\"button\" tabindex=\"0\" aria-expanded=\"${exp?'true':'false'}\">${itemIcon(item)}<div class=\"tta-itemcopy\"><div class=\"tta-itemname\">${esc(item.name)}</div><div class=\"tta-source\">${esc(src)}</div></div><div class=\"tta-profitbox\"><div class=\"tta-cardactions\"><button class=\"tta-pin ${pinned?'active':''}\" data-act=\"togglePin\" data-id=\"${item.id}\" aria-pressed=\"${pinned?'true':'false'}\" aria-label=\"${pinned?'Unpin':'Pin'} ${esc(item.name)}\" title=\"${pinned?'Unpin item':'Pin item to top'}\">${pinned?'📌':'☆'}</button><button class=\"tta-hideitem\" data-act=\"hideItem\" data-id=\"${item.id}\" aria-label=\"Hide ${esc(item.name)}\" title=\"Hide item\">🙈</button></div><div class=\"tta-profit ${s.profit>=0?'pos':'neg'}\">${money(s.profit,true)}</div><div class=\"tta-chevron\">${exp?'▲ details':'▼ details'}</div></div></div><div class=\"tta-metrics\"><div class=\"tta-metric\"><small>Acquired</small><b>${qty(s.bought)}</b></div><div class=\"tta-metric\"><small>Sold</small><b>${qty(s.sold)}</b></div><div class=\"tta-metric\"><small>Profit</small><b class=\"${s.profit>=0?'pos':'neg'}\">${money(s.profit,true)}</b></div></div><div class=\"tta-accordion\">${details}</div></div>`;
  }"""
new="""  function itemCard(item,precomputed=null) {
    const s=precomputed||summaryFor(item.id),exp=Number(state.expanded)===Number(item.id);
    const pinned=(state.pinnedIds||[]).map(Number).includes(Number(item.id));
    const marketPrice=Math.max(0,Number(item.marketPrice)||0),marketText=marketPrice?money(marketPrice):'Market unavailable';
    const itemType=String(item.type||'Item');
    const src=s.sources.length?s.sources.slice(0,3).join(' · '):'No acquisitions in selected period';
    let details='';
    if(exp){
      const series=profitSeries(item.id),avgBuy=s.bought?s.buySpend/s.bought:0,avgSell=s.sold?s.sellRevenue/s.sold:0;
      const freeQty=s.events.filter(x=>x.side==='buy'&&x.free).reduce((n,x)=>n+x.qty,0);
      const recordedInventoryValue=marketPrice*Math.max(0,Number(s.remainingQty)||0);
      details=`<div class=\"tta-minirow\"><div class=\"tta-ministat\"><small>Avg cost</small><b>${money(avgBuy,true)}</b></div><div class=\"tta-ministat\"><small>Avg sell</small><b>${money(avgSell,true)}</b></div><div class=\"tta-ministat\"><small>Inventory</small><b>${qty(s.remainingQty)}</b></div></div><div class=\"tta-minirow\"><div class=\"tta-ministat\"><small>Market value</small><b>${marketPrice?money(marketPrice,true):'—'}</b></div><div class=\"tta-ministat\"><small>Recorded inventory value</small><b>${marketPrice?money(recordedInventoryValue,true):'—'}</b></div><div class=\"tta-ministat\"><small>FIFO cost basis</small><b>${money(s.remainingCost,true)}</b></div></div><div class=\"tta-charthead\"><h3>${esc(item.name)} profit</h3><small>#${item.id} · ${esc(itemType)} · ${s.events.length} events</small></div>${chartSvg(series,92)}<div class=\"tta-note\">Market value is Torn's catalog market price per item. Recorded inventory value is your analyzer-recorded remaining quantity × that market value; it is not a live inventory count. Profit uses FIFO: each sale is matched against your oldest recorded acquisitions. ${s.unmatched?`⚠ ${qty(s.unmatched)} sold item(s) have no earlier recorded acquisition cost, so those units are excluded from realized profit.`:'All sold units in this period have recorded cost basis.'}${freeQty?` · ${qty(freeQty)} free-acquired item(s) use a $0 cost basis.`:''}</div>`;
    }
    return `<div class=\"tta-item ${exp?'expanded':''}\" data-item=\"${item.id}\"><div class=\"tta-itemtop\" data-act=\"toggleItem\" data-id=\"${item.id}\" role=\"button\" tabindex=\"0\" aria-expanded=\"${exp?'true':'false'}\">${itemIcon(item)}<div class=\"tta-itemcopy\"><div class=\"tta-itemname\">${esc(item.name)}</div><div class=\"tta-source\">${esc(src)}</div><div class=\"tta-itemfacts\"><span class=\"tta-factpill market\">Market ${esc(marketText)}</span><span class=\"tta-factpill\">${esc(itemType)}</span><span class=\"tta-factpill\">#${item.id}</span></div></div><div class=\"tta-profitbox\"><div class=\"tta-cardactions\"><button class=\"tta-pin ${pinned?'active':''}\" data-act=\"togglePin\" data-id=\"${item.id}\" aria-pressed=\"${pinned?'true':'false'}\" aria-label=\"${pinned?'Unpin':'Pin'} ${esc(item.name)}\" title=\"${pinned?'Unpin item':'Pin item to top'}\">${pinned?'📌':'☆'}</button><button class=\"tta-hideitem\" data-act=\"hideItem\" data-id=\"${item.id}\" aria-label=\"Hide ${esc(item.name)}\" title=\"Hide item\">🙈</button></div><div class=\"tta-profit ${s.profit>=0?'pos':'neg'}\">${money(s.profit,true)}</div><div class=\"tta-chevron\">${exp?'▲ details':'▼ details'}</div></div></div><div class=\"tta-metrics\"><div class=\"tta-metric\"><small>Acquired</small><b>${qty(s.bought)}</b></div><div class=\"tta-metric\"><small>Sold</small><b>${qty(s.sold)}</b></div><div class=\"tta-metric\"><small>Profit</small><b class=\"${s.profit>=0?'pos':'neg'}\">${money(s.profit,true)}</b></div></div><div class=\"tta-accordion\">${details}</div></div>`;
  }"""
assert old in s
s=s.replace(old,new,1)

old="""    const hiddenIds=[...new Set((state.hiddenIds||[]).map(Number).filter(x=>x>0))];
    const hiddenItems=hiddenIds.map(catalogItem).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);"""
new="""    const hiddenIds=[...new Set((state.hiddenIds||[]).map(Number).filter(x=>x>0))];
    const hiddenItems=hiddenIds.map(catalogItem).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
    const catalogUpdated=Number(state.catalogUpdatedAt)||0;
    const catalogWhen=catalogUpdated?new Date(catalogUpdated*1000).toLocaleString():'Never';"""
assert old in s
s=s.replace(old,new,1)

old="""<label>Local data</label><div class=\"tta-banner\">${qty(state.transactions.length)} normalized transaction entries · ${qty(state.catalog.length)} Torn items cached. Raw Torn logs are not retained.${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.pages||0)} pages · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types.${state.sync.diagnostics.periodFrom?`<br>Period scanned: ${esc(dateStr(state.sync.diagnostics.periodFrom))} – ${esc(dateStr(Math.min(state.sync.diagnostics.periodTo||nowSec(),nowSec())))}`:'<br>Period scanned: all available history.'}`:''}</div>"""
new="""<label>Local data</label><div class=\"tta-banner\">${qty(state.transactions.length)} normalized transaction entries · ${qty(state.catalog.length)} Torn items cached. Raw Torn logs are not retained.<br>Item catalog / market values updated: ${esc(catalogWhen)}.${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.pages||0)} pages · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types.${state.sync.diagnostics.periodFrom?`<br>Period scanned: ${esc(dateStr(state.sync.diagnostics.periodFrom))} – ${esc(dateStr(Math.min(state.sync.diagnostics.periodTo||nowSec(),nowSec())))}`:'<br>Period scanned: all available history.'}`:''}</div>"""
assert old in s
s=s.replace(old,new,1)

old="""          let info=null;await withBusy('Checking API key','Verifying access and refreshing the item catalog…',async()=>{info=await inspectActiveKey();await apiGet('/user/log',{limit:1});state.catalog=[];state.catalogVersion=0;save('catalog',[]);save('catalogVersion',0);await ensureCatalog(true);});"""
new="""          let info=null;await withBusy('Checking API key','Verifying access and refreshing the item catalog…',async()=>{info=await inspectActiveKey();await apiGet('/user/log',{limit:1});state.catalog=[];state.catalogVersion=0;state.catalogUpdatedAt=0;save('catalog',[]);save('catalogVersion',0);save('catalogUpdatedAt',0);await ensureCatalog(true);});"""
assert old in s
s=s.replace(old,new,1)

old="""        await withBusy('Refreshing catalog','Downloading the latest Torn item catalog…',async()=>{state.catalog=[];state.catalogVersion=0;save('catalog',[]);save('catalogVersion',0);await ensureCatalog(true);});render();toast(`Item catalog refreshed · ${qty(state.catalog.length)} items.`);"""
new="""        await withBusy('Refreshing catalog','Downloading the latest Torn item catalog and market values…',async()=>{state.catalog=[];state.catalogVersion=0;state.catalogUpdatedAt=0;save('catalog',[]);save('catalogVersion',0);save('catalogUpdatedAt',0);await ensureCatalog(true);});render();toast(`Item catalog and market values refreshed · ${qty(state.catalog.length)} items.`);"""
assert old in s
s=s.replace(old,new,1)

old="""  async function ensureCatalog(force=false) {
    if(state.demo&&!hasApiKey())return;
    const cacheCurrent=state.catalog.length&&state.catalogVersion===CATALOG_SCHEMA_VERSION;if(cacheCurrent&&!force)return;
    if(!hasApiKey()){state.catalog=demoCatalog();return;}
    try{
      if(state.busy?.active)setBusyDetail('Loading the complete Torn item catalog…');
      const data=await apiGet('/torn/items');
      state.catalog=(data.items||[]).filter(x=>x&&Number(x.id)>0&&x.name).map(x=>({id:Number(x.id),name:String(x.name),image:x.image||'',type:x.type||'',marketPrice:x.value?.market_price||0})).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
      state.catalogVersion=CATALOG_SCHEMA_VERSION;save('catalog',state.catalog);save('catalogVersion',state.catalogVersion);perfCache.catalogRef=null;
    }catch(e){toast(e.message);}
  }"""
new="""  async function ensureCatalog(force=false) {
    if(state.demo&&!hasApiKey())return;
    const catalogAge=nowSec()-(Number(state.catalogUpdatedAt)||0);
    const cacheCurrent=state.catalog.length&&state.catalogVersion===CATALOG_SCHEMA_VERSION&&catalogAge>=0&&catalogAge<6*3600;if(cacheCurrent&&!force)return;
    if(!hasApiKey()){state.catalog=demoCatalog();return;}
    try{
      if(state.busy?.active)setBusyDetail('Loading the complete Torn item catalog and current market values…');
      const data=await apiGet('/torn/items');
      state.catalog=(data.items||[]).filter(x=>x&&Number(x.id)>0&&x.name).map(x=>({id:Number(x.id),name:String(x.name),image:x.image||'',type:x.type||'',marketPrice:Number(x.value?.market_price)||0})).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
      state.catalogVersion=CATALOG_SCHEMA_VERSION;state.catalogUpdatedAt=nowSec();save('catalog',state.catalog);save('catalogVersion',state.catalogVersion);save('catalogUpdatedAt',state.catalogUpdatedAt);perfCache.catalogRef=null;
    }catch(e){toast(e.message);}
  }"""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
