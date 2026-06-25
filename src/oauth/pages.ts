// ─── Consent / login HTML (server-rendered, no client JS) ────────────
// Rendered by the OAuth default handler. All dynamic values are HTML-escaped
// and the responses carry a strict CSP (set in default-handler.ts): no scripts,
// inline styles only, form-action 'self'. The forms post back to /authorize and
// the OAuth request is recovered from KV via the login-state cookie.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
:root { --rx-accent: #EA580C; --rx-ink: #09090B; --rx-cyan: #06B6D4; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: #0d1117; color: #e6edf3; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
.card { width: 100%; max-width: 400px; margin: 24px; background: #161b22; border: 1px solid #30363d;
  border-radius: 14px; overflow: hidden; }
.bar { height: 4px; background: linear-gradient(90deg, var(--rx-accent), var(--rx-cyan)); }
.inner { padding: 28px 28px 32px; }
.brand { font-weight: 700; font-size: 18px; color: var(--rx-accent); margin: 0 0 4px; }
.sub { color: #9198a1; font-size: 13px; margin: 0 0 20px; }
h1 { font-size: 18px; margin: 0 0 8px; }
p { color: #c9d1d9; font-size: 14px; line-height: 1.5; }
label { display: block; font-size: 13px; color: #9198a1; margin: 16px 0 6px; }
input[type=email], input[type=text] { width: 100%; padding: 11px 12px; border-radius: 8px;
  border: 1px solid #30363d; background: #0d1117; color: #e6edf3; font-size: 15px; }
input:focus { outline: 2px solid var(--rx-accent); border-color: var(--rx-accent); }
button { width: 100%; margin-top: 20px; padding: 11px; border: 0; border-radius: 8px;
  background: var(--rx-accent); color: #fff; font-weight: 600; font-size: 15px; cursor: pointer; }
.client { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 12px 14px; margin: 16px 0; font-size: 13px; }
.client b { color: #e6edf3; }
.badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; vertical-align: middle; }
.badge-ok { background: rgba(63,185,80,.15); color: #3fb950; border: 1px solid rgba(63,185,80,.4); }
.badge-warn { background: rgba(210,153,34,.15); color: #d29922; border: 1px solid rgba(210,153,34,.5); }
.origin { display: block; margin-top: 8px; color: #9198a1; font-size: 12px; word-break: break-all; }
.origin code { color: #e6edf3; }
.err { background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.4); color: #ff7b72;
  padding: 10px 12px; border-radius: 8px; font-size: 13px; margin: 12px 0; }
.foot { color: #6b7280; font-size: 12px; margin-top: 18px; }
.foot a { color: var(--rx-accent); }
button[disabled] { opacity: .85; cursor: progress; }
button[disabled]::after { content: ""; display: inline-block; width: 13px; height: 13px;
  margin-left: 9px; vertical-align: -2px; border: 2px solid rgba(255,255,255,.45);
  border-top-color: #fff; border-radius: 50%; animation: rx-spin .7s linear infinite; }
@keyframes rx-spin { to { transform: rotate(360deg); } }
`;

// Disables the submit button + shows a spinner on submit, so the 1-3s server
// round-trip (verify code → mint/encrypt key → complete grant → redirect) isn't
// a dead-looking pause. Served only with a per-request CSP nonce (no inline
// script runs without it).
function loadingScript(nonce: string): string {
  return `<script nonce="${nonce}">(function(){var f=document.querySelector('form');if(!f)return;f.addEventListener('submit',function(){var b=f.querySelector('button');if(b){b.disabled=true;b.setAttribute('aria-busy','true');b.textContent='Connecting';}});})();</script>`;
}

function shell(title: string, inner: string, nonce?: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body><div class="card"><div class="bar"></div><div class="inner">${inner}</div></div>${nonce ? loadingScript(nonce) : ""}</body></html>`;
}

interface ConsentMeta {
  clientName?: string;
  redirectOrigin?: string;
  verified?: boolean;
  csrf: string;
  error?: string;
  nonce?: string;
}

/** Step 1: collect the email and consent to connect the client. */
export function renderEmailForm(meta: ConsentMeta): string {
  const client = meta.clientName ? escapeHtml(meta.clientName) : "An MCP client";
  // The DCR client_name is self-asserted, so show where it actually redirects +
  // a verified/unverified badge so a user can spot a phishing client.
  const badge = meta.verified
    ? '<span class="badge badge-ok">Verified</span>'
    : '<span class="badge badge-warn">Unverified app</span>';
  const originLine = meta.redirectOrigin
    ? `<span class="origin">Redirects to <code>${escapeHtml(meta.redirectOrigin)}</code></span>`
    : "";
  return shell(
    "Connect Rendex",
    `<p class="brand">Rendex</p>
<p class="sub">Connect your account to this app</p>
<div class="client"><b>${client}</b> ${badge} wants to use Rendex to render screenshots, PDFs, and artifacts on your behalf, billed to your account's credits.${originLine}</div>
${meta.error ? `<div class="err">${escapeHtml(meta.error)}</div>` : ""}
<form method="post" action="/authorize">
  <input type="hidden" name="step" value="email">
  <input type="hidden" name="csrf" value="${escapeHtml(meta.csrf)}">
  <label for="email">Account email</label>
  <input id="email" type="email" name="email" required autocomplete="email" placeholder="you@example.com">
  <button type="submit">Send login code</button>
</form>
<p class="foot">We'll email you a one-time code. New here? A free account is created automatically. <a href="https://rendex.dev">rendex.dev</a></p>`,
    meta.nonce
  );
}

/** Step 2: enter the emailed one-time code. */
export function renderCodeForm(meta: ConsentMeta & { email: string }): string {
  return shell(
    "Enter your code",
    `<p class="brand">Rendex</p>
<p class="sub">Check your email</p>
<p>We sent a one-time code to <b>${escapeHtml(meta.email)}</b>. Enter it to finish connecting.</p>
${meta.error ? `<div class="err">${escapeHtml(meta.error)}</div>` : ""}
<form method="post" action="/authorize">
  <input type="hidden" name="step" value="code">
  <input type="hidden" name="csrf" value="${escapeHtml(meta.csrf)}">
  <label for="code">One-time code</label>
  <input id="code" type="text" name="code" required inputmode="numeric" autocomplete="one-time-code" placeholder="123456">
  <button type="submit">Connect Rendex</button>
</form>
<p class="foot">Code not arriving? Check spam, or restart from your client.</p>`,
    meta.nonce
  );
}

export function renderErrorPage(message: string): string {
  return shell(
    "Something went wrong",
    `<p class="brand">Rendex</p><h1>Couldn't complete sign-in</h1>
<div class="err">${escapeHtml(message)}</div>
<p class="foot">Close this window and try connecting again from your client.</p>`
  );
}
