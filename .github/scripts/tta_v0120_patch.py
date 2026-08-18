from pathlib import Path
p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.19' in s
assert "const VERSION = '0.1.19';" in s
s=s.replace('// @version      0.1.19','// @version      0.1.20',1)
s=s.replace("const VERSION = '0.1.19';","const VERSION = '0.1.20';",1)
s=s.replace('Fast Torn trade analytics with interactive exact-value profit charts, acquisition-date attribution, a FIFO ledger, incremental sync, and cached analytics. Data stays on-device.',
            'Fast Torn trade analytics with spacious scrollable daily profit charts, top-anchored exact-value tooltips, acquisition-date attribution, FIFO ledger, and incremental sync. Data stays on-device.',1)

old=""".tta-chartinteractive{position:relative;touch-action:manipulation}.tta-svg{width:100%;height:160px;display:block;overflow:visible}.tta-axis{fill:#d6e1eb!important;color:#d6e1eb!important;font-size:10px;font-weight:650;paint-order:stroke;stroke:#10171f;stroke-width:1.5px;stroke-linejoin:round}.tta-zero{stroke:#7c91a4;stroke-width:1.25}.tta-bar-pos{fill:var(--tta-green)}.tta-bar-neg{fill:var(--tta-red)}.tta-profitbar{cursor:pointer;outline:none;transition:opacity .12s ease,filter .12s ease}.tta-profitbar:hover,.tta-profitbar:focus,.tta-profitbar.active{opacity:.78;filter:brightness(1.18)}.tta-charttooltip{position:absolute;z-index:5;display:none;pointer-events:none;min-width:116px;max-width:190px;padding:8px 10px;border:1px solid #4a6073;border-radius:10px;background:#091119f2;color:var(--tta-text);box-shadow:0 8px 24px #0009;text-align:center;transform:translate(-50%,-100%);font-variant-numeric:tabular-nums}"""
new=""".tta-chartinteractive{position:relative;touch-action:manipulation;padding-top:54px}.tta-chartviewport{width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:#466078 #0b1219}.tta-chartviewport::-webkit-scrollbar{height:7px}.tta-chartviewport::-webkit-scrollbar-track{background:#0b1219;border-radius:999px}.tta-chartviewport::-webkit-scrollbar-thumb{background:#466078;border-radius:999px}.tta-svg{width:100%;height:160px;display:block;overflow:visible}.tta-chartinteractive.day .tta-svg{width:var(--tta-chart-width);max-width:none}.tta-axis{fill:#d6e1eb!important;color:#d6e1eb!important;font-size:10px;font-weight:650;paint-order:stroke;stroke:#10171f;stroke-width:1.5px;stroke-linejoin:round}.tta-zero{stroke:#7c91a4;stroke-width:1.25}.tta-bar-pos{fill:var(--tta-green)}.tta-bar-neg{fill:var(--tta-red)}.tta-profitbar{cursor:pointer;outline:none;transition:opacity .12s ease,filter .12s ease}.tta-profitbar:hover,.tta-profitbar:focus,.tta-profitbar.active{opacity:.78;filter:brightness(1.18)}.tta-charttooltip{position:absolute;top:4px;z-index:5;display:none;pointer-events:none;min-width:116px;max-width:190px;padding:8px 10px;border:1px solid #4a6073;border-radius:10px;background:#091119f2;color:var(--tta-text);box-shadow:0 8px 24px #0009;text-align:center;transform:translateX(-50%);font-variant-numeric:tabular-nums}"""
assert old in s
s=s.replace(old,new,1)

