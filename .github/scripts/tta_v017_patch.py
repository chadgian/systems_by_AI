from pathlib import Path

p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.6' in s
assert "const VERSION = '0.1.6';" in s
s=s.replace('// @version      0.1.6','// @version      0.1.7',1)
s=s.replace("const VERSION = '0.1.6';","const VERSION = '0.1.7';",1)
s=s.replace('Automatically discover items from Torn history, calculate FIFO realized profit, and chart profit by day/week/month. Data stays on-device.','Automatically discover item history for the selected period, calculate FIFO realized profit, and chart profit by day/week/month. Data stays on-device.',1)

a=s.index('  function dateRange() {')
b=s.index('\n\n  function fifoAnalytics',a)
period_block=r'''  function subtractCalendarMonth(date) {
    const d=new Date(date);
    const day=d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth()-1);
    const maxDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(day,maxDay));
    return d;
  }

  function selectedPeriodBounds(nowDate=new Date()) {
    const nowMs=nowDate.getTime();
    let from=0,to=Math.floor(nowMs/1000)+60;
    if(state.dateMode==='7d') from=Math.floor((nowMs-7*86400*1000)/1000);
    else if(state.dateMode==='30d') from=Math.floor((nowMs-30*86400*1000)/1000);
    else if(state.dateMode==='month') from=Math.floor(subtractCalendarMonth(nowDate).getTime()/1000);
    else if(state.dateMode==='custom') {
      if(state.customFrom) from=Math.floor(new Date(state.customFrom+'T00:00:00').getTime()/1000);
      if(state.customTo) to=Math.min(to,Math.floor(new Date(state.customTo+'T23:59:59').getTime()/1000));
    }
    if(!Number.isFinite(from)||from<0)from=0;
    if(!Number.isFinite(to))to=Math.floor(nowMs/1000)+60;
    return {from:Math.floor(from),to:Math.floor(to)};
  }

  function dateRange() {
    const allTx=effectiveTransactions();
    const bounds=selectedPeriodBounds();
    let from=bounds.from,to=bounds.to;
    if(state.dateMode==='all'&&allTx.length)from=Math.min(...allTx.map(x=>x.timestamp));
    return {from,to};
  }'''
s=s[:a]+period_block+s[b:]

old="""    const rows=effectiveTracked()\n      .filter(item=>!q || item.name.toLowerCase().includes(q) || String(item.id).includes(q))\n      .map(item=>({item,summary:summaryFor(item.id),lastActivity:lastById.get(Number(item.id))||0,pinned:pinned.has(Number(item.id))}));"""
new="""    const rows=effectiveTracked()\n      .filter(item=>!q || item.name.toLowerCase().includes(q) || String(item.id).includes(q))\n      .map(item=>({item,summary:summaryFor(item.id),lastActivity:lastById.get(Number(item.id))||0,pinned:pinned.has(Number(item.id))}))\n      .filter(row=>row.summary.events.length>0);"""
assert old in s
s=s.replace(old,new,1)

assert "['month','This month']" in s
s=s.replace("['month','This month']","['month','1 month']",1)

old="""  const previousScroll=preserveScroll && previousShell ? previousShell.scrollTop : 0;\n  if(!state.open){root.classList.remove('show');return;} root.classList.add('show');"""
new="""  const previousScroll=preserveScroll && previousShell ? previousShell.scrollTop : 0;\n  const fab=document.getElementById('tta-fab');\n  if(fab)fab.style.display=state.open?'none':'inline-flex';\n  if(!state.open){root.classList.remove('show');return;} root.classList.add('show');"""
assert old in s
s=s.replace(old,new,1)

