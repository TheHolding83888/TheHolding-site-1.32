#!/usr/bin/env node

export const fail = message => { throw new Error(message); };

export function finiteNumber(value) {
  const n=Number(value);
  return Number.isFinite(n) ? n : null;
}

export function validateCompleteBasis(rows,{company,expectedCount,expectedTotalUsd,tolerance=0.005}={}) {
  if(!Array.isArray(rows)||rows.length!==expectedCount)fail(`${company}: expected ${expectedCount} current capital positions, got ${Array.isArray(rows)?rows.length:'invalid'}`);
  let total=0;
  for(const row of rows){
    const id=String(row?.assetId||'');
    const qty=finiteNumber(row?.quantity);
    const basis=finiteNumber(row?.costBasisUsd);
    if(!id||!(qty>0))fail(`${company}: invalid current quantity for ${id||'UNKNOWN'}`);
    if(basis===null||basis<0)fail(`${company}: current position ${id} has UNKNOWN cost basis; portfolio must be partial rather than silently treating it as zero`);
    total+=basis;
  }
  if(Math.abs(total-Number(expectedTotalUsd))>tolerance)fail(`${company}: complete cost-basis total drift expected=${expectedTotalUsd} actual=${total}`);
  return total;
}

export function replaceCompanyBookBlock(html,companyName,renderedBlock){
  const marker=`    '${companyName}': [`;
  const start=html.indexOf(marker);
  if(start<0)fail(`${companyName}: Company Book block start missing`);
  let quote=null,escaped=false,depth=0,end=-1;
  for(let i=start+marker.length-1;i<html.length;i+=1){
    const ch=html[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='[')depth+=1;
    else if(ch===']'){
      depth-=1;
      if(depth===0){
        let j=i+1;
        while(j<html.length&&/\s/.test(html[j]))j+=1;
        if(html[j]!==',')fail(`${companyName}: Company Book block terminator missing`);
        end=j+1;
        break;
      }
    }
  }
  if(end<0)fail(`${companyName}: Company Book block boundary missing`);
  return html.slice(0,start)+renderedBlock+html.slice(end);
}

export function jsValue(value){
  if(value===null||value===undefined)return 'null';
  if(typeof value==='number'){
    if(!Number.isFinite(value))fail('cannot serialize non-finite Company Book number');
    return String(value);
  }
  if(typeof value==='boolean')return value?'true':'false';
  return JSON.stringify(String(value));
}

export function renderCompanyBookBlock(companyName,rows){
  const lines=[`    '${companyName}': [`];
  rows.forEach((row,index)=>{
    const parts=[`id: ${jsValue(row.assetId)}`,`qty: ${jsValue(Number(row.quantity))}`,`entry: ${jsValue(row.entryPriceUsd??null)}`,`costBasisUsd: ${jsValue(Number(row.costBasisUsd))}`,`costBasisStatus: 'complete'`,`evidenceStatus: ${jsValue(row.evidenceStatus||'owner-provided-current')}`];
    if(row.productivityOnly===true){parts.push('productivityOnly: true');if(row.engineId)parts.push(`engineId: ${jsValue(row.engineId)}`);}
    if(row.relay)parts.push(`relay: ${JSON.stringify(row.relay)}`);
    lines.push(`        { ${parts.join(', ')} }${index===rows.length-1?'':','}`);
  });
  lines.push('    ],');
  return lines.join('\n');
}

export function completePerformanceEvidence(snapshot,basisTotalUsd,{label='snapshot'}={}){
  const market=finiteNumber(snapshot?.marketValueUsd);
  const invested=finiteNumber(snapshot?.investedUsd);
  const pnl=finiteNumber(snapshot?.unrealizedProfitUsd);
  const pct=finiteNumber(snapshot?.performancePct);
  if(market===null||invested===null||pnl===null||pct===null)fail(`${label}: incomplete evidence snapshot`);
  if(Math.abs(invested-Number(basisTotalUsd))>0.005)fail(`${label}: invested amount does not reconcile to canonical cost basis`);
  if(Math.abs((market-invested)-pnl)>0.01)fail(`${label}: PnL arithmetic drift`);
  const calculated=(market/invested-1)*100;
  if(Math.abs(calculated-pct)>0.0001)fail(`${label}: performance arithmetic drift expected=${calculated} stored=${pct}`);
  return {market,invested,pnl,pct};
}
