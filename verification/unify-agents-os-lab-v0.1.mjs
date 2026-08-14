#!/usr/bin/env node
import fs from 'node:fs';

const AGENTS = 'agents/index.html';
const CONSOLE = 'agents/console/index.html';
const agents = fs.readFileSync(AGENTS, 'utf8');
const consoleHtml = fs.readFileSync(CONSOLE, 'utf8');
const fail = message => { throw new Error(message); };

const count = (text, needle) => text.split(needle).length - 1;
function replaceOnce(text, before, after, label) {
  const n = count(text, before);
  if (n !== 1) fail(`${label}: expected exactly one anchor, found ${n}`);
  return text.replace(before, after);
}

// Fail closed if this branch is not based on the exact expected current page family.
if (!agents.includes('The Holding Observer') || !agents.includes('The Holding Cognitive Stack')) fail('agents page is not the expected Observer + Cognitive Stack surface');
if (!agents.includes('Agent Dialogue Preview') || !agents.includes('Intelligence Infrastructure')) fail('agents page is missing existing content that must be preserved');
if (!consoleHtml.includes('Live knowledge console · v0.4 source-bound answers')) fail('source Console is not Ask The Holding v0.4');
if (!consoleHtml.includes('Source-bound answers')) fail('source Console Answer Contract marker missing');
if (agents.includes('id="ask-the-holding"') || agents.includes('id="console"')) fail('agents page already appears unified; refusing duplicate integration');

