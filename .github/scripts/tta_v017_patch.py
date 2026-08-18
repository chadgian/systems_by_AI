from pathlib import Path
p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.16' in s
assert "const VERSION = '0.1.16';" in s
s=s.replace('// @version      0.1.16','// @version      0.1.17',1)
s=s.replace("const VERSION = '0.1.16';","const VERSION = '0.1.17';",1)
s=s.replace('Fast Torn trade analytics with safe incremental missing-data sync, verified-trade skipping, reload resume, market-value allocation, cached FIFO, and item details. Data stays on-device.',
            'Fast Torn trade analytics with an acquisition FIFO ledger, sortable/filterable history, safe incremental sync, verified-trade skipping, market-value allocation, and cached analytics. Data stays on-device.',1)

old="""    itemSearch: load('itemSearch', ''),
    sortMode: load('sortMode', 'recent'),
    sync: load('sync', { lastSync: 0, firstSyncComplete: false }),"""
new="""    itemSearch: load('itemSearch', ''),
    sortMode: load('sortMode', 'recent'),
    ledgerSearch: load('ledgerSearch', ''),
    ledgerSource: load('ledgerSource', 'all'),
    ledgerStatus: load('ledgerStatus', 'all'),
    ledgerRange: load('ledgerRange', 'all'),
    ledgerSort: load('ledgerSort', 'acquiredAt'),
    ledgerSortDir: load('ledgerSortDir', 'desc'),
    ledgerLimit: 200,
    sync: load('sync', { lastSync: 0, firstSyncComplete: false }),"""
assert old in s
s=s.replace(old,new,1)

old="""  function qty(n) { return (Number(n) || 0).toLocaleString(); }
  function dateStr(ts) { return new Date(ts * 1000).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}); }"""
new="""  function qty(n) { return (Number(n) || 0).toLocaleString(); }
  function dateStr(ts) { return new Date(ts * 1000).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}); }
  function dateTimeStr(ts) { return new Date((Number(ts)||0) * 1000).toLocaleString(undefined, {year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }"""
assert old in s
s=s.replace(old,new,1)

old="""    txRef:null,byItem:new Map(),lastById:new Map(),itemIds:[],fifo:new Map(),summaries:new Map(),series:new Map(),overall:new Map(),
    catalogRef:null,catalogMap:new Map(),trackedTxRef:null,trackedCatalogRef:null,tracked:[],searchTimer:null,legacySearchTimer:null
  };"""
new="""    txRef:null,byItem:new Map(),lastById:new Map(),itemIds:[],fifo:new Map(),summaries:new Map(),series:new Map(),overall:new Map(),
    catalogRef:null,catalogMap:new Map(),trackedTxRef:null,trackedCatalogRef:null,tracked:[],ledgerTxRef:null,ledgerRows:[],searchTimer:null,legacySearchTimer:null,ledgerSearchTimer:null
  };"""
assert old in s
s=s.replace(old,new,1)

old="""    perfCache.trackedTxRef=null;perfCache.trackedCatalogRef=null;perfCache.tracked=[];
  }"""
new="""    perfCache.trackedTxRef=null;perfCache.trackedCatalogRef=null;perfCache.tracked=[];
    perfCache.ledgerTxRef=null;perfCache.ledgerRows=[];
  }"""
assert old in s
s=s.replace(old,new,1)

css_anchor="""      .tta-liststage{min-height:80px}.tta-listmeta strong{color:var(--tta-text)}
      .tta-loading{"""
