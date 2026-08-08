from pathlib import Path

p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.10' in s
assert "const VERSION = '0.1.10';" in s
s=s.replace('// @version      0.1.10','// @version      0.1.11',1)
s=s.replace("const VERSION = '0.1.10';","const VERSION = '0.1.11';",1)
s=s.replace('Fast, period-aware Torn trade analytics with market values, item details, cached FIFO calculations, hide/pin/search/sort controls, and progressive loading. Data stays on-device.','Fast Torn trade analytics with authoritative player trades, market-value cash allocation, cached FIFO calculations, item details, and progressive loading. Data stays on-device.',1)

# Player-trade logs are superseded by the authoritative completed-trade API.
old="""    const title=entry.details?.title||'';
    const payload={...(entry.params||{}),...(entry.data||{})};"""
new="""    const title=entry.details?.title||'';
    if(/\\btrade\\b/i.test(title))return[];
    const payload={...(entry.params||{}),...(entry.data||{})};"""
assert old in s
s=s.replace(old,new,1)

# Don't spend log-filter slots on player-trade movement logs.
old="""    const id=Number(x?.id),title=String(x?.title||'');
    if(id && ((paidContext.test(title) && paidAction.test(title)) || itemMovement.test(title) || freeContext.test(title) || KNOWN_TRANSACTION_LOGS.has(id))) byId.set(id,{...x,id});"""
new="""    const id=Number(x?.id),title=String(x?.title||'');
    if(/\\btrade\\b/i.test(title))return;
    if(id && ((paidContext.test(title) && paidAction.test(title)) || itemMovement.test(title) || freeContext.test(title) || KNOWN_TRANSACTION_LOGS.has(id))) byId.set(id,{...x,id});"""
assert old in s
s=s.replace(old,new,1)

# Add authoritative completed-trade normalization and equal surplus/deficit allocation.
marker="""  function nextLogPageParams(data,currentParams) {"""
assert marker in s
trade_helpers=r'''
  function tradeItemGroups(entries,userId,outgoing=true) {
    const map=new Map(),me=Number(userId);
    for(const entry of entries||[]){
      if(entry?.type!=='Item')continue;
      const owner=Number(entry?.user_id),mine=owner===me;
      if((outgoing&&!mine)||(!outgoing&&mine))continue;
      const id=Number(entry?.details?.id),amount=Number(entry?.details?.amount)||0;
      if(!(id>0)||!(amount>0))continue;
      const row=map.get(id)||{itemId:id,qty:0};row.qty+=amount;map.set(id,row);
    }
    return [...map.values()].map(row=>{
      const marketPrice=Math.max(0,Number(catalogItem(row.itemId)?.marketPrice)||0);
      return {...row,marketPrice,baseMarket:marketPrice*row.qty};
    });
  }

  function tradeMoneyFor(entries,userId,owned=true) {
    const me=Number(userId);let total=0;
    for(const entry of entries||[]){
      if(entry?.type!=='Money')continue;
      const mine=Number(entry?.user_id)===me;if((owned&&!mine)||(!owned&&mine))continue;
      total+=Math.max(0,Number(entry?.details?.amount)||0);
    }
    return total;
  }

  // Start from each item type's market-value subtotal, then distribute the cash
  // surplus/deficit equally by item type. Negative allocations are floored at $0
  // and the remaining deficit is redistributed evenly among the other item types.
  function allocateTradeGroupTotals(groups,targetTotal) {
    if(!groups?.length)return[];
    const target=Math.max(0,Number(targetTotal)||0);
    const values=groups.map(g=>Math.max(0,Number(g.baseMarket)||0));
    const baseTotal=values.reduce((n,x)=>n+x,0);
    let delta=target-baseTotal;
    if(delta>=0){
      const add=delta/values.length;for(let i=0;i<values.length;i++)values[i]+=add;
    }else{
      let deficit=-delta,active=values.map((_,i)=>i);
      while(deficit>1e-7&&active.length){
        const share=deficit/active.length,removed=[];
        for(const i of active){if(values[i]<=share+1e-7){deficit-=values[i];values[i]=0;removed.push(i);}}
        if(!removed.length){for(const i of active)values[i]-=share;deficit=0;}
        else active=active.filter(i=>!removed.includes(i));
      }
    }
    const correction=target-values.reduce((n,x)=>n+x,0);
    if(values.length)values[values.length-1]=Math.max(0,values[values.length-1]+correction);
    return groups.map((g,i)=>({...g,total:values[i],adjustment:values[i]-(Number(g.baseMarket)||0)}));
  }

  function parsePlayerTrade(trade,userId) {
    const tradeId=Number(trade?.id)||0,ts=Number(trade?.completed_at||trade?.timestamp)||0,me=Number(userId);
    const entries=Array.isArray(trade?.items)?trade.items:[];
    if(!(tradeId>0)||!(ts>0)||!(me>0)||!entries.length)return[];
    const outgoing=tradeItemGroups(entries,me,true),incoming=tradeItemGroups(entries,me,false);
    if(!outgoing.length&&!incoming.length)return[];
    const cashOut=tradeMoneyFor(entries,me,true),cashIn=tradeMoneyFor(entries,me,false),netCash=cashIn-cashOut;
    const mvOut=outgoing.reduce((n,x)=>n+x.baseMarket,0),mvIn=incoming.reduce((n,x)=>n+x.baseMarket,0);
    let saleTarget=0,buyTarget=0;
    if(outgoing.length&&!incoming.length)saleTarget=Math.max(0,netCash);
    else if(incoming.length&&!outgoing.length)buyTarget=Math.max(0,-netCash);
    else if(outgoing.length&&incoming.length){
      buyTarget=mvIn;saleTarget=mvIn+netCash;
      if(saleTarget<0){saleTarget=mvOut;buyTarget=mvOut-netCash;}
    }
    const saleGroups=allocateTradeGroupTotals(outgoing,saleTarget),buyGroups=allocateTradeGroupTotals(incoming,buyTarget);
    const user=trade?.user||{},trader=trade?.trader||{};
    const other=Number(user?.id)===me?trader:user;
    const tradeSurplus=(mvIn+cashIn)-(mvOut+cashOut);
    const common={timestamp:ts,fee:0,source:'Player Trade',title:`Player Trade${other?.name?` with ${other.name}`:''}`,tradeId,counterpartyId:Number(other?.id)||0,counterpartyName:String(other?.name||''),tradeCashIn:cashIn,tradeCashOut:cashOut,tradeSurplus,allocationMethod:'market-value + equal cash delta'};
    const sold=saleGroups.map(g=>({id:`trade:${tradeId}:1:sell:${g.itemId}`,logId:0,itemId:g.itemId,side:'sell',qty:g.qty,total:g.total,netTotal:g.total,free:false,marketPriceUsed:g.marketPrice,marketSubtotal:g.baseMarket,tradeAdjustment:g.adjustment,...common}));
    const bought=buyGroups.map(g=>({id:`trade:${tradeId}:2:buy:${g.itemId}`,logId:0,itemId:g.itemId,side:'buy',qty:g.qty,total:g.total,netTotal:g.total,free:g.total<=1e-7,marketPriceUsed:g.marketPrice,marketSubtotal:g.baseMarket,tradeAdjustment:g.adjustment,...common}));
    return [...sold,...bought];
  }

  function isLegacyTradeLogTransaction(t) {
    return t?.source!=='Player Trade'&&/\btrade\b/i.test(String(t?.title||''));
  }

'''
s=s.replace(marker,trade_helpers+marker,1)