const askCss = String.raw`

        /* =========================================================
           THE HOLDING OS LAB · ASK THE HOLDING v0.4
           Canonical conversational surface on /agents/
           Existing source-bound router + safety layer are reused.
           ========================================================= */
        .oslab-ask-section {
            padding: 0 0 5rem;
        }
        .oslab-ask-heading {
            max-width: 820px;
            margin: 0 auto 2rem;
            text-align: center;
        }
        .oslab-ask-eyebrow {
            margin-bottom: .75rem;
            color: var(--accent-azure, #2d5f87);
            font: 700 .66rem/1.2 'Space Grotesk', sans-serif;
            letter-spacing: .24em;
            text-transform: uppercase;
        }
        .oslab-ask-heading h2 {
            margin: 0 0 .8rem;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: clamp(2.4rem, 5vw, 3.8rem);
            font-weight: 300;
            line-height: 1.05;
            letter-spacing: -.03em;
        }
        .oslab-ask-heading p {
            max-width: 720px;
            margin: 0 auto;
            color: var(--text-secondary);
            font-size: 1rem;
            font-weight: 300;
            line-height: 1.75;
        }
        .oslab-boundary {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: .5rem;
            margin-top: 1.15rem;
        }
        .oslab-pill {
            border: 1px solid var(--border-light);
            background: rgba(255,255,255,.72);
            border-radius: 999px;
            padding: .42rem .68rem;
            color: var(--text-tertiary);
            font: 600 .56rem/1.2 'Space Grotesk', sans-serif;
            letter-spacing: .08em;
            text-transform: uppercase;
        }
        .oslab-pill.live {
            color: #0a7c4e;
            border-color: rgba(10,124,78,.2);
            background: rgba(10,124,78,.045);
        }
        #console.oslab-console {
            overflow: hidden;
            color: #ecf3f8;
            background:
                radial-gradient(circle at 85% -20%, rgba(138,184,221,.12), transparent 34%),
                linear-gradient(145deg, #0d1115, #141a20);
            border: 1px solid rgba(18,24,30,.9);
            border-radius: 20px;
            box-shadow: 0 34px 84px -45px rgba(0,0,0,.68), inset 0 1px 0 rgba(255,255,255,.045);
        }
        #console .oslab-console-topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            padding: .9rem 1.1rem;
            border-bottom: 1px solid rgba(255,255,255,.08);
            color: rgba(231,239,245,.76);
            font: 600 .62rem/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            letter-spacing: .1em;
            text-transform: uppercase;
        }
        #console .oslab-status { display:flex; align-items:center; gap:.5rem; color:#b8c3cc; }
        #console .oslab-dot { width:7px; height:7px; border-radius:50%; background:#70808d; }
        #console[data-health="ready"] .oslab-dot { background:#42d392; box-shadow:0 0 14px rgba(66,211,146,.5); }
        #console[data-health="watch"] .oslab-dot { background:#f2bb54; }
        #console[data-health="offline"] .oslab-dot { background:#7d858b; }
        #console .oslab-summary { padding:1.35rem 1.3rem 1.15rem; border-bottom:1px solid rgba(255,255,255,.08); }
        #console .oslab-summary-label { color:#7896ad; font:700 .56rem/1.2 'Space Grotesk',sans-serif; letter-spacing:.14em; text-transform:uppercase; }
        #console .oslab-summary-text { margin-top:.5rem; color:#f7fafc; font:400 clamp(1.25rem,3vw,1.75rem)/1.3 'Cormorant Garamond',Georgia,serif; }
        #console .oslab-facts { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border-bottom:1px solid rgba(255,255,255,.08); }
        #console .oslab-fact { min-width:0; padding:.9rem 1rem; border-right:1px solid rgba(255,255,255,.07); }
        #console .oslab-fact:last-child { border-right:0; }
        #console .oslab-fact strong { display:block; color:#f8fbfd; font-size:1rem; overflow-wrap:anywhere; }
        #console .oslab-fact span { color:#82909a; font:600 .52rem/1.3 'Space Grotesk',sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        #console .oslab-dialog { padding:1.25rem; }
        #console #messages { display:flex; flex-direction:column; gap:.75rem; min-height:250px; max-height:520px; overflow:auto; padding-right:.25rem; }
        #console .msg { max-width:90%; padding:.78rem .9rem; border-radius:14px; font-size:.82rem; line-height:1.55; white-space:pre-wrap; }
        #console .msg.system { background:rgba(255,255,255,.055); color:#d8e0e6; border:1px solid rgba(255,255,255,.07); }
        #console .msg.user { align-self:flex-end; background:#234d6c; color:#fff; }
        #console .msg.pending { opacity:.65; }
        #console .msg .meta { display:block; margin-bottom:.32rem; color:#82a9c5; font:700 .5rem/1.2 'Space Grotesk',sans-serif; letter-spacing:.11em; text-transform:uppercase; }
        #console .msg .source { display:block; margin-top:.5rem; padding-top:.45rem; border-top:1px solid rgba(255,255,255,.07); color:#74838e; font-size:.52rem; letter-spacing:.04em; }
        #console #quick { display:flex; flex-wrap:wrap; gap:.45rem; margin:1rem 0 .75rem; }
        #console #quick button { border:1px solid rgba(138,184,221,.22); background:rgba(138,184,221,.055); color:#b9d3e7; border-radius:999px; padding:.48rem .68rem; font:500 .62rem/1.2 'Space Grotesk',sans-serif; cursor:pointer; }
        #console #quick button:hover { background:rgba(138,184,221,.11); }
        #console .oslab-ask-form { display:flex; gap:.55rem; }
        #console #question { min-width:0; flex:1; border:1px solid rgba(255,255,255,.12); background:#090d11; color:#eef4f8; border-radius:12px; padding:.78rem .85rem; font:400 .82rem/1.4 'Space Grotesk',sans-serif; outline:none; }
        #console #question:focus { border-color:rgba(138,184,221,.5); }
        #console #askButton { border:0; border-radius:12px; background:#e7f0f6; color:#15364e; font:700 .72rem/1 'Space Grotesk',sans-serif; padding:0 1.1rem; cursor:pointer; }
        #console #askButton:disabled { opacity:.45; cursor:not-allowed; }
        #console .oslab-learning-line { display:flex; align-items:flex-start; justify-content:space-between; gap:.9rem; margin-top:.7rem; padding-top:.7rem; border-top:1px solid rgba(255,255,255,.07); color:#82909a; font-size:.58rem; line-height:1.5; }
        #console .oslab-learning-opt { display:flex; align-items:flex-start; gap:.42rem; max-width:700px; cursor:pointer; }
        #console .oslab-learning-opt input { margin-top:.14rem; accent-color:#8ab8dd; }
        #console .oslab-learning-meta { text-align:right; white-space:nowrap; }
        #console .oslab-learning-meta a { color:#9fc4df; text-decoration:none; }
        #console .learning-feedback { display:flex; align-items:center; gap:.38rem; margin-top:.55rem; padding-top:.5rem; border-top:1px solid rgba(255,255,255,.07); color:#74838e; font-size:.52rem; }
        #console .learning-feedback button { border:1px solid rgba(138,184,221,.2); background:rgba(138,184,221,.05); color:#a9c5da; border-radius:999px; padding:.25rem .48rem; font-size:.52rem; cursor:pointer; }
        #console .oslab-note { margin-top:.65rem; color:#76838d; font-size:.58rem; line-height:1.55; }
        .oslab-explain { display:grid; grid-template-columns:1fr 1fr; gap:.8rem; margin-top:.9rem; }
        .oslab-explain article { padding:1rem 1.05rem; border:1px solid var(--border-light); border-radius:15px; background:rgba(255,255,255,.7); }
        .oslab-explain h3 { margin:0 0 .35rem; font:400 1.35rem/1.1 'Cormorant Garamond',Georgia,serif; }
        .oslab-explain p { margin:0; color:var(--text-secondary); font-size:.72rem; line-height:1.65; }
        @media (max-width:720px) {
            .oslab-ask-section { padding-bottom:4rem; }
            #console .oslab-facts { grid-template-columns:1fr 1fr; }
            #console .oslab-fact:nth-child(2) { border-right:0; }
            #console .oslab-fact:nth-child(-n+2) { border-bottom:1px solid rgba(255,255,255,.07); }
            #console .msg { max-width:97%; }
            #console .oslab-ask-form { flex-direction:column; }
            #console #askButton { padding:.78rem; }
            #console .oslab-learning-line { flex-direction:column; }
            #console .oslab-learning-meta { text-align:left; white-space:normal; }
            .oslab-explain { grid-template-columns:1fr; }
        }
`;

