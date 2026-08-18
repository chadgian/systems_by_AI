from pathlib import Path
p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.17' in s
assert "const VERSION = '0.1.17';" in s
s=s.replace('// @version      0.1.17','// @version      0.1.18',1)
s=s.replace("const VERSION = '0.1.17';","const VERSION = '0.1.18';",1)
s=s.replace('Fast Torn trade analytics with an acquisition FIFO ledger, sortable/filterable history, safe incremental sync, verified-trade skipping, market-value allocation, and cached analytics. Data stays on-device.',
            'Fast Torn trade analytics with acquisition-date profit attribution, a FIFO ledger, sortable/filterable history, safe incremental sync, and cached analytics. Data stays on-device.',1)

old="""    catalogRef:null,catalogMap:new Map(),trackedTxRef:null,trackedCatalogRef:null,tracked:[],ledgerTxRef:null,ledgerRows:[],searchTimer:null,legacySearchTimer:null,ledgerSearchTimer:null
  };"""
new="""    catalogRef:null,catalogMap:new Map(),trackedTxRef:null,trackedCatalogRef:null,tracked:[],ledgerTxRef:null,ledgerRows:[],ledgerByItem:new Map(),searchTimer:null,legacySearchTimer:null,ledgerSearchTimer:null
  };"""
assert old in s
s=s.replace(old,new,1)

old="""    perfCache.trackedTxRef=null;perfCache.trackedCatalogRef=null;perfCache.tracked=[];
    perfCache.ledgerTxRef=null;perfCache.ledgerRows=[];
  }"""
new="""    perfCache.trackedTxRef=null;perfCache.trackedCatalogRef=null;perfCache.tracked=[];
    perfCache.ledgerTxRef=null;perfCache.ledgerRows=[];perfCache.ledgerByItem=new Map();
  }"""
assert old in s
s=s.replace(old,new,1)

old="""  function acquisitionLedgerRows() {
    const idx=ensureTxIndex();
    if(perfCache.ledgerTxRef===idx.txRef)return perfCache.ledgerRows;
    const ledger=[];
    for(const itemId of idx.itemIds){"""
new="""  function acquisitionLedgerRows() {
    const idx=ensureTxIndex();
    if(perfCache.ledgerTxRef===idx.txRef)return perfCache.ledgerRows;
    const ledger=[],ledgerByItem=new Map();
    for(const itemId of idx.itemIds){"""
assert old in s
s=s.replace(old,new,1)

old="""          ledger.push(row);lots.push({remaining:q,unit:row.unitCost,row});"""
new="""          ledger.push(row);if(!ledgerByItem.has(Number(itemId)))ledgerByItem.set(Number(itemId),[]);ledgerByItem.get(Number(itemId)).push(row);lots.push({remaining:q,unit:row.unitCost,row});"""
assert old in s
s=s.replace(old,new,1)

old="""    perfCache.ledgerTxRef=idx.txRef;perfCache.ledgerRows=ledger;return ledger;
  }

  function ledgerRangeBounds()"""
new="""    perfCache.ledgerTxRef=idx.txRef;perfCache.ledgerRows=ledger;perfCache.ledgerByItem=ledgerByItem;return ledger;
  }

  function ledgerRowsForItem(itemId) {
    acquisitionLedgerRows();return perfCache.ledgerByItem.get(Number(itemId))||[];
  }
  function acquisitionAttributedProfit(itemId,from,to) {
    let profit=0;for(const row of ledgerRowsForItem(itemId)){if(row.acquiredAt>=from&&row.acquiredAt<=to)profit+=Number(row.realizedProfit)||0;}return profit;
  }

  function ledgerRangeBounds()"""
assert old in s
s=s.replace(old,new,1)

old="""      else if(x.side==='sell'){sold+=x.qty;sellRevenue+=(x.netTotal??x.total);profit+=(x.realizedProfit||0);unmatched+=(x.unmatchedQty||0);}
    }
    const result={bought,sold,buySpend,sellRevenue,profit,sources:[...sources],unmatched,events,remainingQty:a.remainingQty,remainingCost:a.remainingCost};"""
new="""      else if(x.side==='sell'){sold+=x.qty;sellRevenue+=(x.netTotal??x.total);unmatched+=(x.unmatchedQty||0);}
    }
    profit=acquisitionAttributedProfit(id,from,to);
    const result={bought,sold,buySpend,sellRevenue,profit,sources:[...sources],unmatched,events,remainingQty:a.remainingQty,remainingCost:a.remainingCost};"""
assert old in s
s=s.replace(old,new,1)

old="""  function profitSeries(itemId=null) {
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
  }"""
new="""  function profitSeries(itemId=null) {
    const cacheKey=`${periodCacheKey()}|${state.granularity}|${itemId==null?'all':Number(itemId)}`;
    if(perfCache.series.has(cacheKey))return perfCache.series.get(cacheKey);
    const {from,to}=dateRange(),m=new Map(),rows=itemId==null?acquisitionLedgerRows():ledgerRowsForItem(Number(itemId));
    const keyFn=state.granularity==='week'?weekKey:state.granularity==='month'?monthKey:dayKey;
    for(const row of rows){
      if(row.acquiredAt<from||row.acquiredAt>to||row.soldQty<=0)continue;
      const k=keyFn(row.acquiredAt);m.set(k,(m.get(k)||0)+(Number(row.realizedProfit)||0));
    }
    const result=[...m.entries()].sort((a,b)=>a[0]-b[0]).map(([t,v])=>({t,v}));perfCache.series.set(cacheKey,result);return result;
  }"""
assert old in s
s=s.replace(old,new,1)

s=s.replace('<label>Realized profit</label>','<label>Profit · acquisition date</label>',1)
s=s.replace('<h3>Profit earned</h3>','<h3>Profit by acquisition date</h3>',1)
s=s.replace("Profit uses FIFO: each sale is matched against your oldest recorded acquisitions.","Profit uses FIFO: each sale is matched against your oldest recorded acquisitions, but the realized profit is attributed to the date that matched lot was acquired rather than the sale date.",1)
s=s.replace("Each row is one recorded acquisition lot. Later sales are matched back to it using the same FIFO method as the dashboard. Profit shown here is realized only on the quantity already sold.","Each row is one recorded acquisition lot. Later sales are matched back to it using the same FIFO method as the dashboard. Realized profit is attributed to this acquisition date, not the later sale date.",1)
s=s.replace("A partially sold lot shows only realized proceeds/profit for the FIFO-matched quantity.","A partially sold lot shows only realized proceeds/profit for the FIFO-matched quantity. Dashboard profit periods and charts use the acquisition date of each matched lot.",1)

# Guard against accidentally reverting to sale-date chart attribution.
assert 'const k=keyFn(row.acquiredAt)' in s
assert 'profit=acquisitionAttributedProfit(id,from,to);' in s
assert "const k=keyFn(x.timestamp)" not in s
assert '// @version      0.1.18' in s
p.write_text(s)
