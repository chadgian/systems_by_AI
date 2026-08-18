from pathlib import Path
p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.14' in s
assert "const VERSION = '0.1.14';" in s
s=s.replace('// @version      0.1.14','// @version      0.1.15',1)
s=s.replace("const VERSION = '0.1.14';","const VERSION = '0.1.15';",1)
s=s.replace('Fast Torn trade analytics with corrected sold-item detection, exhaustive completed-trade details, reload-resumable sync, market-value allocation, cached FIFO, and item details. Data stays on-device.',
            'Fast Torn trade analytics with incremental missing-data sync, verified-trade skipping, reload resume, market-value allocation, cached FIFO, and item details. Data stays on-device.',1)
s=s.replace("const REQUEST_GAP_MS = 800; // <=75 requests/minute, leaving headroom under Torn's 100/min user limit.",
            "const REQUEST_GAP_MS = 700; // ~86 requests/minute, keeping headroom under Torn's 100/min user limit.",1)

old="""    logTypes: load('logTypes', []),
    apiKey: load('apiKey', ''),"""
new="""    logTypes: load('logTypes', []),
    logTypesUpdatedAt: load('logTypesUpdatedAt', 0),
    apiKey: load('apiKey', ''),"""
assert old in s
s=s.replace(old,new,1)

old="""  async function ensureLogTypes(force=false) {
    if (state.logTypes.length && !force) return state.logTypes;
    const data=await apiGet('/torn/logtypes');
    state.logTypes=data.logtypes||[];save('logTypes',state.logTypes);return state.logTypes;
  }"""
new="""  async function ensureLogTypes(force=false) {
    const age=nowSec()-(Number(state.logTypesUpdatedAt)||0);
    if(state.logTypes.length&&!force&&age>=0&&age<24*3600)return state.logTypes;
    const data=await apiGet('/torn/logtypes');
    state.logTypes=data.logtypes||[];state.logTypesUpdatedAt=nowSec();save('logTypes',state.logTypes);save('logTypesUpdatedAt',state.logTypesUpdatedAt);return state.logTypes;
  }"""
assert old in s
s=s.replace(old,new,1)

old="""        ['tracked','transactions','sync','syncJob','pinnedIds','hiddenIds','itemSearch','sortMode'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.pinnedIds=[];state.hiddenIds=[];state.itemSearch='';state.sortMode='recent';state.sync={lastSync:0,firstSyncComplete:false};state.expanded=null;resetAnalyticsCache();render();toast('Analyzer data reset.');"""
new="""        ['tracked','transactions','sync','syncJob','syncCache','logTypesUpdatedAt','pinnedIds','hiddenIds','itemSearch','sortMode'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.pinnedIds=[];state.hiddenIds=[];state.itemSearch='';state.sortMode='recent';state.sync={lastSync:0,firstSyncComplete:false};state.logTypesUpdatedAt=0;state.expanded=null;syncCacheMem=null;resetAnalyticsCache();render();toast('Analyzer data reset.');"""
assert old in s
s=s.replace(old,new,1)

old="""  const SYNC_JOB_SCHEMA_VERSION = 1;
  let resumeBootStarted=false,resumableTxMap=null,resumableTxJob='';"""