const askMarkup = String.raw`

    <!-- Ask The Holding · canonical conversational surface of The Holding OS -->
    <section class="oslab-ask-section" id="ask-the-holding" aria-label="Ask The Holding">
        <div class="container">
            <div class="oslab-ask-heading">
                <div class="oslab-ask-eyebrow">The Holding OS Lab · Live</div>
                <h2>Ask The Holding.</h2>
                <p>
                    The live conversational surface of The Holding OS. Ask about companies, funds,
                    capital layers, productivity, Stable Capital, system state, learning and architecture.
                    Answers use Holding-owned sources or explicitly remain unknown.
                </p>
                <div class="oslab-boundary">
                    <span class="oslab-pill live">Live Holding data</span>
                    <span class="oslab-pill">Source-bound answers</span>
                    <span class="oslab-pill">RU / EN</span>
                    <span class="oslab-pill">Read-only</span>
                    <span class="oslab-pill">No financial advice</span>
                    <span class="oslab-pill">No wallet authority</span>
                </div>
            </div>

            <div class="oslab-console" id="console" data-health="offline">
                <div class="oslab-console-topbar">
                    <div>THE HOLDING // KNOWLEDGE ROUTER</div>
                    <div class="oslab-status"><span class="oslab-dot"></span><span id="statusText">CONNECTING</span></div>
                </div>
                <div class="oslab-summary">
                    <div class="oslab-summary-label">In plain language</div>
                    <div class="oslab-summary-text" id="summaryText">Loading current verified state and live company data…</div>
                </div>
                <div class="oslab-facts">
                    <div class="oslab-fact"><strong id="companyFact">—</strong><span>Companies</span></div>
                    <div class="oslab-fact"><strong id="engineFact">—</strong><span>Productivity engines</span></div>
                    <div class="oslab-fact"><strong id="stableFact">—</strong><span>Stable positions</span></div>
                    <div class="oslab-fact"><strong id="securityFact">—</strong><span>Security</span></div>
                </div>
                <div class="oslab-dialog">
                    <div id="messages" aria-live="polite"></div>
                    <div id="quick"></div>
                    <form class="oslab-ask-form" id="askForm">
                        <input id="question" autocomplete="off" maxlength="700" placeholder="Спроси: сколько компаний? какая доходность Aerodrome? что такое слои капитала?">
                        <button id="askButton" disabled>Ask</button>
                    </form>
                    <div class="oslab-learning-line">
                        <label class="oslab-learning-opt"><input type="checkbox" id="learningOptIn" disabled><span>Help The Holding learn from a privacy-filtered version of my question. Optional. Never enter seed phrases, private keys, passwords or personal financial details.</span></label>
                        <div class="oslab-learning-meta"><span id="learningState">Checking safe learning…</span><br><a href="/agents/console/learning-notice.html">Learning &amp; safety notice</a></div>
                    </div>
                    <div class="oslab-note">Informational and educational only. The console can show verified data, explain mechanisms and risks, but it does not tell people what to buy, sell or how much to invest. Public messages never become canonical facts, code, methodology or capital authority by themselves.</div>
                </div>
            </div>

            <div class="oslab-explain">
                <article><h3>How it learns safely</h3><p><strong>Conversation can create a learning signal, not authority.</strong> Useful gaps and bad answers can become review candidates. Public text cannot directly rewrite memory, code, methodology, security rules or capital actions.</p></article>
                <article><h3>What stays separate</h3><p>Public questions are untrusted input. Verified project data remains the source of truth. Future generative AI dialogue must stay read-only first, with separate tool permissions, prompt-injection boundaries and an immutable action audit.</p></article>
            </div>
        </div>
    </section>
`;

