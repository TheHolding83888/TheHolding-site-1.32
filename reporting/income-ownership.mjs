export const INCOME_OWNERSHIP_VERSION = '0.1-exclusive-company-owner';

function companyKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function incomeOwner(row) {
  return companyKey(row?.company) || null;
}

export function incomeOwnedByCompany(row, targetCompany) {
  const owner = incomeOwner(row);
  const target = companyKey(targetCompany);
  return Boolean(owner && target && owner === target);
}

export function filterIncomeOwnedByCompany(rows, targetCompany) {
  return (Array.isArray(rows) ? rows : []).filter((row) => incomeOwnedByCompany(row, targetCompany));
}

export function incomeAttribution(row, targetCompany) {
  const ownerCompany = incomeOwner(row);
  const targetCompanyKey = companyKey(targetCompany) || null;
  const ownedByTarget = Boolean(ownerCompany && targetCompanyKey && ownerCompany === targetCompanyKey);

  return {
    ownerCompany,
    targetCompany: targetCompanyKey,
    ownedByTarget,
    attributableToTarget: ownedByTarget,
    crossCompanyReattributionAllowed: false,
    foreignCompanyContextOnly: Boolean(ownerCompany && targetCompanyKey && ownerCompany !== targetCompanyKey),
  };
}