new="""  const SYNC_JOB_SCHEMA_VERSION = 1;
  const SYNC_CACHE_SCHEMA_VERSION = 1;
  const INCREMENTAL_OVERLAP_SEC = 300;
  let resumeBootStarted=false,resumableTxMap=null,resumableTxJob='',syncCacheMem=null;

  function ensureSyncCache() {
    if(syncCacheMem&&Number(syncCacheMem.schema)===SYNC_CACHE_SCHEMA_VERSION)return syncCacheMem;
    let c=load('syncCache',null);
    if(!c||Number(c.schema)!==SYNC_CACHE_SCHEMA_VERSION)c={schema:SYNC_CACHE_SCHEMA_VERSION,verifiedTrades:{},logCoverageFrom:null,logCoverageTo:0,tradeCoverageFrom:null,tradeCoverageTo:0};
    if(!c.verifiedTrades||typeof c.verifiedTrades!=='object')c.verifiedTrades={};
    let seeded=false;
    for(const t of state.transactions||[]){
      const id=Number(t?.tradeId)||0;
      if(t?.source==='Player Trade'&&id>0&&!c.verifiedTrades[id]){c.verifiedTrades[id]=Number(t.timestamp)||1;seeded=true;}
    }
    syncCacheMem=c;if(seeded)save('syncCache',c);return c;
  }
  function saveSyncCache(){if(syncCacheMem)save('syncCache',syncCacheMem);}
  function incrementalPeriod(period,kind) {
    const c=ensureSyncCache(),fromKey=kind==='trade'?'tradeCoverageFrom':'logCoverageFrom',toKey=kind==='trade'?'tradeCoverageTo':'logCoverageTo';
    const coveredFrom=Number(c[fromKey]),coveredTo=Number(c[toKey])||0;
    if(Number.isFinite(coveredFrom)&&coveredFrom<=period.from&&coveredTo>0){
      if(period.to<=coveredTo)return null;
      return {from:Math.max(period.from,coveredTo-INCREMENTAL_OVERLAP_SEC),to:period.to,incremental:true};
    }
    return {from:period.from,to:period.to,incremental:false};
  }
  function updateSyncCoverage(job) {
    const c=ensureSyncCache();
    const apply=(kind,p)=>{
      if(!p)return;const fk=kind==='trade'?'tradeCoverageFrom':'logCoverageFrom',tk=kind==='trade'?'tradeCoverageTo':'logCoverageTo';
      const oldFrom=Number(c[fk]);if(!p.incremental)c[fk]=Number.isFinite(oldFrom)?Math.min(oldFrom,p.from):p.from;
      c[tk]=Math.max(Number(c[tk])||0,p.to);
    };
    apply('log',job.logScanPeriod);apply('trade',job.tradeScanPeriod);saveSyncCache();
  }
  function isTradeVerified(job,id) {
    id=Number(id)||0;if(!(id>0))return false;
    if((job.verifiedTradeIds||[]).includes(id))return true;
    return !!ensureSyncCache().verifiedTrades[id];
  }
  function markTradeVerified(job,id,ts=0) {
    id=Number(id)||0;if(!(id>0))return;
    const set=new Set((job.verifiedTradeIds||[]).map(Number));set.add(id);job.verifiedTradeIds=[...set];
    if(ts>0)job.verifiedTradeTimes={...(job.verifiedTradeTimes||{}),[id]:Number(ts)||1};
  }
  function commitTradeVerifications(job) {
    const c=ensureSyncCache(),times=job?.verifiedTradeTimes||{};
    for(const id of job?.verifiedTradeIds||[]){const n=Number(id)||0;if(n>0)c.verifiedTrades[n]=Number(times[n])||c.verifiedTrades[n]||1;}
    saveSyncCache();
  }"""
assert old in s
s=s.replace(old,new,1)

old="""  function checkpointTransactionRows(job,rows) {
    if(!rows?.length)return;
    if(!resumableTxMap||resumableTxJob!==job.id){
      resumableTxMap=new Map((state.transactions||[]).filter(Boolean).map(x=>[String(x.id),x]));
      resumableTxJob=job.id;
    }
    for(const row of rows){if(row?.id!=null)resumableTxMap.set(String(row.id),{...row,syncRunId:job.id});}
    const next=[...resumableTxMap.values()];
    localStorage.setItem(NS+'transactions',JSON.stringify(next));
    state.transactions=next;
  }"""
new="""  function checkpointTransactionRows(job,rows) {
    if(!rows?.length)return 0;
    if(!resumableTxMap||resumableTxJob!==job.id){
      resumableTxMap=new Map((state.transactions||[]).filter(Boolean).map(x=>[String(x.id),x]));
      resumableTxJob=job.id;
    }
    let added=0;
    for(const row of rows){
      if(row?.id==null)continue;const key=String(row.id);
      if(resumableTxMap.has(key)){if(job.diagnostics)job.diagnostics.existingRowsSkipped=(Number(job.diagnostics.existingRowsSkipped)||0)+1;continue;}
      resumableTxMap.set(key,{...row,syncRunId:job.id});added++;
    }
    if(!added)return 0;
    const next=[...resumableTxMap.values()];localStorage.setItem(NS+'transactions',JSON.stringify(next));state.transactions=next;return added;
  }"""
