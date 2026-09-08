export const COMPANY_INCOME_SCOPE_VERSION = '0.1-explicit-associated-company-economic-reporting-scope';

const DEFAULT_SCOPE = Object.freeze({
  associatedCompanies: Object.freeze([]),
  includeAssociatedConfirmed: false,
  includeAssociatedEstimated: false,
  includeAssociatedCapital: false
});

const DEFINITIONS = Object.freeze({
  'defitea.eth': Object.freeze({
    associatedCompanies: Object.freeze(['YieldRing.eth', '05081966.eth']),
    includeAssociatedConfirmed: true,
    includeAssociatedEstimated: true,
    includeAssociatedCapital: false
  })
});

function companyKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values) {
  return [...new Set((values || []).map(companyKey).filter(Boolean))];
}

export function incomeScopeFor(targetCompany) {
  const target = companyKey(targetCompany);
  if (!target) throw new Error('income reporting scope target company is required');
  const definition = DEFINITIONS[target] || DEFAULT_SCOPE;
  const associatedCompanies = unique(definition.associatedCompanies).filter(name => name !== target);
  const confirmedOwners = unique([
    target,
    ...(definition.includeAssociatedConfirmed === true ? associatedCompanies : [])
  ]);
  const estimatedContributors = unique([
    target,
    ...(definition.includeAssociatedEstimated === true ? associatedCompanies : [])
  ]);
  const capitalOwners = definition.includeAssociatedCapital === true
    ? unique([target, ...associatedCompanies])
    : [target];

  return Object.freeze({
    version: COMPANY_INCOME_SCOPE_VERSION,
    targetCompany: target,
    associatedCompanies: Object.freeze(associatedCompanies),
    confirmedOwners: Object.freeze(confirmedOwners),
    estimatedContributors: Object.freeze(estimatedContributors),
    capitalOwners: Object.freeze(capitalOwners),
    includeAssociatedConfirmed: definition.includeAssociatedConfirmed === true,
    includeAssociatedEstimated: definition.includeAssociatedEstimated === true,
    includeAssociatedCapital: definition.includeAssociatedCapital === true,
    canonicalOwnershipPreserved: true,
    crossCompanyReattributionAllowed: false,
    holdingWideAggregationMustUseCanonicalOwners: true,
    companyReportTotalsAreNotAdditiveAcrossCompanies: associatedCompanies.length > 0,
    executionAuthority: 'none'
  });
}

export function associatedCompaniesFor(targetCompany, lane = 'confirmed') {
  const scope = incomeScopeFor(targetCompany);
  if (lane === 'confirmed') {
    return scope.confirmedOwners.filter(name => name !== scope.targetCompany);
  }
  if (lane === 'estimated') {
    return scope.estimatedContributors.filter(name => name !== scope.targetCompany);
  }
  if (lane === 'capital') {
    return scope.capitalOwners.filter(name => name !== scope.targetCompany);
  }
  throw new Error(`unknown income reporting scope lane: ${lane}`);
}

export function scopeIncludesCanonicalOwner(targetCompany, canonicalOwner, lane = 'confirmed') {
  const owner = companyKey(canonicalOwner);
  if (!owner) return false;
  const scope = incomeScopeFor(targetCompany);
  if (lane === 'confirmed') return scope.confirmedOwners.includes(owner);
  if (lane === 'estimated') return scope.estimatedContributors.includes(owner);
  if (lane === 'capital') return scope.capitalOwners.includes(owner);
  throw new Error(`unknown income reporting scope lane: ${lane}`);
}

export function validateIncomeScopeContract() {
  const defitea = incomeScopeFor('defitea.eth');
  if (defitea.canonicalOwnershipPreserved !== true || defitea.crossCompanyReattributionAllowed !== false) {
    throw new Error('Defitea income scope may not mutate canonical ownership');
  }
  if (defitea.includeAssociatedCapital !== false || defitea.capitalOwners.length !== 1 || defitea.capitalOwners[0] !== 'defitea.eth') {
    throw new Error('Defitea associated company capital leaked into target TVL scope');
  }
  if (JSON.stringify(defitea.associatedCompanies) !== JSON.stringify(['YieldRing.eth', '05081966.eth'])) {
    throw new Error('Defitea associated company scope drift');
  }
  if (!scopeIncludesCanonicalOwner('defitea.eth', 'YieldRing.eth', 'confirmed') || !scopeIncludesCanonicalOwner('defitea.eth', '05081966.eth', 'confirmed')) {
    throw new Error('Defitea confirmed associated company scope missing');
  }
  if (!scopeIncludesCanonicalOwner('defitea.eth', 'YieldRing.eth', 'estimated') || !scopeIncludesCanonicalOwner('defitea.eth', '05081966.eth', 'estimated')) {
    throw new Error('Defitea estimated associated company scope missing');
  }
  if (scopeIncludesCanonicalOwner('defitea.eth', 'YieldRing.eth', 'capital') || scopeIncludesCanonicalOwner('defitea.eth', '05081966.eth', 'capital')) {
    throw new Error('Defitea associated company capital unexpectedly admitted');
  }
  return true;
}

validateIncomeScopeContract();
