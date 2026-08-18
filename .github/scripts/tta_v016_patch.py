from pathlib import Path
p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.15' in s
assert "const VERSION = '0.1.15';" in s
s=s.replace('// @version      0.1.15','// @version      0.1.16',1)
s=s.replace("const VERSION = '0.1.15';","const VERSION = '0.1.16';",1)
s=s.replace('Fast Torn trade analytics with incremental missing-data sync, verified-trade skipping, reload resume, market-value allocation, cached FIFO, and item details. Data stays on-device.',
            'Fast Torn trade analytics with safe incremental missing-data sync, verified-trade skipping, reload resume, market-value allocation, cached FIFO, and item details. Data stays on-device.',1)
s=s.replace('// v0.1.13 resumable sync engine. These later declarations intentionally override\n  // the original syncAll() path above while retaining it as a fallback reference.',
            '// Resumable + incremental sync engine. These later declarations intentionally override\n  // the original syncAll() path above while retaining it as a fallback reference.',1)

old="""    const coveredFrom=Number(c[fromKey]),coveredTo=Number(c[toKey])||0;
    if(Number.isFinite(coveredFrom)&&coveredFrom<=period.from&&coveredTo>0){"""
new="""    const rawFrom=c[fromKey],coveredFrom=rawFrom==null?NaN:Number(rawFrom),coveredTo=Number(c[toKey])||0;
    if(Number.isFinite(coveredFrom)&&coveredFrom<=period.from&&coveredTo>0){"""
assert old in s
s=s.replace(old,new,1)

old="""      if(!p)return;const fk=kind==='trade'?'tradeCoverageFrom':'logCoverageFrom',tk=kind==='trade'?'tradeCoverageTo':'logCoverageTo';
      const oldFrom=Number(c[fk]);if(!p.incremental)c[fk]=Number.isFinite(oldFrom)?Math.min(oldFrom,p.from):p.from;
      c[tk]=Math.max(Number(c[tk])||0,p.to);"""
new="""      if(!p)return;const fk=kind==='trade'?'tradeCoverageFrom':'logCoverageFrom',tk=kind==='trade'?'tradeCoverageTo':'logCoverageTo';
      const rawOldFrom=c[fk],oldFrom=rawOldFrom==null?NaN:Number(rawOldFrom);if(!p.incremental)c[fk]=Number.isFinite(oldFrom)?Math.min(oldFrom,p.from):p.from;
      c[tk]=Math.max(Number(c[tk])||0,Math.min(p.to,nowSec()));"""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