assert old in s
s=s.replace(old,new,1)

old="""  function finalizeResumableTransactions(job) {
    const from=Number(job.period?.from)||0,to=Number(job.period?.to)||0;
    let freshCount=0;
    const next=[];
    for(const row of state.transactions||[]){
      if(!row||isLegacyTradeLogTransaction(row))continue;
      const ts=Number(row.timestamp)||0,inPeriod=ts>=from&&ts<=to,current=row.syncRunId===job.id;
      if(inPeriod&&!current)continue;
      if(current)freshCount++;
      if(Object.prototype.hasOwnProperty.call(row,'syncRunId')){const x={...row};delete x.syncRunId;next.push(x);}else next.push(row);
    }
    next.sort((a,b)=>(Number(a.timestamp)||0)-(Number(b.timestamp)||0)||String(a.id).localeCompare(String(b.id)));
    localStorage.setItem(NS+'transactions',JSON.stringify(next));state.transactions=next;resumableTxMap=null;resumableTxJob='';resetAnalyticsCache();
    return freshCount;
  }"""
new="""  function finalizeResumableTransactions(job) {
    let freshCount=0;const next=[];
    for(const row of state.transactions||[]){
      if(!row||isLegacyTradeLogTransaction(row))continue;
      if(row.syncRunId===job.id)freshCount++;
      if(Object.prototype.hasOwnProperty.call(row,'syncRunId')){const x={...row};delete x.syncRunId;next.push(x);}else next.push(row);
    }
    next.sort((a,b)=>(Number(a.timestamp)||0)-(Number(b.timestamp)||0)||String(a.id).localeCompare(String(b.id)));
    localStorage.setItem(NS+'transactions',JSON.stringify(next));state.transactions=next;resumableTxMap=null;resumableTxJob='';resetAnalyticsCache();return freshCount;
  }"""
assert old in s
s=s.replace(old,new,1)

old="""  function newSyncDiagnostics(job,mode,logTypes,batches) {
    return {rawRows:0,parsedRows:0,matchedRows:0,batches,logTypes,pages:0,oldestTimestamp:0,mode,periodFrom:job.period.from,periodTo:job.period.to,tradeHeaders:0,tradeListPages:0,tradeDetails:0,tradesWithItems:0,tradeTransactions:0,tradeSoldQty:0,tradeBoughtQty:0};
  }"""
new="""  function newSyncDiagnostics(job,mode,logTypes,batches) {
    return {rawRows:0,parsedRows:0,matchedRows:0,existingRowsSkipped:0,batches,logTypes,pages:0,oldestTimestamp:0,mode,periodFrom:job.period.from,periodTo:job.period.to,tradeHeaders:0,tradeListPages:0,tradeDetails:0,tradeDetailsSkipped:0,tradesWithItems:0,tradeTransactions:0,tradeSoldQty:0,tradeBoughtQty:0,incrementalLogs:!!job.logScanPeriod?.incremental,incrementalTrades:!!job.tradeScanPeriod?.incremental};
  }"""
assert old in s
s=s.replace(old,new,1)

old="""  function createResumableSyncJob() {
    stripSyncRunMarkers();
    const period=selectedPeriodBounds(),periodText=period.from>0?`${dateStr(period.from)} – ${dateStr(Math.min(period.to,nowSec()))}`:'all available history';
    const job={schema:SYNC_JOB_SCHEMA_VERSION,id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,active:true,cancelled:false,createdAt:nowSec(),updatedAt:nowSec(),period,periodText,phase:'setup',progress:`Preparing historical scan for ${periodText}…`,resumedCount:0,logTypeIds:[],logMode:'filtered',logBatchIndex:0,logCursorTo:period.to,logPage:0,logPreviousSignature:'',userId:0,diagnostics:null,tradeHeaders:[],tradeListParams:null,tradeListSeen:[],tradeDetailIndex:0};
    checkpointSyncJob(job,job.progress);return job;
  }"""