let next = agents;
next = replaceOnce(next,
`                    <a href="#cognitive" class="nav-link">Cognitive Stack</a>`,
`                    <a href="#ask-the-holding" class="nav-link">Ask The Holding</a>\n                    <a href="#cognitive" class="nav-link">Cognitive Stack</a>`,
'nav integration');

// Add styles at the final style boundary so the namespaced layer wins without rewriting old CSS.
next = replaceOnce(next, '\n    </style>\n</head>', askCss + '\n    </style>\n</head>', 'Ask CSS insertion');

// Put the live chat after the existing hero and before the two existing live instrument windows.
next = replaceOnce(next,
`\n\n    <!-- The Holding Observer · live read-only intelligence stream -->`,
askMarkup + `\n\n    <!-- The Holding Observer · live read-only intelligence stream -->`,
'Ask markup insertion');

// Reuse the verified v0.4 router and safety assets. Keep them where they already live to minimize blast radius.
next = replaceOnce(next,
`\n<!-- The Holding · Design Layer v2 · behaviour -->`,
`\n    <!-- Ask The Holding v0.4 · reused source-bound router + safety layer -->\n    <script src="/agents/console/safety.js?v=0.1" defer></script>\n    <script src="/agents/console/app.js?v=0.4" defer></script>\n\n<!-- The Holding · Design Layer v2 · behaviour -->`,
'Ask script integration');

const redirect = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <meta http-equiv="refresh" content="0; url=/agents/#ask-the-holding">\n  <title>Ask The Holding | Moved to The Holding OS Lab</title>\n  <link rel="canonical" href="https://theholding.ai/agents/">\n  <script>location.replace('/agents/#ask-the-holding');</script>\n</head>\n<body>\n  <!-- Legacy compatibility surface. Ask The Holding. Live knowledge console. -->\n  <p>Ask The Holding. Live knowledge console has moved to <a href="/agents/#ask-the-holding">The Holding OS Lab</a>.</p>\n</body>\n</html>\n`;

// Structural verification before writing anything.
const requiredOnce = [
  'id="ask-the-holding"', 'id="console"', 'id="messages"', 'id="askForm"', 'id="question"', 'id="askButton"',
  'id="learningOptIn"', 'id="learningState"', 'id="observerShell"', 'id="cognitiveShell"',
  'src="/agents/console/safety.js?v=0.1"', 'src="/agents/console/app.js?v=0.4"'
];
for (const marker of requiredOnce) {
  const n = count(next, marker);
  if (n !== 1) fail(`final structural check: ${marker} count=${n}`);
}
for (const preserved of ['Meet the Agents', 'Agent Dialogue Preview', 'Intelligence Infrastructure', 'The Holding Observer', 'The Holding Cognitive Stack']) {
  if (!next.includes(preserved)) fail(`preservation check failed: ${preserved}`);
}
const positions = [next.indexOf('id="ask-the-holding"'), next.indexOf('id="observer"'), next.indexOf('id="cognitive"'), next.indexOf('id="agents"'), next.indexOf('id="demo"'), next.indexOf('id="knowledge"')];
if (positions.some(x => x < 0) || !positions.every((x, i) => i === 0 || x > positions[i - 1])) fail('section order is not Ask → Observer → Cognitive → Agents → Demo → Infrastructure');
if (!redirect.includes('Ask The Holding.') || !redirect.includes('Live knowledge console')) fail('legacy redirect must preserve production-boundary identity markers');
if (!redirect.includes('/agents/#ask-the-holding')) fail('legacy redirect target missing');

fs.writeFileSync(AGENTS, next, 'utf8');
fs.writeFileSync(CONSOLE, redirect, 'utf8');

console.log(JSON.stringify({
  status: 'patched',
  canonicalUi: '/agents/#ask-the-holding',
  legacyConsole: 'redirect-only',
  preservedExistingSections: true,
  reusedRouter: '/agents/console/app.js?v=0.4',
  reusedSafety: '/agents/console/safety.js?v=0.1',
  persistentLearningActivated: false
}, null, 2));