# Fetch completed trades for the same selected period and then detail only relevant trades.
marker="""  async function fetchFilteredHistory(logIds,period) {"""
assert marker in s
trade_fetch=r'''
  async function fetchCompletedTradeHeaders(period) {
    let params={cat:'finished',limit:100,sort:'DESC',to:period.to};if(period.from>0)params.from=period.from;
    const found=new Map(),seenPages=new Set();let pages=0;
    while(!state.syncCancel){
      pages++;setSyncProgress(`Player trades · list page ${pages} · ${qty(found.size)} completed trades found`);
      const data=await apiGet('/user/trades',params),rows=Array.isArray(data?.trades)?data.trades:[];
      for(const row of rows){const ts=Number(row?.completed_at||row?.timestamp)||0,id=Number(row?.id)||0;if(id>0&&ts>=period.from&&ts<=period.to)found.set(id,row);}
      const next=nextLogPageParams(data,params);if(!next||!rows.length)break;
      const sig=JSON.stringify(Object.keys(next).sort().map(k=>[k,next[k]]));if(seenPages.has(sig))break;seenPages.add(sig);params=next;
      await sleep(REQUEST_GAP_MS);
    }
    return {headers:[...found.values()],pages};
  }

  async function fetchPlayerTradeHistory(period,userId) {
    const listed=await fetchCompletedTradeHeaders(period),transactions=[];
    let details=0,tradesWithItems=0;
    for(let i=0;i<listed.headers.length&&!state.syncCancel;i++){
      const h=listed.headers[i],summaryItems=Number(h?.items);
      if(Number.isFinite(summaryItems)&&summaryItems===0)continue;
      setSyncProgress(`Player trades · ${i+1}/${listed.headers.length} · ${qty(transactions.length)} allocated item rows`);
      const data=await apiGet(`/user/${Number(h.id)}/trade`);details++;
      const rows=parsePlayerTrade(data?.trade,userId);if(rows.length){tradesWithItems++;transactions.push(...rows);}
      if(i<listed.headers.length-1&&!state.syncCancel)await sleep(REQUEST_GAP_MS);
    }
    return {transactions,diagnostics:{tradeHeaders:listed.headers.length,tradeListPages:listed.pages,tradeDetails:details,tradesWithItems,tradeTransactions:transactions.length}};
  }

'''
s=s.replace(marker,trade_fetch+marker,1)

