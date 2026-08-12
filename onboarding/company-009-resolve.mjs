import fs from 'node:fs';
import path from 'node:path';

const VERSION = '1.5-company-009-owner-foundation-weth-accounting-closure';
const OUTPUT = process.env.COMPANY_009_RESOLVE_OUTPUT || path.resolve('companies/company-009-resolve.json');
const PREVIOUS_FILE = path.resolve('companies/company-009-resolve.json');
const OWNER_OBSERVED_WETH = 0.1606;
const EXPECTED_BTC = 0.07264572;
const VERIFIED_NATIVE_ETH = 0.006426130614;
const FINAL_ETH = 0.167026130614;

function main(){
  const now=new Date().toISOString();
  if(!fs.existsSync(PREVIOUS_FILE)) throw new Error('Company #009 previous resolver JSON missing');
  const current=JSON.parse(fs.readFileSync(PREVIOUS_FILE,'utf8'));
  let evidence=null;
  if(current.version==='1.4-company-009-aerodrome-ve-rewards-weth-final-pass') evidence=current;
  else if(current.version===VERSION && current.preservedResolved?.previousV14Evidence) evidence=current.preservedResolved.previousV14Evidence;
  else throw new Error('Expected migrated Company #009 v1.4 evidence before accounting closure; found '+current.version);
  if(Number(evidence.finalCandidateTotals?.btc)!==EXPECTED_BTC) throw new Error('Preserved BTC mismatch');
  const priorNative=Number(evidence.preservedResolved?.ethNativeSubtotal);
  if(!Number.isFinite(priorNative) || Math.abs(priorNative-VERIFIED_NATIVE_ETH)>1e-12) throw new Error('Verified native ETH subtotal mismatch: '+priorNative);
  const out={
    version:VERSION, generatedAt:now, startedAt:now,
    company:{registry:'009',name:'1milliondollar.eth',wallet:'0xe4b9c9ced406baffe406e63f83d39daaef150596',foundedAt:'2024-12-12'},
    purpose:'final owner-authorized accounting closure after bounded onchain Base WETH investigation; no further archaeology',
    preservedResolved:{previousResolverVersion:evidence.version,previousV14Evidence:evidence},
    accountingClosure:{
      decision:'owner-authorized-foundation-fallback',
      verifiedNativeEthSubtotal:VERIFIED_NATIVE_ETH,
      ownerObservedBaseWeth:OWNER_OBSERVED_WETH,
      ownerObservedSource:'owner-observed / DeBank-visible Aerodrome context',
      onchainReproduced:false,
      treatment:'include as foundation ETH economic exposure; do not classify as accrued rewards; preserve provenance limitation',
      finalEthEconomicExposure:FINAL_ETH
    },
    classification:{
      accountingMode:'owner-observed-foundation-fallback',
      directWethRewards:0,managedRelayWethDiagnostic:0,
      ownerDeclaredFoundationFallbackWeth:OWNER_OBSERVED_WETH,
      completeOfficialRewardScan:false,
      note:'bounded v1.4 reward scan was incomplete; owner explicitly authorized stopping archaeology and carrying the observed WETH as foundation exposure'
    },
    resolution:{
      lombardEthereumWbtc:true,lombardBaseWbtc:true,avalancheBtcB:true,
      baseWethAccountingResolved:true,unresolved:[],allResolved:true
    },
    finalCandidateTotals:{btc:EXPECTED_BTC,eth:FINAL_ETH,authoritativeBalanceDiscovery:true,companyBookQuantityReady:true},
    metricBoundary:{
      companyBalance:'ETH total includes verified native ETH plus owner-observed 0.1606 WETH foundation exposure; the latter is explicitly not onchain-reproduced by The Holding resolver',
      accruedRewards:'do not add the 0.1606 WETH again as Accrued Rewards without new position-specific proof',
      performance:'pending owner average entry prices; no entry price is invented'
    },
    nextStep:'Company #009 quantity discovery closed; integrate page, Productivity and Rewards; wait for owner entry prices before Performance'
  };
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
  console.log('Company #009 final accounting closure written:',OUTPUT);
  console.log('BTC:',EXPECTED_BTC,'ETH:',FINAL_ETH,'owner-observed WETH:',OWNER_OBSERVED_WETH);
}
main();