css_new="""      .tta-liststage{min-height:80px}.tta-listmeta strong{color:var(--tta-text)}
      .tta-ledgerintro{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}.tta-ledgerintro strong{display:block;color:var(--tta-text);font-size:13px}.tta-ledgerintro small{display:block;margin-top:3px;color:var(--tta-muted);font-size:10px;line-height:1.45}.tta-ledgerfilters{display:grid;grid-template-columns:minmax(180px,1.6fr) repeat(3,minmax(118px,.8fr));gap:8px;margin:10px 0}.tta-ledgerfilters input,.tta-ledgerfilters select{width:100%;min-height:40px;border:1px solid var(--tta-line);border-radius:10px;background:var(--tta-card);color:var(--tta-text)!important;padding:8px 10px;font-size:11px;outline:none}.tta-ledgerfilters input:focus,.tta-ledgerfilters select:focus{border-color:var(--tta-blue);box-shadow:0 0 0 2px #7fc1ff22}.tta-ledgersummary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0}.tta-ledgersummary .tta-ministat{margin:0}.tta-ledgerwrap{width:100%;overflow:auto;border:1px solid var(--tta-line);border-radius:13px;background:#0d141c;overscroll-behavior-x:contain}.tta-ledgertable{width:100%;min-width:940px;border-collapse:separate;border-spacing:0;font-size:10px}.tta-ledgertable th{position:sticky;top:0;z-index:2;background:#17212b;border-bottom:1px solid var(--tta-line);text-align:left;padding:0}.tta-ledgertable th button{width:100%;border:0;background:transparent;color:#dce8f2!important;padding:10px 9px;text-align:left;font-size:9px;font-weight:850;letter-spacing:.25px;white-space:nowrap}.tta-ledgertable th button.active{color:var(--tta-green)!important}.tta-ledgertable td{padding:9px;border-bottom:1px solid #273746;color:#d6e1eb;vertical-align:top;font-variant-numeric:tabular-nums}.tta-ledgertable tbody tr:last-child td{border-bottom:0}.tta-ledgertable tbody tr:active td{background:#17222d}.tta-ledgertable .num{text-align:right;white-space:nowrap}.tta-ledgeritem{min-width:135px}.tta-ledgeritem strong{display:block;color:var(--tta-text);font-size:10.5px;line-height:1.3}.tta-ledgeritem small,.tta-ledgermethod small,.tta-ledgerstatus small{display:block;margin-top:2px;color:var(--tta-faint);font-size:8.5px;line-height:1.35}.tta-ledgermethod{min-width:125px}.tta-ledgerstatus{min-width:105px}.tta-statuspill{display:inline-flex;align-items:center;min-height:22px;padding:3px 7px;border:1px solid var(--tta-line);border-radius:999px;background:#151f28;color:var(--tta-muted);font-size:8.5px;font-weight:800;white-space:nowrap}.tta-statuspill.sold{background:#123026;border-color:#2f6853;color:var(--tta-green)}.tta-statuspill.partial{background:#322b13;border-color:#6e6030;color:var(--tta-yellow)}.tta-statuspill.unsold{background:#251a20;border-color:#5f3e49;color:#ffc1ca}.tta-ledgermeta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 1px;color:var(--tta-muted);font-size:9.5px}.tta-ledgermore{display:flex;justify-content:center;margin:12px 0 4px}
      @media(max-width:620px){.tta-ledgerfilters{grid-template-columns:1fr 1fr}.tta-ledgerfilters .tta-ledgersearch{grid-column:1/-1}.tta-ledgersummary{grid-template-columns:1fr 1fr}}
      @media(max-width:390px){.tta-ledgerfilters{grid-template-columns:1fr}.tta-ledgerfilters .tta-ledgersearch{grid-column:auto}.tta-ledgermeta{align-items:flex-start;flex-direction:column}}
      .tta-loading{"""
assert css_anchor in s
s=s.replace(css_anchor,css_new,1)