# Add explanatory player-trade note in expanded item details.
old="""      const freeQty=s.events.filter(x=>x.side==='buy'&&x.free).reduce((n,x)=>n+x.qty,0);
      const recordedInventoryValue=marketPrice*Math.max(0,Number(s.remainingQty)||0);"""
new="""      const freeQty=s.events.filter(x=>x.side==='buy'&&x.free).reduce((n,x)=>n+x.qty,0);
      const playerTradeCount=new Set(s.events.filter(x=>x.source==='Player Trade').map(x=>x.tradeId)).size;
      const recordedInventoryValue=marketPrice*Math.max(0,Number(s.remainingQty)||0);"""
assert old in s
s=s.replace(old,new,1)
old="""Market value is Torn's catalog market price per item. Recorded inventory value is your analyzer-recorded remaining quantity × that market value; it is not a live inventory count. Profit uses FIFO:"""
new="""Market value is Torn's catalog market price per item. Recorded inventory value is your analyzer-recorded remaining quantity × that market value; it is not a live inventory count.${playerTradeCount?` · ${qty(playerTradeCount)} player trade(s) use each item type's market-value subtotal plus an equal share of that trade's cash surplus/deficit.`:''} Profit uses FIFO:"""
assert old in s
s=s.replace(old,new,1)

# Merge authoritative trade transactions into period sync and purge legacy trade-log guesses.
old="""      if(scan.diagnostics.rawRows===0){setSyncProgress('Filtered period scan returned no raw rows. Trying compatibility scan for the same dates…');scan=await fetchUnfilteredHistory(period);}
      scan.diagnostics.keyType=keyInfo.type;scan.diagnostics.keyLevel=keyInfo.level;scan.diagnostics.keySource=keySource();scan.diagnostics.customLogPermissions=keyInfo.customLogPermissions;scan.diagnostics.probeRows=probe.rows.length;
      const fresh=scan.transactions,outside=state.transactions.filter(t=>Number(t.timestamp)<period.from||Number(t.timestamp)>period.to),merged=new Map(outside.map(x=>[x.id,x]));fresh.forEach(x=>merged.set(x.id,x));"""
new="""      if(scan.diagnostics.rawRows===0){setSyncProgress('Filtered period scan returned no raw rows. Trying compatibility scan for the same dates…');scan=await fetchUnfilteredHistory(period);}
      setSyncProgress(`Scanning completed player trades for ${periodText}…`);
      const tradeScan=await fetchPlayerTradeHistory(period,keyInfo.userId);
      scan.transactions=[...scan.transactions,...tradeScan.transactions];
      scan.diagnostics.keyType=keyInfo.type;scan.diagnostics.keyLevel=keyInfo.level;scan.diagnostics.keySource=keySource();scan.diagnostics.customLogPermissions=keyInfo.customLogPermissions;scan.diagnostics.probeRows=probe.rows.length;Object.assign(scan.diagnostics,tradeScan.diagnostics);
      const fresh=scan.transactions,outside=state.transactions.filter(t=>!isLegacyTradeLogTransaction(t)&&(Number(t.timestamp)<period.from||Number(t.timestamp)>period.to)),merged=new Map(outside.map(x=>[x.id,x]));fresh.forEach(x=>merged.set(x.id,x));"""
assert old in s
s=s.replace(old,new,1)

old="""      else setSyncProgress(`Historical sync complete for ${periodText} · ${qty(fresh.length)} item rows · ${qty(scan.diagnostics.rawRows)} raw logs across ${qty(scan.diagnostics.pages)} pages.`);"""
new="""      else setSyncProgress(`Historical sync complete for ${periodText} · ${qty(fresh.length)} item rows · ${qty(scan.diagnostics.tradesWithItems||0)} player trades · ${qty(scan.diagnostics.rawRows)} raw logs across ${qty(scan.diagnostics.pages)} log pages.`);"""
assert old in s
s=s.replace(old,new,1)

# Settings diagnostics include authoritative trade API scan counts.
old="""${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.pages||0)} pages · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types."""
new="""${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.pages||0)} log pages · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types.<br>Player trades: ${qty(state.sync.diagnostics.tradesWithItems||0)} with items · ${qty(state.sync.diagnostics.tradeDetails||0)} detailed trades fetched · ${qty(state.sync.diagnostics.tradeTransactions||0)} allocated item rows."""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
