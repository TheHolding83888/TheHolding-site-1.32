#!/usr/bin/env node
/**
 * The Holding · VoteMarket Reference Lane v0.1
 *
 * Builds a non-accounting reference view for Defitea veCRV / veFXN VoteMarket
 * economics from the latest already-resolved weekly entitlement epoch.
 *
 * This is deliberately NOT a forecast of an unresolved epoch and never creates
 * earned income. Canonical Income Ledger / Defitea income ledger remain the
 * only factual accounting authorities. The reference APR is a backward-looking
 * annualisation of the latest resolved weekly VoteMarket entitlement against
 * the current principal value, shown separately from the base protocol APR.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const REPORTING_DATA_FILE = process.env.REPORTING_DATA_FILE || path.join(ROOT, 'reporting', 'reporting-data.json');
const DEFITEA_INCOME_LEDGER_FILE = process.env.DEFITEA_INCOME_LEDGER_FILE || path.join(ROOT, 'reporting', 'defitea-income-ledger.json');
const OUTPUT_FILE = process.env.VOTEMARKET_REFERENCE_FILE || path.join(ROOT, 'reporting', 'votemarket-reference.json');

const DEFITEA = 'defitea.eth';
const WEEKS_PER_YEAR = 52;
const ROUTES = Object.freeze({
  'votemarket-vecrv': {
    principalEngineId: 'curve_vecrv',
    principal: 'veCRV',
    protocol: 'VoteMarket · veCRV'
  },
  'votemarket-vefxn': {
    principalEngineId: 'fx_vefxn',
    principal: 'veFXN',
    protocol: 'VoteMarket · veFXN'
  }
});

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

function finite(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function unique(values) {
  return [...new Set(values.filter(value => value !== null && value !== undefined && value !== ''))];
}

function dayKey(value) {
  const raw = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function dayDiff(later, earlier) {
  const a = Date.parse(`${later}T00:00:00.000Z`);
  const b = Date.parse(`${earlier}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((a - b) / 86400000);
}

function exactEventIdentity(event) {
  return [
    event?.route,
    event?.epoch,
    event?.chainId,
    event?.platform,
    event?.campaignId,
    event?.gauge,
    event?.wallet,
    event?.rewardToken
  ].map(value => String(value ?? '').toLowerCase()).join(':');
}

function dedupeEvents(events) {
  const map = new Map();
  for (const event of events) {
    const key = event?.eventKey || exactEventIdentity(event);
    if (!key || map.has(key)) continue;
    map.set(key, event);
  }
  return [...map.values()];
}

function latestResolvedEpoch(events) {
  const epochs = events.map(event => finite(event?.epoch)).filter(Number.isFinite);
  return epochs.length ? Math.max(...epochs) : null;
}

function positionFor(fund, engineId) {
  return (fund?.latestSnapshot?.positions || []).find(position => position?.engineId === engineId) || null;
}

function buildChannel(route, config, events, fund, asOfDate) {
  const routeEvents = dedupeEvents(events.filter(event => event?.route === route));
  const latestEpoch = latestResolvedEpoch(routeEvents);
  const latest = latestEpoch === null ? [] : routeEvents.filter(event => Number(event?.epoch) === latestEpoch);
  const latestEpochDate = latest.map(event => dayKey(event?.eventDate)).find(Boolean) || null;
  const latestEpochUsd = latest.reduce((sum, event) => {
    const usd = finite(event?.usdValue);
    return sum + (Number.isFinite(usd) && usd > 0 ? usd : 0);
  }, 0);

  const position = positionFor(fund, config.principalEngineId);
  const principalValueUsd = finite(position?.valueUsd);
  const baseAprPct = finite(position?.referenceApr);
  const voteMarketReferenceAprPct = latestEpochUsd > 0 && principalValueUsd > 0
    ? latestEpochUsd / principalValueUsd * WEEKS_PER_YEAR * 100
    : NaN;
  const combinedReferenceAprPct = Number.isFinite(baseAprPct) && Number.isFinite(voteMarketReferenceAprPct)
    ? baseAprPct + voteMarketReferenceAprPct
    : NaN;
  const ageDays = latestEpochDate && asOfDate ? dayDiff(asOfDate, latestEpochDate) : null;

  let status = 'unknown-no-resolved-epoch';
  if (latest.length && latestEpochUsd > 0 && principalValueUsd > 0) {
    status = Number.isFinite(ageDays) && ageDays > 14
      ? 'stale-latest-resolved-epoch-reference'
      : 'latest-resolved-epoch-reference';
  }

  return {
    route,
    protocol: config.protocol,
    principal: config.principal,
    principalEngineId: config.principalEngineId,
    status,
    cadence: 'weekly',
    latestResolvedEpoch: latestEpoch,
    latestResolvedEpochDate: latestEpochDate,
    latestResolvedEpochAgeDays: ageDays,
    latestResolvedEpochUsd: latest.length ? round(latestEpochUsd, 6) : null,
    latestResolvedEpochEventCount: latest.length,
    latestResolvedEpochCampaignCount: unique(latest.map(event => event?.campaignId)).length,
    latestResolvedEpochGaugeCount: unique(latest.map(event => event?.gauge?.toLowerCase?.() || event?.gauge)).length,
    latestResolvedEpochGauges: unique(latest.map(event => event?.gauge)),
    latestResolvedEpochCampaigns: unique(latest.map(event => event?.campaignId).map(value => value === undefined ? null : String(value))),
    rewardSymbols: unique(latest.map(event => event?.rewardSymbol)),
    currentPrincipalValueUsd: Number.isFinite(principalValueUsd) ? round(principalValueUsd, 2) : null,
    baseReferenceAprPct: Number.isFinite(baseAprPct) ? round(baseAprPct, 4) : null,
    voteMarketLatestEpochAnnualizedReferenceAprPct: Number.isFinite(voteMarketReferenceAprPct)
      ? round(voteMarketReferenceAprPct, 4)
      : null,
    combinedLatestEpochReferenceAprPct: Number.isFinite(combinedReferenceAprPct)
      ? round(combinedReferenceAprPct, 4)
      : null,
    formula: 'latestResolvedEpochUsd / currentPrincipalValueUsd * 52 * 100',
    referenceMeaning: 'backward-looking annualised reference from the latest resolved VoteMarket epoch',
    currentEpochForecast: false,
    earnedIncomeAuthority: false,
    factualIncomeAuthority: false,
    accountingCompletionAuthority: false,
    canReplaceUnknown: false,
    additiveToConfirmedMonthlyIncome: false,
    unknownIsNotZero: true,
    executionAuthority: 'none'
  };
}

function build({ reporting, ledger }) {
  const fund = reporting?.funds?.[DEFITEA];
  if (!fund?.latestSnapshot) throw new Error('Defitea Reporting latestSnapshot unavailable');
  const events = Array.isArray(ledger?.voteMarketEvents) ? ledger.voteMarketEvents : [];
  const asOfDate = dayKey(fund.latestSnapshot.date || reporting.generatedAt);
  if (!asOfDate) throw new Error('Defitea reporting date unavailable');

  const channels = Object.fromEntries(
    Object.entries(ROUTES).map(([route, config]) => [route, buildChannel(route, config, events, fund, asOfDate)])
  );

  const latestEpochs = unique(Object.values(channels).map(channel => channel.latestResolvedEpoch));
  const latestGaugeSets = Object.values(channels)
    .filter(channel => channel.latestResolvedEpoch !== null)
    .map(channel => new Set(channel.latestResolvedEpochGauges.map(value => String(value).toLowerCase())));
  const sharedGaugeCount = latestGaugeSets.length === 2
    ? [...latestGaugeSets[0]].filter(gauge => latestGaugeSets[1].has(gauge)).length
    : 0;

  return {
    version: '0.1-votemarket-latest-resolved-epoch-reference',
    generatedAt: new Date().toISOString(),
    asOfDate,
    company: DEFITEA,
    source: {
      factualEventLedger: 'reporting/defitea-income-ledger.json',
      factualEventLedgerVersion: ledger?.version || null,
      factualEventLedgerUpdatedAt: ledger?.updatedAt || null,
      principalAndBaseApr: 'reporting/reporting-data.json',
      reportingVersion: reporting?.version || null,
      reportingGeneratedAt: reporting?.generatedAt || null
    },
    methodology: {
      purpose: 'separate VoteMarket reference economics from factual accounting and base protocol APR',
      latestResolvedEpochOnly: true,
      unresolvedEpochForecasting: false,
      weeklyAnnualisationFactor: WEEKS_PER_YEAR,
      poolAndCampaignAware: true,
      sameGaugeAcrossRoutesMerged: false,
      sameGaugeAcrossRoutesMayBeGroupedForPresentation: true,
      canonicalEventIdentityPreserved: true,
      referenceAprIsEarnedIncomeAuthority: false,
      referenceAprCanCloseAccounting: false,
      referenceAprCanReplaceUnknown: false,
      unknownIsNotZero: true,
      executionAuthority: 'none'
    },
    latestResolvedEpochs,
    sharedGaugeCount,
    channels,
    presentation: {
      preferredStructure: 'Base APR + VoteMarket latest resolved epoch reference',
      monthlyEstimatedIntegration: 'none-until-non-overlap-contract-is-explicit',
      note: 'VoteMarket reference is a backward-looking annualised latest-epoch lens. It is not a prediction of the unresolved next epoch and is never added to Confirmed income.'
    },
    authority: {
      earnedIncome: false,
      factualIncome: false,
      accountingCompletion: false,
      execution: 'none'
    }
  };
}

const reporting = await readJson(REPORTING_DATA_FILE);
const ledger = await readJson(DEFITEA_INCOME_LEDGER_FILE);
const output = build({ reporting, ledger });
await writeJson(OUTPUT_FILE, output);
console.log('VoteMarket reference lane generated', {
  output: OUTPUT_FILE,
  asOfDate: output.asOfDate,
  channels: Object.fromEntries(Object.entries(output.channels).map(([route, row]) => [route, {
    status: row.status,
    epoch: row.latestResolvedEpoch,
    epochUsd: row.latestResolvedEpochUsd,
    baseAprPct: row.baseReferenceAprPct,
    voteMarketReferenceAprPct: row.voteMarketLatestEpochAnnualizedReferenceAprPct,
    combinedReferenceAprPct: row.combinedLatestEpochReferenceAprPct
  }]))
});