anchor="""  function summaryFor(itemId) {"""
ledger_funcs=r'''  function acquisitionMethod(t) {
    const source=String(t?.source||''),text=`${source} ${t?.title||''}`.toLowerCase();
    if(source==='Player Trade')return 'Player Trade';
    if(/crime/.test(text))return 'Crime';
    if(/seasonal gift|christmas|easter|halloween|\bgift\b/.test(text))return 'Gift / Event';
    if(/mission reward|job \/ company reward|job special|company special|event reward|competition reward/.test(text))return 'Reward';
    if(/city find|item.*found|found item/.test(text))return 'City Find';
    if(source==='Foreign Market'||/foreign market|abroad|travel/.test(text))return 'Bought overseas';
    if(source==='Item Market'||/item market/.test(text))return 'Item Market';
    if(source==='Bazaar'||/bazaar/.test(text))return 'Bazaar';
    if(source==='Torn Shop'||/torn shop|item shop/.test(text))return 'Torn Shop';
    if(t?.free)return 'Free / Reward';
    return source||'Other';
  }

  function acquisitionLedgerRows() {
    const idx=ensureTxIndex();
    if(perfCache.ledgerTxRef===idx.txRef)return perfCache.ledgerRows;
    const ledger=[];
    for(const itemId of idx.itemIds){
      const tx=idx.byItem.get(itemId)||[],lots=[];let lotHead=0;
      for(const t of tx){
        const q=Math.max(0,Number(t?.qty)||0);if(!(q>0))continue;
        if(t.side==='buy'){
          const cost=Math.max(0,Number(t.total)||0),item=catalogItem(itemId);
          const row={id:String(t.id),acquiredAt:Number(t.timestamp)||0,itemId:Number(itemId),itemName:item.name,itemType:item.type||'Item',qty:q,method:acquisitionMethod(t),source:String(t.source||''),title:String(t.title||''),free:!!t.free,costTotal:cost,unitCost:q?cost/q:0,soldQty:0,soldProceeds:0,realizedCost:0,realizedProfit:0,unsoldQty:q,status:'unsold',saleCount:0,firstSoldAt:0,lastSoldAt:0,saleSources:[],_saleSources:new Set()};
          ledger.push(row);lots.push({remaining:q,unit:row.unitCost,row});
        }else if(t.side==='sell'){
          let remain=q;const net=Math.max(0,Number(t.netTotal??t.total)||0),saleUnit=q?net/q:0;
          while(remain>1e-9&&lotHead<lots.length){
            const lot=lots[lotHead],take=Math.min(remain,lot.remaining);if(!(take>0)){lotHead++;continue;}
            const row=lot.row;row.soldQty+=take;row.soldProceeds+=take*saleUnit;row.realizedCost+=take*lot.unit;row.realizedProfit=row.soldProceeds-row.realizedCost;row.saleCount++;
            const soldAt=Number(t.timestamp)||0;if(!row.firstSoldAt||soldAt<row.firstSoldAt)row.firstSoldAt=soldAt;if(soldAt>row.lastSoldAt)row.lastSoldAt=soldAt;
            if(t.source)row._saleSources.add(String(t.source));
            remain-=take;lot.remaining-=take;if(lot.remaining<=1e-9)lotHead++;
          }
        }
      }
    }
    for(const row of ledger){
      row.unsoldQty=Math.max(0,row.qty-row.soldQty);row.status=row.soldQty<=1e-9?'unsold':row.unsoldQty<=1e-9?'sold':'partial';row.saleSources=[...row._saleSources];delete row._saleSources;
    }
    ledger.sort((a,b)=>b.acquiredAt-a.acquiredAt||String(b.id).localeCompare(String(a.id)));
    perfCache.ledgerTxRef=idx.txRef;perfCache.ledgerRows=ledger;return ledger;
  }

  function ledgerRangeBounds() {
    const now=Date.now();
    if(state.ledgerRange==='7d')return {from:Math.floor((now-7*86400e3)/1000),to:Math.floor(now/1000)+60};
    if(state.ledgerRange==='30d')return {from:Math.floor((now-30*86400e3)/1000),to:Math.floor(now/1000)+60};
    if(state.ledgerRange==='month')return {from:Math.floor(subtractCalendarMonth(new Date(now)).getTime()/1000),to:Math.floor(now/1000)+60};
    if(state.ledgerRange==='dashboard')return dateRange();
    return {from:0,to:Number.MAX_SAFE_INTEGER};
  }

  function filteredLedgerRows() {
    const q=String(state.ledgerSearch||'').trim().toLowerCase(),source=String(state.ledgerSource||'all'),status=String(state.ledgerStatus||'all'),range=ledgerRangeBounds();
    const rows=acquisitionLedgerRows().filter(row=>{
      if(row.acquiredAt<range.from||row.acquiredAt>range.to)return false;
      if(source!=='all'&&row.method!==source)return false;
      if(status!=='all'&&row.status!==status)return false;
      if(q){const hay=`${row.itemName} ${row.itemId} ${row.method} ${row.source} ${row.title} ${(row.saleSources||[]).join(' ')}`.toLowerCase();if(!hay.includes(q))return false;}
      return true;
    });
    const key=String(state.ledgerSort||'acquiredAt'),dir=state.ledgerSortDir==='asc'?1:-1;
    rows.sort((a,b)=>{
      let av,bv;
      if(key==='item'){av=a.itemName.toLowerCase();bv=b.itemName.toLowerCase();}
      else if(key==='method'){av=a.method.toLowerCase();bv=b.method.toLowerCase();}
      else if(key==='status'){av=a.status;bv=b.status;}
      else{av=Number(a[key])||0;bv=Number(b[key])||0;}
      let d=typeof av==='string'?av.localeCompare(bv):av-bv;return d*dir||(b.acquiredAt-a.acquiredAt)||a.itemName.localeCompare(b.itemName);
    });
    return rows;
  }

  function ledgerSortArrow(key){return state.ledgerSort===key?(state.ledgerSortDir==='asc'?' ↑':' ↓'):'';}
  function ledgerMethodOptions(){return [...new Set(acquisitionLedgerRows().map(x=>x.method).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  function ledgerSummary(rows){return {lots:rows.length,qty:rows.reduce((n,x)=>n+x.qty,0),sold:rows.reduce((n,x)=>n+x.soldQty,0),profit:rows.reduce((n,x)=>n+x.realizedProfit,0)};}

  function ledgerRowHtml(row) {
    const saleWhen=row.lastSoldAt?dateTimeStr(row.lastSoldAt):'Not sold yet',saleSources=row.saleSources.length?row.saleSources.join(' · '):'';
    const costText=row.free&&row.costTotal<=1e-7?'$0 · Free':money(row.costTotal);
    const profitText=row.soldQty>0?money(row.realizedProfit):'—';
    return `<tr><td><strong>${esc(dateTimeStr(row.acquiredAt))}</strong></td><td class="tta-ledgeritem"><strong>${esc(row.itemName)}</strong><small>#${row.itemId} · ${esc(row.itemType)}</small></td><td class="num">${qty(row.qty)}</td><td class="tta-ledgermethod"><strong>${esc(row.method)}</strong><small>${esc(row.source||row.title||'Recorded acquisition')}</small></td><td class="num">${esc(costText)}<br><small>${row.qty?esc(money(row.unitCost))+'/ea':''}</small></td><td class="num">${qty(row.soldQty)} / ${qty(row.qty)}</td><td class="num">${row.soldQty?money(row.soldProceeds):'—'}</td><td class="num ${row.realizedProfit>=0?'pos':'neg'}">${esc(profitText)}</td><td class="tta-ledgerstatus"><span class="tta-statuspill ${row.status}">${row.status==='sold'?'Sold':row.status==='partial'?'Partial':'Unsold'}</span><small>${esc(saleWhen)}${saleSources?` · ${esc(saleSources)}`:''}</small></td></tr>`;
  }

  function ledgerTableBodyHtml(rows) {
    const shown=rows.slice(0,Math.max(1,Number(state.ledgerLimit)||200));
    return shown.length?shown.map(ledgerRowHtml).join(''):'<tr><td colspan="9"><div class="tta-empty">No acquisition lots match the current filters.</div></td></tr>';
  }

  function renderLedgerRows() {
    if(state.view!=='ledger')return;
    const rows=filteredLedgerRows(),sum=ledgerSummary(rows),limit=Math.max(1,Number(state.ledgerLimit)||200),shown=Math.min(limit,rows.length);
    const body=document.getElementById('tta-ledger-body');if(body)body.innerHTML=ledgerTableBodyHtml(rows);
    const meta=document.getElementById('tta-ledger-meta');if(meta)meta.textContent=`Showing ${qty(shown)} of ${qty(rows.length)} acquisition lots`;
    const more=document.getElementById('tta-ledger-more');if(more)more.hidden=shown>=rows.length;
    const lots=document.getElementById('tta-ledger-lots');if(lots)lots.textContent=qty(sum.lots);
    const acquired=document.getElementById('tta-ledger-qty');if(acquired)acquired.textContent=qty(sum.qty);
    const sold=document.getElementById('tta-ledger-sold');if(sold)sold.textContent=qty(sum.sold);
    const profit=document.getElementById('tta-ledger-profit');if(profit){profit.textContent=money(sum.profit,true);profit.className=sum.profit>=0?'pos':'neg';}
    document.querySelectorAll('#tta-root [data-act="ledgerSort"]').forEach(btn=>{const key=btn.dataset.key;btn.classList.toggle('active',state.ledgerSort===key);btn.textContent=`${btn.dataset.label}${ledgerSortArrow(key)}`;});
    const clear=document.querySelector('#tta-root [data-act="clearLedgerSearch"]');if(clear)clear.hidden=!state.ledgerSearch;
  }

  function ledgerHtml() {
    const rows=filteredLedgerRows(),sum=ledgerSummary(rows),methods=ledgerMethodOptions(),limit=Math.max(1,Number(state.ledgerLimit)||200),shown=Math.min(limit,rows.length);
    const sortTh=(key,label)=>`<th><button data-act="ledgerSort" data-key="${key}" data-label="${esc(label)}" class="${state.ledgerSort===key?'active':''}">${esc(label)}${ledgerSortArrow(key)}</button></th>`;
    return `${header('Acquisition History','FIFO lot ledger · cached acquisition and sale history',true)}<div class="tta-content">
      <div class="tta-ledgerintro"><div><strong>Acquisition ledger</strong><small>Each row is one recorded acquisition lot. Later sales are matched back to it using the same FIFO method as the dashboard. Profit shown here is realized only on the quantity already sold.</small></div></div>
      <div class="tta-ledgerfilters"><div class="tta-searchwrap tta-ledgersearch"><span class="tta-searchglyph">⌕</span><input id="tta-ledger-search" class="tta-history-search" placeholder="Search item, ID, source or sale method…" value="${esc(state.ledgerSearch||'')}" autocomplete="off"><button class="tta-clearsearch" data-act="clearLedgerSearch" aria-label="Clear ledger search" ${state.ledgerSearch?'':'hidden'}>×</button></div><select data-ledger-filter="source"><option value="all">All acquisition types</option>${methods.map(x=>`<option value="${esc(x)}" ${state.ledgerSource===x?'selected':''}>${esc(x)}</option>`).join('')}</select><select data-ledger-filter="status"><option value="all" ${state.ledgerStatus==='all'?'selected':''}>All sale statuses</option><option value="sold" ${state.ledgerStatus==='sold'?'selected':''}>Sold</option><option value="partial" ${state.ledgerStatus==='partial'?'selected':''}>Partial</option><option value="unsold" ${state.ledgerStatus==='unsold'?'selected':''}>Unsold</option></select><select data-ledger-filter="range"><option value="all" ${state.ledgerRange==='all'?'selected':''}>All cached history</option><option value="7d" ${state.ledgerRange==='7d'?'selected':''}>Last 7 days</option><option value="30d" ${state.ledgerRange==='30d'?'selected':''}>Last 30 days</option><option value="month" ${state.ledgerRange==='month'?'selected':''}>Last 1 month</option><option value="dashboard" ${state.ledgerRange==='dashboard'?'selected':''}>Dashboard period</option></select></div>
      <div class="tta-ledgersummary"><div class="tta-ministat"><small>Acquisition lots</small><b id="tta-ledger-lots">${qty(sum.lots)}</b></div><div class="tta-ministat"><small>Items acquired</small><b id="tta-ledger-qty">${qty(sum.qty)}</b></div><div class="tta-ministat"><small>FIFO units sold</small><b id="tta-ledger-sold">${qty(sum.sold)}</b></div><div class="tta-ministat"><small>Realized profit</small><b id="tta-ledger-profit" class="${sum.profit>=0?'pos':'neg'}">${money(sum.profit,true)}</b></div></div>
      <div class="tta-ledgermeta"><span id="tta-ledger-meta">Showing ${qty(shown)} of ${qty(rows.length)} acquisition lots</span><span>Tap a column heading to sort</span></div>
      <div class="tta-ledgerwrap"><table class="tta-ledgertable"><thead><tr>${sortTh('acquiredAt','Date / time')}${sortTh('item','Item')}${sortTh('qty','Qty')}${sortTh('method','Acquired via')}${sortTh('costTotal','Bought for')}${sortTh('soldQty','Sold qty')}${sortTh('soldProceeds','Sold for')}${sortTh('realizedProfit','Profit')}${sortTh('status','Status')}</tr></thead><tbody id="tta-ledger-body">${ledgerTableBodyHtml(rows)}</tbody></table></div>
      <div class="tta-ledgermore"><button id="tta-ledger-more" class="tta-btn secondary" data-act="ledgerMore" ${shown>=rows.length?'hidden':''}>Load 200 more</button></div>
      <div class="tta-note">For free acquisitions such as crimes, gifts, finds and rewards, cost basis is $0. Player Trade acquisition/sale values use the analyzer's market-value allocation plus the equal cash surplus/deficit rule. A partially sold lot shows only realized proceeds/profit for the FIFO-matched quantity.</div>
    </div>`;
  }

'''
assert anchor in s
s=s.replace(anchor,ledger_funcs+anchor,1)