new="""  function createResumableSyncJob() {
    stripSyncRunMarkers();
    const period=selectedPeriodBounds(),periodText=period.from>0?`${dateStr(period.from)} – ${dateStr(Math.min(period.to,nowSec()))}`:'all available history';
    const logScanPeriod=incrementalPeriod(period,'log'),tradeScanPeriod=incrementalPeriod(period,'trade');
    const job={schema:SYNC_JOB_SCHEMA_VERSION,id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,active:true,cancelled:false,createdAt:nowSec(),updatedAt:nowSec(),period,periodText,logScanPeriod,tradeScanPeriod,phase:'setup',progress:`Preparing incremental sync for ${periodText}…`,resumedCount:0,logTypeIds:[],logMode:'filtered',logBatchIndex:0,logCursorTo:logScanPeriod?.to||period.to,logPage:0,logPreviousSignature:'',userId:0,diagnostics:null,tradeHeaders:[],tradeListParams:null,tradeListSeen:[],tradeDetailIndex:0,verifiedTradeIds:[],verifiedTradeTimes:{}};
    checkpointSyncJob(job,job.progress);return job;
  }"""
assert old in s
s=s.replace(old,new,1)

old="""  function advanceResumableLogBatch(job) {
    job.logBatchIndex=(Number(job.logBatchIndex)||0)+1;job.logCursorTo=job.period.to;job.logPage=0;job.logPreviousSignature='';
  }"""
new="""  function advanceResumableLogBatch(job) {
    const p=job.logScanPeriod||job.period;job.logBatchIndex=(Number(job.logBatchIndex)||0)+1;job.logCursorTo=p.to;job.logPage=0;job.logPreviousSignature='';
  }"""
assert old in s
s=s.replace(old,new,1)

s=s.replace("""  async function runResumableLogPhase(job,mode) {
    const filtered=mode==='filtered',ids=filtered?(job.logTypeIds||[]):[],totalBatches=filtered?Math.ceil(ids.length/MAX_LOG_IDS_PER_REQUEST):1;""",
"""  async function runResumableLogPhase(job,mode) {
    const scanPeriod=job.logScanPeriod||job.period,filtered=mode==='filtered',ids=filtered?(job.logTypeIds||[]):[],totalBatches=filtered?Math.ceil(ids.length/MAX_LOG_IDS_PER_REQUEST):1;""",1)
s=s.replace("job.logCursorTo=job.period.to;job.logPage=0;job.logPreviousSignature='';","job.logCursorTo=scanPeriod.to;job.logPage=0;job.logPreviousSignature='';",1)
s=s.replace("const cursor=Number(job.logCursorTo)||job.period.to,page=","const cursor=Number(job.logCursorTo)||scanPeriod.to,page=",1)
s=s.replace("dateStr(Math.max(job.period.from,Math.min(cursor,nowSec())))","dateStr(Math.max(scanPeriod.from,Math.min(cursor,nowSec())))",1)
s=s.replace("const params={limit:100,to:cursor};if(job.period.from>0)params.from=job.period.from;","const params={limit:100,to:cursor};if(scanPeriod.from>0)params.from=scanPeriod.from;",1)
s=s.replace("if(ts<job.period.from||ts>job.period.to)continue;","if(ts<scanPeriod.from||ts>scanPeriod.to)continue;",1)
s=s.replace("let done=job.period.from>0&&oldest<=job.period.from,nextTo=oldest;","let done=scanPeriod.from>0&&oldest<=scanPeriod.from,nextTo=oldest;",1)
s=s.replace("(job.period.from>0&&nextTo<job.period.from)","(scanPeriod.from>0&&nextTo<scanPeriod.from)",1)