old="""    const wr=wrap.getBoundingClientRect(),br=bar.getBoundingClientRect();
    requestAnimationFrame(()=>{const tw=tip.offsetWidth||120,th=tip.offsetHeight||48;let left=br.left-wr.left+br.width/2;left=Math.max(tw/2+4,Math.min(wr.width-tw/2-4,left));let top=br.top-wr.top-6;if(top<th+4)top=br.bottom-wr.top+th+6;tip.style.left=`${left}px`;tip.style.top=`${top}px`;});
  }

  function chartSvg(series, h=160) {
    if (!series.length) return '<div class=\"tta-empty\">No realized sales profit in this period yet.</div>';
    const w=360, padL=52,padR=8,padT=10,padB=25, innerW=w-padL-padR,innerH=h-padT-padB;
    let min=Math.min(0,...series.map(x=>x.v)),max=Math.max(0,...series.map(x=>x.v)); if(max===min){max+=1;min-=1}
    const y=v=>padT+(max-v)/(max-min)*innerH; const zero=y(0); const gap=innerW/series.length; const bw=Math.max(5,Math.min(22,gap*.62));
    const grid=[0,.25,.5,.75,1].map(p=>{const yy=padT+p*innerH;const val=max-p*(max-min);return `<line class=\"tta-grid\" x1=\"${padL}\" y1=\"${yy}\" x2=\"${w-padR}\" y2=\"${yy}\"/><text class=\"tta-axis\" x=\"3\" y=\"${yy+3}\">${esc(money(val,true))}</text>`}).join('');
    const bars=series.map((p,i)=>{const cx=padL+gap*i+gap/2;const yy=y(p.v);const top=Math.min(yy,zero);const bh=Math.max(2,Math.abs(zero-yy));const label=`${chartBucketLabel(p.t)}: ${money(p.v)}`;return `<rect class=\"tta-profitbar ${p.v>=0?'tta-bar-pos':'tta-bar-neg'}\" data-profit=\"${Number(p.v)||0}\" data-time=\"${Number(p.t)||0}\" tabindex=\"0\" role=\"button\" aria-label=\"${esc(label)}\" x=\"${cx-bw/2}\" y=\"${top}\" width=\"${bw}\" height=\"${bh}\" rx=\"2\"><title>${esc(label)}</title></rect>`}).join('');
    const labels=series.map((p,i)=>{if(series.length>10 && i%Math.ceil(series.length/6)!==0 && i!==series.length-1)return''; const d=new Date(p.t*1000);const lab=state.granularity==='month'?d.toLocaleDateString(undefined,{month:'short'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'});const x=padL+gap*i+gap/2;return `<text class=\"tta-axis\" text-anchor=\"middle\" x=\"${x}\" y=\"${h-6}\">${esc(lab)}</text>`}).join('');
    return `<div class=\"tta-chartinteractive\"><svg class=\"tta-svg\" viewBox=\"0 0 ${w} ${h}\" preserveAspectRatio=\"xMidYMid meet\" role=\"img\" aria-label=\"Interactive profit chart; hover or tap a bar for exact profit\">${grid}<line class=\"tta-zero\" x1=\"${padL}\" y1=\"${zero}\" x2=\"${w-padR}\" y2=\"${zero}\"/>${bars}${labels}</svg><div class=\"tta-charttooltip\" role=\"status\" aria-live=\"polite\" data-pinned=\"0\"></div></div>`;
  }"""