old="""    const s=overall(), rows=historyItemRows(), allItems=effectiveTracked(), range=dateRange();\n    const pinnedCount=(state.pinnedIds||[]).filter(id=>allItems.some(x=>Number(x.id)===Number(id))).length;"""
new="""    const s=overall(), rows=historyItemRows(), allItems=effectiveTracked(), range=dateRange();\n    const requested=selectedPeriodBounds();\n    const coverageFrom=Number(state.sync?.coverageFrom);\n    const needsBackfill=hasApiKey()&&state.sync?.firstSyncComplete&&requested.from>0&&(!Number.isFinite(coverageFrom)||coverageFrom>requested.from);\n    const pinnedCount=(state.pinnedIds||[]).filter(id=>allItems.some(x=>Number(x.id)===Number(id))).length;"""
assert old in s
s=s.replace(old,new,1)
banner="      ${hasApiKey()&&!state.sync?.autoDiscoveryComplete?`<div class=\"tta-banner\"><strong>v${VERSION} auto-discovery:</strong> Run Sync once to discover every recognizable item in your Torn acquisition and sale history. Manual item tracking is no longer required.</div>`:''}"
assert banner in s
s=s.replace(banner,banner+"\n      ${needsBackfill?`<div class=\"tta-banner\"><strong>More history needed:</strong> This period starts ${esc(dateStr(requested.from))}, earlier than the local cache. Press <strong>Sync</strong> to backfill the full selected period.</div>`:''}",1)

