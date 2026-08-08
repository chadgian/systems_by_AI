const fs=require('fs');
const src=fs.readFileSync('torn-trade-analyzer.user.js','utf8');
function grab(name,next){
  const start=src.indexOf(`function ${name}`);
  if(start<0)throw new Error(`missing ${name}`);
  const end=src.indexOf(`\n  function ${next}`,start);
  if(end<0)throw new Error(`missing boundary ${next}`);
  return src.slice(start,end);
}
const prices=new Map([[10,100],[20,300],[30,50]]);
function catalogItem(id){return {id,marketPrice:prices.get(Number(id))||0};}
eval(grab('tradeItemGroups','tradeMoneyFor'));
eval(grab('tradeMoneyFor','allocateTradeGroupTotals'));
eval(grab('allocateTradeGroupTotals','parsePlayerTrade'));
eval(grab('parsePlayerTrade','isLegacyTradeLogTransaction'));
function near(a,b,msg){if(Math.abs(a-b)>1e-6)throw new Error(`${msg}: ${a} != ${b}`);}
function byItem(rows,id){const r=rows.find(x=>Number(x.itemId)===Number(id));if(!r)throw new Error(`missing item ${id}`);return r;}

// Two item TYPES with market subtotals $200 and $300 sold for $600.
// $100 cash surplus is split equally: +$50 to each type => $250 / $350.
let trade={id:1,completed_at:1700000000,user:{id:1,name:'Me'},trader:{id:2,name:'Buyer'},items:[
  {user_id:1,type:'Item',details:{id:10,amount:2}},
  {user_id:1,type:'Item',details:{id:20,amount:1}},
  {user_id:2,type:'Money',details:{amount:600}}
]};
let rows=parsePlayerTrade(trade,1).filter(x=>x.side==='sell');
near(rows.reduce((n,x)=>n+x.total,0),600,'sale cash conservation');
near(byItem(rows,10).total,250,'sale item 10 equal surplus share');
near(byItem(rows,20).total,350,'sale item 20 equal surplus share');
near(byItem(rows,10).tradeAdjustment,50,'sale item 10 adjustment');
near(byItem(rows,20).tradeAdjustment,50,'sale item 20 adjustment');

// Same bundle bought for $600 uses the same equal-by-type cash surplus allocation.
trade={id:2,completed_at:1700000100,user:{id:1,name:'Me'},trader:{id:2,name:'Seller'},items:[
  {user_id:2,type:'Item',details:{id:10,amount:2}},
  {user_id:2,type:'Item',details:{id:20,amount:1}},
  {user_id:1,type:'Money',details:{amount:600}}
]};
rows=parsePlayerTrade(trade,1).filter(x=>x.side==='buy');
near(rows.reduce((n,x)=>n+x.total,0),600,'buy cash conservation');
near(byItem(rows,10).total,250,'buy item 10 equal surplus share');
near(byItem(rows,20).total,350,'buy item 20 equal surplus share');

// Deep under-market sale: allocations never go negative and still sum to actual cash.
trade={id:3,completed_at:1700000200,user:{id:1,name:'Me'},trader:{id:2,name:'Buyer'},items:[
  {user_id:1,type:'Item',details:{id:10,amount:2}},
  {user_id:1,type:'Item',details:{id:20,amount:1}},
  {user_id:2,type:'Money',details:{amount:100}}
]};
rows=parsePlayerTrade(trade,1).filter(x=>x.side==='sell');
near(rows.reduce((n,x)=>n+x.total,0),100,'under-market cash conservation');
if(rows.some(x=>x.total<0))throw new Error('negative allocation');

// Item-for-item swap with no cash: buy and sell totals balance to zero net cash.
trade={id:4,completed_at:1700000300,user:{id:1,name:'Me'},trader:{id:2,name:'Trader'},items:[
  {user_id:1,type:'Item',details:{id:10,amount:1}},
  {user_id:2,type:'Item',details:{id:20,amount:1}}
]};
rows=parsePlayerTrade(trade,1);
near(rows.filter(x=>x.side==='sell').reduce((n,x)=>n+x.total,0),300,'swap sale consideration');
near(rows.filter(x=>x.side==='buy').reduce((n,x)=>n+x.total,0),300,'swap acquisition cost');
console.log('PASS player trade allocation fixtures');