new="""    const wr=wrap.getBoundingClientRect(),br=bar.getBoundingClientRect();
    requestAnimationFrame(()=>{const tw=tip.offsetWidth||120;let left=br.left-wr.left+br.width/2;left=Math.max(tw/2+4,Math.min(wr.width-tw/2-4,left));tip.style.left=`${left}px`;tip.style.top='4px';});
  }

  function chartSvg(series, h=160) {
    if (!series.length) return '<div class=\"tta-empty\">No realized sales profit in this period yet.</div>';
    const dayMode=state.granularity==='day',padL=52,padR=8,padT=10,padB=25;
    const w=dayMode?Math.max(360,padL+padR+series.length*30):360,innerW=w-padL-padR,innerH=h-padT-padB;
    let min=Math.min(0,...series.map(x=>x.v)),max=Math.max(0,...series.map(x=>x.v)); if(max===min){max+=1;min-=1}
    const y=v=>padT+(max-v)/(max-min)*innerH; const zero=y(0); const gap=innerW/series.length; const bw=Math.max(dayMode?12:5,Math.min(dayMode?20:22,gap*.62));
    const grid=[0,.25,.5,.75,1].map(p=>{const yy=padT+p*innerH;const val=max-p*(max-min);return `<line class=\"tta-grid\" x1=\"${padL}\" y1=\"${yy}\" x2=\"${w-padR}\" y2=\"${yy}\"/><text class=\"tta-axis\" x=\"3\" y=\"${yy+3}\">${esc(money(val,true))}</text>`}).join('');
    const bars=series.map((p,i)=>{const cx=padL+gap*i+gap/2;const yy=y(p.v);const top=Math.min(yy,zero);const bh=Math.max(2,Math.abs(zero-yy));const label=`${chartBucketLabel(p.t)}: ${money(p.v)}`;return `<rect class=\"tta-profitbar ${p.v>=0?'tta-bar-pos':'tta-bar-neg'}\" data-profit=\"${Number(p.v)||0}\" data-time=\"${Number(p.t)||0}\" tabindex=\"0\" role=\"button\" aria-label=\"${esc(label)}\" x=\"${cx-bw/2}\" y=\"${top}\" width=\"${bw}\" height=\"${bh}\" rx=\"2\"><title>${esc(label)}</title></rect>`}).join('');
    const labelStride=dayMode?Math.max(1,Math.ceil(series.length/12)):Math.max(1,Math.ceil(series.length/6));
    const labels=series.map((p,i)=>{if(series.length>10 && i%labelStride!==0 && i!==series.length-1)return''; const d=new Date(p.t*1000);const lab=state.granularity==='month'?d.toLocaleDateString(undefined,{month:'short'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'});const x=padL+gap*i+gap/2;return `<text class=\"tta-axis\" text-anchor=\"middle\" x=\"${x}\" y=\"${h-6}\">${esc(lab)}</text>`}).join('');
    return `<div class=\"tta-chartinteractive ${dayMode?'day':''}\" ${dayMode?`style=\"--tta-chart-width:${w}px\"`:''}><div class=\"tta-charttooltip\" role=\"status\" aria-live=\"polite\" data-pinned=\"0\"></div><div class=\"tta-chartviewport\"><svg class=\"tta-svg\" viewBox=\"0 0 ${w} ${h}\" preserveAspectRatio=\"xMidYMid meet\" role=\"img\" aria-label=\"Interactive profit chart; hover or tap a bar for exact profit\">${grid}<line class=\"tta-zero\" x1=\"${padL}\" y1=\"${zero}\" x2=\"${w-padR}\" y2=\"${zero}\"/>${bars}${labels}</svg></div></div>`;
  }

  function positionDailyChartsToLatest(scope=document) {
    requestAnimationFrame(()=>scope.querySelectorAll?.('.tta-chartinteractive.day .tta-chartviewport').forEach(v=>{if(v.dataset.positioned==='1')return;v.scrollLeft=Math.max(0,v.scrollWidth-v.clientWidth);v.dataset.positioned='1';}));
  }"""
assert old in s
s=s.replace(old,new,1)

old="""    if(shell)shell.scrollTop=scroll;
  }

  function dashboardHtml()"""
new="""    if(shell)shell.scrollTop=scroll;positionDailyChartsToLatest(list);
  }

  function dashboardHtml()"""
assert old in s
s=s.replace(old,new,1)

old="""    root.dataset.view=state.view;root.setAttribute('aria-busy',state.busy?.active?'true':'false');bind();
    if(preserveScroll){const shell=root.querySelector('.tta-shell');if(shell)shell.scrollTop=previousScroll;}
  }"""
new="""    root.dataset.view=state.view;root.setAttribute('aria-busy',state.busy?.active?'true':'false');bind();
    if(preserveScroll){const shell=root.querySelector('.tta-shell');if(shell)shell.scrollTop=previousScroll;}positionDailyChartsToLatest(root);
  }"""
assert old in s
s=s.replace(old,new,1)

# Release guards.
assert '// @version      0.1.20' in s
assert "const dayMode=state.granularity==='day'" in s
assert "series.length*30" in s
assert 'tta-chartviewport' in s
assert "tip.style.top='4px'" in s
assert 'br.bottom-wr.top' not in s
assert 'positionDailyChartsToLatest' in s
p.write_text(s)
