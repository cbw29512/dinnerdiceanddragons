// Design-pass checks for Dinner, Dice & Dragons. Run from the repo root:
//   node tests/design-pass-checks.mjs
// No dependencies. Exits non-zero if any check fails.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const BMC = "https://buymeacoffee.com/divclass016";
const PUBLIC_PAGES = [
  "index.html", "join.html", "venues.html", "find-venue.html", "create-game.html", "game-hub.html",
  "conduct.html", "form-series.html", "recurring-match.html", "reputation.html",
  "series-commitments.html", "table-lifecycle.html", "venue-feedback.html"
];

let failures = 0;
const ok = (condition, message) => {
  if (condition) console.log(`  ok   ${message}`);
  else { failures += 1; console.log(`  FAIL ${message}`); }
};
const read = (file) => readFileSync(file, "utf8");

console.log("Header support pill + shared stylesheet");
let supportCards = 0;
for (const page of PUBLIC_PAGES) {
  const html = read(page);
  const header = (html.match(/<header[\s\S]*?<\/header>/) || [""])[0];
  ok(header.includes(`class="ddd-bmc" href="${BMC}"`), `${page}: Buy Me a Coffee pill in the header`);
  ok(/<a class="ddd-bmc"[^>]*rel="noopener noreferrer"/.test(header), `${page}: pill opens safely in a new tab`);
  ok(html.includes('<link rel="stylesheet" href="site-polish.css">'), `${page}: loads site-polish.css`);
  if (header.includes('id="ddd-global-account-button"')) {
    ok(/<div class="ddd-header-actions">[\s\S]*id="ddd-global-account-button"[\s\S]*<\/div>/.test(header), `${page}: Sign In sits in the header actions group`);
  }
  supportCards += (html.match(/class="ddd-support-card"/g) || []).length;
}
ok(supportCards === 1, `exactly one support card site-wide (found ${supportCards})`);

console.log("Offer slot stays hidden and empty");
const home = read("index.html");
ok(/<aside class="ddd-offer-slot" id="ddd-offer-slot" data-ddd-offer-slot hidden aria-label="Partner offer"><\/aside>/.test(home), "index.html: offer slot is hidden with no content");
ok(home.includes('<script src="offer-config.js"></script>\n<script src="offer-slot.js"></script>'), "index.html: loads offer config before the renderer");

const sandbox = { window: {}, console, URL, document: { readyState: "complete", querySelector: () => null } };
vm.createContext(sandbox);
vm.runInContext(read("offer-config.js"), sandbox);
vm.runInContext(read("offer-slot.js"), sandbox);
const config = sandbox.window.DDD_OFFER_CONFIG;
const { isRenderable } = sandbox.window.DDDOfferSlot;
ok(config.enabled === false && config.url === "" && config.title === "" && config.cta === "", "offer-config.js ships disabled with no URL or copy");
ok(isRenderable(config) === false, "default config does not render");
const valid = { enabled: true, title: "Offer", cta: "Go", url: "https://partner.test/offer", disclosure: "We may earn a commission." };
ok(isRenderable(valid) === true, "a complete https config renders");
ok(isRenderable({ ...valid, enabled: false }) === false, "disabled config does not render");
ok(isRenderable({ ...valid, url: "http://partner.test/offer" }) === false, "non-https URL is rejected");
ok(isRenderable({ ...valid, url: "https://example.com/offer" }) === false, "example.com placeholder is rejected");
ok(isRenderable({ ...valid, url: "https://partner.test/TODO" }) === false, "TODO placeholder is rejected");
ok(isRenderable({ ...valid, disclosure: " " }) === false, "missing disclosure is rejected");
ok(read("offer-slot.js").includes('link.rel = "sponsored noopener noreferrer"'), "rendered offer link is rel=sponsored");
ok(!/innerHTML/.test(read("offer-slot.js")), "offer renderer never uses innerHTML");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll design-pass checks passed");
process.exit(failures ? 1 : 0);