old="""      <div class=\"tta-sectionhead\"><h3>Items in selected period · <span id=\"tta-item-count\">${qty(rows.length)}</span></h3></div>"""
new="""      <div class=\"tta-sectionhead\"><h3>Items in selected period · <span id=\"tta-item-count\">${qty(rows.length)}</span></h3><button class=\"tta-btn secondary\" data-act=\"ledger\">☷ Acquisition history</button></div>"""
assert old in s
s=s.replace(old,new,1)

old="""    root.innerHTML=`<div class=\"tta-shell\">${state.view==='add'?addItemHtml():state.view==='settings'?settingsHtml():dashboardHtml()}</div>${loadingHtml()}<div id=\"tta-toast\" class=\"tta-toast ${state.toast?'show':''}\">${esc(state.toast||'')}</div>`;"""
new="""    root.innerHTML=`<div class=\"tta-shell\">${state.view==='add'?addItemHtml():state.view==='settings'?settingsHtml():state.view==='ledger'?ledgerHtml():dashboardHtml()}</div>${loadingHtml()}<div id=\"tta-toast\" class=\"tta-toast ${state.toast?'show':''}\">${esc(state.toast||'')}</div>`;"""
assert old in s
s=s.replace(old,new,1)

old="""      else if(act==='settings'){state.view='settings';render();}
      else if(act==='addItem'){"""
