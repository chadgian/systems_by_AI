from pathlib import Path
p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.13' in s
assert "const VERSION = '0.1.13';" in s
s=s.replace('// @version      0.1.13','// @version      0.1.14',1)
s=s.replace("const VERSION = '0.1.13';","const VERSION = '0.1.14';",1)
s=s.replace('Fast Torn trade analytics with reload-resumable background sync, authoritative player trades, market-value allocation, cached FIFO, item details, and progressive loading. Data stays on-device.',
            'Fast Torn trade analytics with corrected sold-item detection, exhaustive completed-trade details, reload-resumable sync, market-value allocation, cached FIFO, and item details. Data stays on-device.',1)

old="""    [4200, {side:'buy', source:'Torn Shop'}],
    [4201, {side:'buy', source:'Foreign Market'}],"""
new="""    [4200, {side:'buy', source:'Torn Shop'}],
    [4201, {side:'buy', source:'Foreign Market'}],
    [4210, {side:'sell', source:'Torn Shop'}],"""
assert old in s
s=s.replace(old,new,1)

old="""      const i=Number(job.tradeDetailIndex)||0,h=headers[i],summaryItems=Number(h?.items);
      if(Number.isFinite(summaryItems)&&summaryItems===0){job.tradeDetailIndex=i+1;checkpointSyncJob(job,`Player trades · ${i+1}/${headers.length} · no item rows`);continue;}
      checkpointSyncJob(job,`Player trades · ${i+1}/${headers.length} · fetching trade #${Number(h.id)}`);"""
new="""      const i=Number(job.tradeDetailIndex)||0,h=headers[i];
      checkpointSyncJob(job,`Player trades · ${i+1}/${headers.length} · checking detailed trade #${Number(h.id)}`);"""
assert old in s
s=s.replace(old,new,1)

old="""      const h=listed.headers[i],summaryItems=Number(h?.items);
      if(Number.isFinite(summaryItems)&&summaryItems===0)continue;
      setSyncProgress(`Player trades · ${i+1}/${listed.headers.length} · ${qty(transactions.length)} allocated item rows`);"""
new="""      const h=listed.headers[i];
      setSyncProgress(`Player trades · ${i+1}/${listed.headers.length} · checking detailed trade · ${qty(transactions.length)} allocated item rows`);"""
assert old in s
s=s.replace(old,new,1)

old="""      const rows=parsePlayerTrade(data?.trade,job.userId);if(rows.length){job.diagnostics.tradesWithItems=(Number(job.diagnostics.tradesWithItems)||0)+1;job.diagnostics.tradeTransactions=(Number(job.diagnostics.tradeTransactions)||0)+rows.length;checkpointTransactionRows(job,rows);}"""
new="""      const rows=parsePlayerTrade(data?.trade,job.userId);
      const soldRows=rows.filter(x=>x.side==='sell'),boughtRows=rows.filter(x=>x.side==='buy');
      if(rows.length){
        job.diagnostics.tradesWithItems=(Number(job.diagnostics.tradesWithItems)||0)+1;
        job.diagnostics.tradeTransactions=(Number(job.diagnostics.tradeTransactions)||0)+rows.length;
        job.diagnostics.tradeSoldQty=(Number(job.diagnostics.tradeSoldQty)||0)+soldRows.reduce((n,x)=>n+(Number(x.qty)||0),0);
        job.diagnostics.tradeBoughtQty=(Number(job.diagnostics.tradeBoughtQty)||0)+boughtRows.reduce((n,x)=>n+(Number(x.qty)||0),0);
        checkpointTransactionRows(job,rows);
      }"""
assert old in s
s=s.replace(old,new,1)

old="""    return {rawRows:0,parsedRows:0,matchedRows:0,batches,logTypes,pages:0,oldestTimestamp:0,mode,periodFrom:job.period.from,periodTo:job.period.to,tradeHeaders:0,tradeListPages:0,tradeDetails:0,tradesWithItems:0,tradeTransactions:0};"""
new="""    return {rawRows:0,parsedRows:0,matchedRows:0,batches,logTypes,pages:0,oldestTimestamp:0,mode,periodFrom:job.period.from,periodTo:job.period.to,tradeHeaders:0,tradeListPages:0,tradeDetails:0,tradesWithItems:0,tradeTransactions:0,tradeSoldQty:0,tradeBoughtQty:0};"""
assert old in s
s=s.replace(old,new,1)

old="""Player trades: ${qty(state.sync.diagnostics.tradesWithItems||0)} with items · ${qty(state.sync.diagnostics.tradeDetails||0)} detailed trades fetched · ${qty(state.sync.diagnostics.tradeTransactions||0)} allocated item rows."""
new="""Player trades: ${qty(state.sync.diagnostics.tradesWithItems||0)} with items · ${qty(state.sync.diagnostics.tradeDetails||0)} detailed trades fetched · ${qty(state.sync.diagnostics.tradeTransactions||0)} allocated item rows · ${qty(state.sync.diagnostics.tradeSoldQty||0)} items sold via trades."""
assert old in s
s=s.replace(old,new,1)

old="""Profit uses FIFO: each sale is matched against your oldest recorded acquisitions."""
new="""Sold quantity counts every recognized sale event, including outgoing items from authoritative completed player-trade details. Profit uses FIFO: each sale is matched against your oldest recorded acquisitions."""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
