import fs from 'node:fs';
import path from 'node:path';

const OUTPUT = process.env.REWARDS_OUTPUT || path.resolve('companies/rewards-data.json');
const VERSION = '0.1-vlcvx-route-graph-normalizer';

const DIRECT_LABEL = 'Votium · vlCVX';
const UNION_LABEL = 'Votium + Union · vlCVX';

function normalizeDefitea(company) {
  if (!company) return { changed: false, directCount: 0, unionCount: 0 };

  const rewards = Array.isArray(company.rewards) ? company.rewards : [];
  let directCount = 0;
  let unionCount = 0;

  for (const reward of rewards) {
    if (reward?.route === 'votium-union-scrvusd') {
      reward.protocol = UNION_LABEL;
      reward.details = reward.details || {};
      reward.details.vlCvxRoute = {
        principalAsset: 'vlCVX',
        delegationProtocol: 'Votium',
        settlementProtocol: 'The Union',
        payoutAsset: reward.symbol || 'scrvUSD',
        routeRole: 'current',
        path: `vlCVX → Votium → The Union → ${reward.symbol || 'scrvUSD'}`
      };
      unionCount++;
    } else if (reward?.protocol === DIRECT_LABEL && reward?.route === 'votium-union') {
      reward.details = reward.details || {};
      reward.details.vlCvxRoute = {
        principalAsset: 'vlCVX',
        delegationProtocol: 'Votium',
        settlementProtocol: 'Votium direct Merkle',
        payoutAsset: reward.symbol || null,
        routeRole: 'legacy-residual',
        path: `vlCVX → Votium → ${reward.symbol || 'direct reward'}`
      };
      directCount++;
    }
  }

  // Keep all direct Votium reward atoms in their original relative order, then
  // place the Union settlement atom immediately after them. All unrelated reward
  // routes preserve their original relative order.
  const direct = rewards.filter(r => r?.protocol === DIRECT_LABEL && r?.route === 'votium-union');
  const union = rewards.filter(r => r?.route === 'votium-union-scrvusd');
  if (union.length) {
    const rest = rewards.filter(r => !direct.includes(r) && !union.includes(r));
    const firstDirectIndex = rewards.findIndex(r => direct.includes(r));
    if (firstDirectIndex >= 0) {
      let restBefore = 0;
      for (let i = 0; i < firstDirectIndex; i++) if (rest.includes(rewards[i])) restBefore++;
      company.rewards = [
        ...rest.slice(0, restBefore),
        ...direct,
        ...union,
        ...rest.slice(restBefore)
      ];
    }
  }

  const source = (company.sources || []).find(s => s?.route === 'votium-union');
  if (source) {
    source.details = source.details || {};
    source.details.vlCvxRouteGraph = {
      version: VERSION,
      principalAsset: 'vlCVX',
      currentRoute: 'Votium + Union',
      currentSettlementAsset: union[0]?.symbol || source.details?.union?.airdrop?.entitlement ? 'scrvUSD' : null,
      legacyResidualRoute: direct.length ? 'Votium direct' : null,
      preserveLegacyResidualUntilClaimed: true,
      publicLabels: {
        direct: DIRECT_LABEL,
        union: UNION_LABEL
      }
    };
  }

  return { changed: directCount > 0 || unionCount > 0, directCount, unionCount };
}

function main() {
  const data = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  const defitea = data.companies?.['defitea.eth'];
  const result = normalizeDefitea(defitea);

  data.diagnostics = data.diagnostics || {};
  data.diagnostics.vlCvxRouteGraph = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    executionAuthority: 'none',
    currentPrinciple: 'current route and legacy residual claimables may coexist',
    publicOrdering: ['Votium · vlCVX', 'Votium + Union · vlCVX', 'Stake DAO · vlCVX'],
    defitea: result
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + '\n');
  console.log('vlCVX route graph normalization PASS', data.diagnostics.vlCvxRouteGraph);
}

main();