new="""      else if(act==='settings'){state.view='settings';render();}
      else if(act==='ledger'){state.view='ledger';state.ledgerLimit=200;render({preserveScroll:false});}
      else if(act==='ledgerSort'){
        const key=String(el.dataset.key||'acquiredAt');if(state.ledgerSort===key)state.ledgerSortDir=state.ledgerSortDir==='asc'?'desc':'asc';else{state.ledgerSort=key;state.ledgerSortDir=(key==='item'||key==='method'||key==='status')?'asc':'desc';}
        save('ledgerSort',state.ledgerSort);save('ledgerSortDir',state.ledgerSortDir);state.ledgerLimit=200;renderLedgerRows();
      }
      else if(act==='clearLedgerSearch'){state.ledgerSearch='';save('ledgerSearch','');state.ledgerLimit=200;const input=document.getElementById('tta-ledger-search');if(input){input.value='';input.focus();}renderLedgerRows();}
      else if(act==='ledgerMore'){state.ledgerLimit=(Number(state.ledgerLimit)||200)+200;renderLedgerRows();}
      else if(act==='addItem'){"""
assert old in s
s=s.replace(old,new,1)

old="""      if(target.id==='tta-history-search'){
        state.itemSearch=target.value;save('itemSearch',state.itemSearch);clearTimeout(perfCache.searchTimer);perfCache.searchTimer=setTimeout(()=>renderItemList(),120);
      }else if(target.id==='tta-search'){"""
