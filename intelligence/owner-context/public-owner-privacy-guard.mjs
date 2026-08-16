import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OWNER_DIR = path.join(ROOT, 'intelligence/owner-context');
const POLICY_FILE = path.join(OWNER_DIR, 'public-owner-privacy-policy.json');

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:^|[^\d])(?:\+?\d[\d ()-]{7,}\d)(?:$|[^\d])/;
const FORBIDDEN_KEY_RE = /^(?:personal)?(?:email|phone|telephone|mobile|realname|legalname|fullname|profilename|username|socialhandle|telegram|discord|dateofbirth|birthdate|taxid|passport|nationalid|homeaddress|privateaddress|connectedaccount|connectedserviceprofile)$/i;
const HUMAN_IDENTITY_LABEL_RE = /\b(?:personal\s+email|real\s+name|legal\s+name|personal\s+profile|personal\s+username|social\s+handle|telegram\s+handle|discord\s+handle|phone\s+number|date\s+of\s+birth|home\s+address)\s*:/i;

function fail(message) {
  throw new Error(message);
}

function walkJson(value, trail, findings) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, `${trail}[${index}]`, findings));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY_RE.test(key.replace(/[-_\s]/g, ''))) {
        findings.push(`${trail}.${key}: forbidden personal-identity key`);
      }
      walkJson(child, `${trail}.${key}`, findings);
    }
    return;
  }
  if (typeof value === 'string') {
    if (EMAIL_RE.test(value)) findings.push(`${trail}: email-like personal identifier`);
    if (HUMAN_IDENTITY_LABEL_RE.test(value)) findings.push(`${trail}: explicit personal-identity label`);
  }
}

if (!fs.existsSync(POLICY_FILE)) fail('Missing public owner privacy policy');
const policy = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8'));
if (policy?.status !== 'canonical-read-only-privacy-policy') fail('Unexpected privacy policy status');
if (policy?.authority?.personalDataPublicDisclosure !== false) fail('Privacy policy permits public personal-data disclosure');
if (policy?.boundary?.ownerContextIsNotOwnerIdentity !== true) fail('Owner Context / Owner Identity boundary missing');

const profileFiles = fs.readdirSync(OWNER_DIR)
  .filter(name => name === 'owner-operating-profile.json' || /^owner-operating-profile-tranche-\d+\.json$/.test(name))
  .sort();

const findings = [];
const humanReadableFiles = new Set();
for (const name of profileFiles) {
  const rel = `intelligence/owner-context/${name}`;
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (EMAIL_RE.test(text)) findings.push(`${rel}: email-like identifier present`);
  let data;
  try { data = JSON.parse(text); } catch (error) { fail(`${rel}: invalid JSON: ${error.message}`); }
  walkJson(data, rel, findings);
  const human = data?.source?.humanReadableSource;
  if (typeof human === 'string' && human) humanReadableFiles.add(human);
}

for (const rel of humanReadableFiles) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    findings.push(`${rel}: referenced human-readable owner source missing`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (EMAIL_RE.test(text)) findings.push(`${rel}: email-like identifier present`);
  if (HUMAN_IDENTITY_LABEL_RE.test(text)) findings.push(`${rel}: explicit personal-identity label present`);
  // Phone scanning is limited to prose sources because wallet/chain JSON contains many numeric values.
  if (PHONE_RE.test(text)) {
    // Avoid treating dates/version numbers as phone numbers by requiring an explicit contact-style label nearby.
    if (/\b(?:phone|telephone|mobile|whatsapp)\b/i.test(text)) findings.push(`${rel}: contact-style phone data may be present`);
  }
}

if (findings.length > 0) {
  console.error('PUBLIC OWNER PRIVACY GUARD FAILED');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'pass',
  policyVersion: policy.version,
  profileFilesChecked: profileFiles.length,
  humanReadableSourcesChecked: humanReadableFiles.size,
  personalIdentityFindings: 0,
  executionAuthority: policy.authority.executionAuthority
}, null, 2));