old="""  async function runResumableTradeList(job) {
    const found=new Map((job.tradeHeaders||[]).map(x=>[Number(x.id),x]));
    let params=job.tradeListParams||{cat:'finished',limit:100,sort:'DESC',to:job.period.to};if(job.period.from>0&&!('from'in params))params.from=job.period.from;"""
new="""  async function runResumableTradeList(job) {
    const scanPeriod=job.tradeScanPeriod;
    if(!scanPeriod){job.phase='finalize';checkpointSyncJob(job,'Player trades already fully covered · no trade API requests needed.');return true;}
    const found=new Map((job.tradeHeaders||[]).map(x=>[Number(x.id),x]));
    let params=job.tradeListParams||{cat:'finished',limit:100,sort:'DESC',to:scanPeriod.to};if(scanPeriod.from>0&&!('from'in params))params.from=scanPeriod.from;"""
assert old in s
s=s.replace(old,new,1)
s=s.replace("if(h&&h.completed_at>=job.period.from&&h.completed_at<=job.period.to)","if(h&&h.completed_at>=scanPeriod.from&&h.completed_at<=scanPeriod.to)",1)

old="""      const i=Number(job.tradeDetailIndex)||0,h=headers[i];
      checkpointSyncJob(job,`Player trades · ${i+1}/${headers.length} · checking detailed trade #${Number(h.id)}`);
      const data=await syncApiGet(`/user/${Number(h.id)}/trade`);job.diagnostics.tradeDetails=(Number(job.diagnostics.tradeDetails)||0)+1;"""
new="""      const i=Number(job.tradeDetailIndex)||0,h=headers[i];
      if(isTradeVerified(job,h.id)){
        job.diagnostics.tradeDetailsSkipped=(Number(job.diagnostics.tradeDetailsSkipped)||0)+1;job.tradeDetailIndex=i+1;
        checkpointSyncJob(job,`Player trades · ${i+1}/${headers.length} · already verified, skipped`);continue;
      }
      checkpointSyncJob(job,`Player trades · ${i+1}/${headers.length} · fetching missing detailed trade #${Number(h.id)}`);
      const data=await syncApiGet(`/user/${Number(h.id)}/trade`);job.diagnostics.tradeDetails=(Number(job.diagnostics.tradeDetails)||0)+1;"""
assert old in s
s=s.replace(old,new,1)

old="""      if(rows.length){
        job.diagnostics.tradesWithItems=(Number(job.diagnostics.tradesWithItems)||0)+1;
        job.diagnostics.tradeTransactions=(Number(job.diagnostics.tradeTransactions)||0)+rows.length;
        job.diagnostics.tradeSoldQty=(Number(job.diagnostics.tradeSoldQty)||0)+soldRows.reduce((n,x)=>n+(Number(x.qty)||0),0);
        job.diagnostics.tradeBoughtQty=(Number(job.diagnostics.tradeBoughtQty)||0)+boughtRows.reduce((n,x)=>n+(Number(x.qty)||0),0);
        checkpointTransactionRows(job,rows);
      }
      job.tradeDetailIndex=i+1;checkpointSyncJob(job,`Player trades · ${i+1}/${headers.length} · ${qty(job.diagnostics.tradeTransactions||0)} allocated item rows checkpointed`);"""
new="""      if(rows.length){
        job.diagnostics.tradesWithItems=(Number(job.diagnostics.tradesWithItems)||0)+1;
        job.diagnostics.tradeTransactions=(Number(job.diagnostics.tradeTransactions)||0)+rows.length;
        job.diagnostics.tradeSoldQty=(Number(job.diagnostics.tradeSoldQty)||0)+soldRows.reduce((n,x)=>n+(Number(x.qty)||0),0);
        job.diagnostics.tradeBoughtQty=(Number(job.diagnostics.tradeBoughtQty)||0)+boughtRows.reduce((n,x)=>n+(Number(x.qty)||0),0);
        checkpointTransactionRows(job,rows);
      }
      markTradeVerified(job,h.id,h.completed_at);job.tradeDetailIndex=i+1;checkpointSyncJob(job,`Player trades · ${i+1}/${headers.length} · detail verified and cached`);"""