new="""      if(target.id==='tta-history-search'){
        state.itemSearch=target.value;save('itemSearch',state.itemSearch);clearTimeout(perfCache.searchTimer);perfCache.searchTimer=setTimeout(()=>renderItemList(),120);
      }else if(target.id==='tta-ledger-search'){
        state.ledgerSearch=target.value;save('ledgerSearch',state.ledgerSearch);state.ledgerLimit=200;clearTimeout(perfCache.ledgerSearchTimer);perfCache.ledgerSearchTimer=setTimeout(()=>renderLedgerRows(),120);
      }else if(target.id==='tta-search'){"""
assert old in s
s=s.replace(old,new,1)

old="""    root.addEventListener('change',async e=>{
      const target=e.target;if(!target.dataset.custom)return;if(target.dataset.custom==='from')state.customFrom=target.value;else state.customTo=target.value;save('customFrom',state.customFrom);save('customTo',state.customTo);state.expanded=null;
      await withBusy('Updating custom period','Applying the selected dates to cached analytics…',async()=>render());
    });"""
new="""    root.addEventListener('change',async e=>{
      const target=e.target;
      if(target.dataset.ledgerFilter){
        const kind=target.dataset.ledgerFilter,val=target.value;if(kind==='source')state.ledgerSource=val;else if(kind==='status')state.ledgerStatus=val;else if(kind==='range')state.ledgerRange=val;
        save(kind==='source'?'ledgerSource':kind==='status'?'ledgerStatus':'ledgerRange',val);state.ledgerLimit=200;renderLedgerRows();return;
      }
      if(!target.dataset.custom)return;if(target.dataset.custom==='from')state.customFrom=target.value;else state.customTo=target.value;save('customFrom',state.customFrom);save('customTo',state.customTo);state.expanded=null;
      await withBusy('Updating custom period','Applying the selected dates to cached analytics…',async()=>render());
    });"""
