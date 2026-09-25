// Helpers that drive the page like a presenter would: the on-screen cursor
// glides to an element, a ripple shows the click, callouts point at things.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Director {
  constructor(page) {
    this.page = page;
    this.pos = { x: 960, y: 540 };
  }

  wait(ms) {
    return sleep(ms);
  }

  async rect(target) {
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
    await loc.waitFor({ state: 'visible' });
    await loc.scrollIntoViewIfNeeded();
    return loc.boundingBox();
  }

  /** Re-sync the overlay cursor after a full page load. */
  async restoreCursor() {
    await this.page.waitForFunction(() => window.__demo);
    await this.page.evaluate(({ x, y }) => window.__demo.setPos(x, y), this.pos);
  }

  async moveTo(target, { dx = 0, dy = 0 } = {}) {
    const r = await this.rect(target);
    const x = Math.round(r.x + r.width / 2 + dx);
    const y = Math.round(r.y + r.height / 2 + dy);
    const dist = Math.hypot(x - this.pos.x, y - this.pos.y);
    const ms = Math.round(Math.min(1100, Math.max(450, dist * 0.9)));
    await this.page.evaluate(([x, y, ms]) => window.__demo.moveTo(x, y, ms), [x, y, ms]);
    await this.page.mouse.move(x, y); // real hover states
    this.pos = { x, y };
    return r;
  }

  async click(target, opts) {
    await this.moveTo(target, opts);
    await sleep(180);
    await this.page.evaluate(() => window.__demo.press());
    await this.page.mouse.click(this.pos.x, this.pos.y);
    await sleep(250);
  }

  async type(target, text, { clear = false } = {}) {
    await this.click(target);
    if (clear) {
      await this.page.keyboard.press('ControlOrMeta+A');
      await this.page.keyboard.press('Backspace');
    }
    await this.page.keyboard.type(text, { delay: 65 });
  }

  async callout(target, html, { id = 'main', placement = 'auto', hold = 0 } = {}) {
    const r = await this.rect(target);
    await this.page.evaluate(([id, r, html, p]) => window.__demo.callout(id, r, html, p), [id, r, html, placement]);
    if (hold) await sleep(hold);
  }

  clearCallout(id) {
    return this.page.evaluate((id) => window.__demo.clearCallout(id), id);
  }

  async spotlight(target, pad) {
    const r = await this.rect(target);
    await this.page.evaluate(([r, pad]) => window.__demo.spotlight(r, pad), [r, pad]);
  }

  clearSpotlight() {
    return this.page.evaluate(() => window.__demo.clearSpotlight());
  }

  title(kicker, t, s) {
    return this.page.evaluate(([k, t, s]) => window.__demo.title(k, t, s), [kicker, t, s]);
  }

  clearTitle() {
    return this.page.evaluate(() => window.__demo.clearTitle());
  }

  chip(text) {
    return this.page.evaluate((t) => window.__demo.chip(t), text);
  }

  clearChip() {
    return this.page.evaluate(() => window.__demo.clearChip());
  }

  cursorVisible(v) {
    return this.page.evaluate((v) => window.__demo.cursorVisible(v), v);
  }

  async clearAll() {
    await this.page.evaluate(() => {
      window.__demo.clearCallout();
      window.__demo.clearSpotlight();
      window.__demo.clearChip();
    });
  }
}