assert old in s
s=s.replace(old,new,1)

old="""  async function prepareResumableSync(job) {
    await ensureCatalog();setBusyDetail('Verifying API access and log types…');
    const keyInfo=await inspectActiveKey(),probe=await probeUserLogs(),types=relevantLogTypes(await ensureLogTypes(true));
    if(!types.length)throw new Error('No relevant Torn transaction or free-acquisition log types were detected.');
    job.userId=keyInfo.userId;job.logTypeIds=types.map(x=>Number(x.id)).filter(x=>x>0);job.logMode='filtered';job.logBatchIndex=0;job.logCursorTo=job.period.to;job.logPage=0;job.logPreviousSignature='';
    job.diagnostics=newSyncDiagnostics(job,'filtered',job.logTypeIds.length,Math.ceil(job.logTypeIds.length/MAX_LOG_IDS_PER_REQUEST));
    job.diagnostics.keyType=keyInfo.type;job.diagnostics.keyLevel=keyInfo.level;job.diagnostics.keySource=keySource();job.diagnostics.customLogPermissions=keyInfo.customLogPermissions;job.diagnostics.probeRows=probe.rows.length;
    job.phase='logs-filtered';checkpointSyncJob(job,`Scanning the complete selected period: ${job.periodText}…`);
  }"""
new="""  async function prepareResumableSync(job) {
    await ensureCatalog();setBusyDetail('Verifying API access and incremental coverage…');
    const keyInfo=await inspectActiveKey();if(!keyInfo.hasUserLog)throw new Error('This API key does not include User → Log access.');
    let types=[];if(job.logScanPeriod)types=relevantLogTypes(await ensureLogTypes(false));
    if(job.logScanPeriod&&!types.length)throw new Error('No relevant Torn transaction or free-acquisition log types were detected.');
    job.userId=keyInfo.userId;job.logTypeIds=types.map(x=>Number(x.id)).filter(x=>x>0);job.logMode='filtered';job.logBatchIndex=0;job.logCursorTo=job.logScanPeriod?.to||job.period.to;job.logPage=0;job.logPreviousSignature='';
    job.diagnostics=newSyncDiagnostics(job,'filtered',job.logTypeIds.length,job.logScanPeriod?Math.ceil(job.logTypeIds.length/MAX_LOG_IDS_PER_REQUEST):0);
    job.diagnostics.keyType=keyInfo.type;job.diagnostics.keyLevel=keyInfo.level;job.diagnostics.keySource=keySource();job.diagnostics.customLogPermissions=keyInfo.customLogPermissions;job.diagnostics.probeRows=0;
    if(job.logScanPeriod){job.phase='logs-filtered';checkpointSyncJob(job,`${job.logScanPeriod.incremental?'Scanning only new/missing logs':'Establishing log baseline'} · ${dateStr(job.logScanPeriod.from)} – ${dateStr(Math.min(job.logScanPeriod.to,nowSec()))}`);}
    else{job.phase='trades-list';checkpointSyncJob(job,'Normal sale logs already fully covered · skipping log scan.');}
  }"""
assert old in s
s=s.replace(old,new,1)

old="""  function finishResumableSync(job) {
    const freshCount=finalizeResumableTransactions(job),d=job.diagnostics||{};
    state.sync.lastSync=nowSec();state.sync.firstSyncComplete=true;state.sync.autoDiscoveryComplete=true;"""
new="""  function finishResumableSync(job) {
    const freshCount=finalizeResumableTransactions(job),d=job.diagnostics||{};commitTradeVerifications(job);updateSyncCoverage(job);
    state.sync.lastSync=nowSec();state.sync.firstSyncComplete=true;state.sync.autoDiscoveryComplete=true;"""
assert old in s
s=s.replace(old,new,1)