assert old in s
s=s.replace(old,new,1)

old="""        ['tracked','transactions','sync','syncJob','syncCache','logTypesUpdatedAt','pinnedIds','hiddenIds','itemSearch','sortMode'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.pinnedIds=[];state.hiddenIds=[];state.itemSearch='';state.sortMode='recent';state.sync={lastSync:0,firstSyncComplete:false};state.logTypesUpdatedAt=0;state.expanded=null;syncCacheMem=null;resetAnalyticsCache();render();toast('Analyzer data reset.');"""
new="""        ['tracked','transactions','sync','syncJob','syncCache','logTypesUpdatedAt','pinnedIds','hiddenIds','itemSearch','sortMode','ledgerSearch','ledgerSource','ledgerStatus','ledgerRange','ledgerSort','ledgerSortDir'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.pinnedIds=[];state.hiddenIds=[];state.itemSearch='';state.sortMode='recent';state.ledgerSearch='';state.ledgerSource='all';state.ledgerStatus='all';state.ledgerRange='all';state.ledgerSort='acquiredAt';state.ledgerSortDir='desc';state.ledgerLimit=200;state.sync={lastSync:0,firstSyncComplete:false};state.logTypesUpdatedAt=0;state.expanded=null;syncCacheMem=null;resetAnalyticsCache();render();toast('Analyzer data reset.');"""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