a=s.index('  async function fetchFilteredHistory(logIds) {')
b=s.index('\n\n  function demoCatalog',a)
scan_block=r'''  function rawLogKey(r) {
    return String(r?.id??`${r?.timestamp||0}:${r?.details?.id||0}:${JSON.stringify(r?.data||r?.params||{})}`);
  }

  async function scanLogWindow(baseParams,period,label,found,diagnostics) {
    let cursorTo=period.to;
    let page=0;
    let previousSignature='';
    const seenRaw=new Set();
    while(!state.syncCancel){
      const params={...baseParams,limit:100,to:cursorTo};
      if(period.from>0)params.from=period.from;
      page++;diagnostics.pages++;
      state.syncProgress=`${label} · page ${page} · back to ${dateStr(Math.max(period.from,Math.min(cursorTo,nowSec())))} · ${qty(found.size)} item rows`;render();
      const data=await apiGet('/user/log',params);
      const rows=Array.isArray(data?.log)?data.log:[];
      if(!rows.length)break;
      const signature=rows.map(rawLogKey).join('|');
      const unseen=rows.filter(r=>{const k=rawLogKey(r);if(seenRaw.has(k))return false;seenRaw.add(k);return true;});
      diagnostics.rawRows+=unseen.length;
      unseen.forEach(r=>{
        const ts=Number(r?.timestamp)||0;
        if(ts<period.from||ts>period.to)return;
        const parsed=parseLogEntry(r);
        diagnostics.parsedRows+=parsed.length;
        parsed.forEach(t=>{found.set(t.id,t);diagnostics.matchedRows++;});
      });
      const timestamps=rows.map(r=>Number(r?.timestamp)).filter(Number.isFinite);
      if(!timestamps.length)break;
      const oldest=Math.min(...timestamps);
      diagnostics.oldestTimestamp=diagnostics.oldestTimestamp?Math.min(diagnostics.oldestTimestamp,oldest):oldest;
      if(period.from>0&&oldest<=period.from)break;
      let nextTo=oldest;
      if(signature===previousSignature)nextTo=oldest-1;
      if(!Number.isFinite(nextTo)||(nextTo>=cursorTo&&signature===previousSignature))break;
      if(period.from>0&&nextTo<period.from)break;
      previousSignature=signature;
      cursorTo=nextTo;
      await sleep(REQUEST_GAP_MS);
    }
  }

  async function fetchFilteredHistory(logIds,period) {
    const found=new Map();
    const diagnostics={rawRows:0,parsedRows:0,matchedRows:0,batches:Math.ceil(logIds.length/MAX_LOG_IDS_PER_REQUEST),logTypes:logIds.length,pages:0,oldestTimestamp:0,mode:'filtered',periodFrom:period.from,periodTo:period.to};
    for(let b=0;b<logIds.length;b+=MAX_LOG_IDS_PER_REQUEST){
      if(state.syncCancel)break;
      const ids=logIds.slice(b,b+MAX_LOG_IDS_PER_REQUEST);
      await scanLogWindow({log:ids.join(',')},period,`Historical scan ${Math.floor(b/MAX_LOG_IDS_PER_REQUEST)+1}/${diagnostics.batches}`,found,diagnostics);
      if(!state.syncCancel)await sleep(REQUEST_GAP_MS);
    }
    return {transactions:[...found.values()],diagnostics};
  }

  async function fetchUnfilteredHistory(period) {
    const found=new Map();
    const diagnostics={rawRows:0,parsedRows:0,matchedRows:0,batches:1,logTypes:0,pages:0,oldestTimestamp:0,mode:'unfiltered-fallback',periodFrom:period.from,periodTo:period.to};
    await scanLogWindow({},period,'Compatibility history scan',found,diagnostics);
    return {transactions:[...found.values()],diagnostics};
  }

  async function syncAll() {
    if(state.syncing)return;
    if(!hasApiKey()){state.demo=true;toast('Add a Torn API key in Settings → API Key to sync real history.');render();return;}
    const period=selectedPeriodBounds();
    const periodText=period.from>0?`${dateStr(period.from)} – ${dateStr(Math.min(period.to,nowSec()))}`:'all available history';
    state.syncing=true;state.syncCancel=false;state.syncProgress=`Preparing historical scan for ${periodText}…`;render();
    try {
      await ensureCatalog();
      const keyInfo=await inspectActiveKey();
      const probe=await probeUserLogs();
      const types=relevantLogTypes(await ensureLogTypes(true));
      if(!types.length) throw new Error('No relevant Torn transaction or free-acquisition log types were detected.');
      state.syncProgress=`Scanning the complete selected period: ${periodText}…`;render();
      let scan=await fetchFilteredHistory(types.map(x=>x.id),period);
      if(scan.diagnostics.rawRows===0){
        state.syncProgress='Filtered period scan returned no raw rows. Trying unfiltered compatibility scan for the same dates…';render();
        scan=await fetchUnfilteredHistory(period);
      }
      scan.diagnostics.keyType=keyInfo.type;
      scan.diagnostics.keyLevel=keyInfo.level;
      scan.diagnostics.keySource=keySource();
      scan.diagnostics.customLogPermissions=keyInfo.customLogPermissions;
      scan.diagnostics.probeRows=probe.rows.length;
      const fresh=scan.transactions;
      const outside=state.transactions.filter(t=>Number(t.timestamp)<period.from||Number(t.timestamp)>period.to);
      const merged=new Map(outside.map(x=>[x.id,x]));
      fresh.forEach(x=>merged.set(x.id,x));
      state.transactions=[...merged.values()].sort((a,b)=>a.timestamp-b.timestamp);
      save('transactions',state.transactions);
      state.sync.lastSync=nowSec();
      state.sync.firstSyncComplete=!state.syncCancel;
      state.sync.autoDiscoveryComplete=!state.syncCancel;
      if(!state.syncCancel){
        const oldCoverage=Number(state.sync.coverageFrom);
        state.sync.coverageFrom=Number.isFinite(oldCoverage)?Math.min(oldCoverage,period.from):period.from;
        state.sync.coverageTo=Math.max(Number(state.sync.coverageTo)||0,Math.min(period.to,nowSec()));
      }
      state.sync.diagnostics=scan.diagnostics;save('sync',state.sync);
      const mode=scan.diagnostics.mode==='unfiltered-fallback'?'compatibility scan':'filtered scan';
      if(state.syncCancel) state.syncProgress=`Sync stopped · ${qty(scan.diagnostics.rawRows)} raw logs scanned · ${qty(fresh.length)} item rows collected.`;
      else if(!fresh.length) state.syncProgress=`${mode} completed for ${periodText} · ${qty(scan.diagnostics.rawRows)} raw logs scanned · no recognizable item acquisitions or sales found.`;
      else state.syncProgress=`Historical sync complete for ${periodText} · ${qty(fresh.length)} item rows in this period · ${qty(scan.diagnostics.rawRows)} raw logs scanned across ${qty(scan.diagnostics.pages)} pages.`;
    } catch(e) {
      state.syncProgress=`Sync error: ${e.message}`;
    } finally {state.syncing=false;render();}
  }'''
s=s[:a]+scan_block+s[b:]

old="${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types.`:''}"
new="${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.pages||0)} pages · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types.${state.sync.diagnostics.periodFrom?`<br>Period scanned: ${esc(dateStr(state.sync.diagnostics.periodFrom))} – ${esc(dateStr(Math.min(state.sync.diagnostics.periodTo||nowSec(),nowSec())))}`:'<br>Period scanned: all available history.'}`:''}"
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