old="""    if(!freshCount)setSyncProgress(`${mode} completed for ${job.periodText} · ${qty(d.rawRows||0)} raw logs scanned · no recognizable item acquisitions or sales found.`);
    else setSyncProgress(`Historical sync complete for ${job.periodText} · ${qty(freshCount)} item rows · ${qty(d.tradesWithItems||0)} player trades · ${qty(d.rawRows||0)} raw logs across ${qty(d.pages||0)} log pages.`);"""
new="""    if(!freshCount)setSyncProgress(`Sync up to date for ${job.periodText} · ${qty(d.existingRowsSkipped||0)} existing rows skipped · ${qty(d.tradeDetailsSkipped||0)} verified trade details skipped.`);
    else setSyncProgress(`Incremental sync complete · ${qty(freshCount)} new item rows · ${qty(d.existingRowsSkipped||0)} existing rows skipped · ${qty(d.tradeDetailsSkipped||0)} verified trades skipped · ${qty(d.tradeDetails||0)} missing trade details fetched.`);"""
assert old in s
s=s.replace(old,new,1)

old="""          if((Number(job.diagnostics?.rawRows)||0)===0){job.phase='logs-fallback';job.logMode='unfiltered';job.logBatchIndex=0;job.logCursorTo=job.period.to;job.logPage=0;job.logPreviousSignature='';job.diagnostics=newSyncDiagnostics(job,'unfiltered-fallback',0,1);checkpointSyncJob(job,'Filtered scan returned no raw rows · starting compatibility scan…');}
          else{job.phase='trades-list';checkpointSyncJob(job,`Scanning completed player trades for ${job.periodText}…`);}"""
new="""          if((Number(job.diagnostics?.rawRows)||0)===0&&!job.logScanPeriod?.incremental){job.phase='logs-fallback';job.logMode='unfiltered';job.logBatchIndex=0;job.logCursorTo=job.logScanPeriod?.to||job.period.to;job.logPage=0;job.logPreviousSignature='';job.diagnostics=newSyncDiagnostics(job,'unfiltered-fallback',0,1);checkpointSyncJob(job,'Baseline filtered scan returned no raw rows · starting compatibility scan…');}
          else{job.phase='trades-list';checkpointSyncJob(job,`Checking only missing player trades for ${job.periodText}…`);}"""
assert old in s
s=s.replace(old,new,1)
s=s.replace("job.phase='trades-list';checkpointSyncJob(job,`Scanning completed player trades for ${job.periodText}…`);","job.phase='trades-list';checkpointSyncJob(job,`Checking only missing player trades for ${job.periodText}…`);",1)

old="""      if(syncJobCancelled(job)){
        job.cancelled=true;abandonResumableMarkers(job);clearSyncJob();setSyncProgress(`Sync stopped · ${qty(job.diagnostics?.rawRows||0)} raw logs scanned · partial checkpointed rows kept safely.`);
      }"""
new="""      if(syncJobCancelled(job)){
        job.cancelled=true;commitTradeVerifications(job);abandonResumableMarkers(job);clearSyncJob();setSyncProgress(`Sync stopped · verified trade details remain cached · partial new rows kept safely.`);
      }"""
assert old in s
s=s.replace(old,new,1)

old="""Player trades: ${qty(state.sync.diagnostics.tradesWithItems||0)} with items · ${qty(state.sync.diagnostics.tradeDetails||0)} detailed trades fetched · ${qty(state.sync.diagnostics.tradeTransactions||0)} allocated item rows · ${qty(state.sync.diagnostics.tradeSoldQty||0)} items sold via trades."""
new="""Player trades: ${qty(state.sync.diagnostics.tradesWithItems||0)} with items · ${qty(state.sync.diagnostics.tradeDetails||0)} missing details fetched · ${qty(state.sync.diagnostics.tradeDetailsSkipped||0)} already verified details skipped · ${qty(state.sync.diagnostics.tradeTransactions||0)} allocated item rows · ${qty(state.sync.diagnostics.tradeSoldQty||0)} items sold via trades.<br>Incremental cache: ${qty(state.sync.diagnostics.existingRowsSkipped||0)} existing transaction rows skipped."""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
