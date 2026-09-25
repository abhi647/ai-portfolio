// Injected into every page of the demo recording. Draws a fake cursor, click
// ripples, callouts, a spotlight and title cards on top of the real app.
// Everything is pointer-events: none so the app itself stays clickable.
(() => {
  if (window.__demo) return;

  const css = `
    #__demo-root, #__demo-root * { box-sizing: border-box; font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
    #__demo-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
    #__demo-cursor { position: absolute; left: 0; top: 0; width: 30px; height: 30px; transform-origin: 4px 3px;
      transition: transform 120ms ease; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); will-change: left, top; }
    #__demo-cursor.down { transform: scale(.82); }
    .__demo-ripple { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%;
      border: 3px solid rgba(59,130,246,.95); background: rgba(59,130,246,.25);
      animation: __demo-ripple 650ms ease-out forwards; }
    @keyframes __demo-ripple { to { transform: scale(4.2); opacity: 0; } }
    #__demo-spot { position: absolute; border-radius: 12px; opacity: 0;
      box-shadow: 0 0 0 4px rgba(59,130,246,.9), 0 0 0 9999px rgba(15,23,42,.55);
      transition: all 450ms cubic-bezier(.4,0,.2,1); }
    #__demo-spot.on { opacity: 1; }
    .__demo-callout { position: absolute; max-width: 340px; padding: 12px 16px; border-radius: 12px;
      background: #0f172a; color: #f8fafc; font-size: 17px; line-height: 1.4; font-weight: 500;
      box-shadow: 0 12px 32px rgba(0,0,0,.35); border: 1px solid rgba(148,163,184,.25);
      opacity: 0; transform: translateY(6px) scale(.97); transition: opacity 260ms ease, transform 260ms ease; }
    .__demo-callout.on { opacity: 1; transform: none; }
    .__demo-callout b { color: #93c5fd; font-weight: 700; }
    .__demo-callout .step { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px;
      margin-right: 8px; border-radius: 50%; background: #3b82f6; color: #fff; font-size: 13px; font-weight: 700; vertical-align: 1px; }
    .__demo-callout::after { content: ''; position: absolute; width: 14px; height: 14px; background: #0f172a;
      border: 1px solid rgba(148,163,184,.25); transform: rotate(45deg); }
    .__demo-callout[data-p=bottom]::after { top: -8px; left: var(--ax); border-right: 0; border-bottom: 0; }
    .__demo-callout[data-p=top]::after { bottom: -8px; left: var(--ax); border-left: 0; border-top: 0; }
    .__demo-callout[data-p=right]::after { left: -8px; top: var(--ay); border-right: 0; border-top: 0; }
    .__demo-callout[data-p=left]::after { right: -8px; top: var(--ay); border-left: 0; border-bottom: 0; }
    #__demo-title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: radial-gradient(1200px 600px at 50% 40%, #1e3a8a 0%, #0f172a 70%); color: #fff; text-align: center;
      opacity: 0; transition: opacity 600ms ease; }
    #__demo-title.on { opacity: 1; }
    #__demo-title .kicker { font-size: 20px; letter-spacing: .2em; text-transform: uppercase; color: #93c5fd; font-weight: 600; }
    #__demo-title .t { margin-top: 18px; font-size: 64px; font-weight: 800; letter-spacing: -.02em; }
    #__demo-title .s { margin-top: 16px; font-size: 26px; color: #cbd5e1; font-weight: 400; }
    #__demo-chip { position: absolute; left: 50%; bottom: 36px; transform: translateX(-50%) translateY(10px); padding: 10px 22px;
      border-radius: 999px; background: rgba(15,23,42,.9); color: #fff; font-size: 18px; font-weight: 600; opacity: 0;
      transition: all 300ms ease; box-shadow: 0 8px 24px rgba(0,0,0,.3); }
    #__demo-chip.on { opacity: 1; transform: translateX(-50%); }
  `;

  const cursorSvg = `<svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 3 L4 24 L9.5 18.8 L13.2 27 L17 25.3 L13.4 17.3 L21 17.3 Z" fill="#111827" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`;

  let root, cursor, spot, titleEl, chip;
  let pos = { x: 960, y: 540 };
  const callouts = new Map();

  function mount() {
    if (document.getElementById('__demo-root')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = '__demo-root';
    root.innerHTML = `<div id="__demo-spot"></div><div id="__demo-title"></div><div id="__demo-chip"></div><div id="__demo-cursor">${cursorSvg}</div>`;
    document.body.appendChild(root);
    cursor = root.querySelector('#__demo-cursor');
    spot = root.querySelector('#__demo-spot');
    titleEl = root.querySelector('#__demo-title');
    chip = root.querySelector('#__demo-chip');
    place();
  }

  // Next.js may re-render <body>; keep the overlay attached.
  function ensure() {
    if (!document.body) return false;
    if (!document.getElementById('__demo-root')) mount();
    return true;
  }

  function place() {
    cursor.style.left = `${pos.x - 4}px`;
    cursor.style.top = `${pos.y - 3}px`;
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.__demo = {
    setPos(x, y) { ensure(); pos = { x, y }; place(); },

    moveTo(x, y, ms) {
      ensure();
      const from = { ...pos };
      const dx = x - from.x, dy = y - from.y;
      // Slight arc so the motion looks hand-driven rather than robotic.
      const cx = from.x + dx / 2 - dy * 0.12, cy = from.y + dy / 2 + dx * 0.12;
      const start = performance.now();
      return new Promise((resolve) => {
        const tick = (now) => {
          const t = Math.min(1, (now - start) / ms), e = ease(t), u = 1 - e;
          pos = { x: u * u * from.x + 2 * u * e * cx + e * e * x, y: u * u * from.y + 2 * u * e * cy + e * e * y };
          place();
          t < 1 ? requestAnimationFrame(tick) : resolve();
        };
        requestAnimationFrame(tick);
      });
    },

    async press() {
      ensure();
      cursor.classList.add('down');
      const r = document.createElement('div');
      r.className = '__demo-ripple';
      r.style.left = `${pos.x}px`;
      r.style.top = `${pos.y}px`;
      root.insertBefore(r, cursor);
      setTimeout(() => r.remove(), 700);
      await sleep(110);
      cursor.classList.remove('down');
    },

    spotlight(rect, pad = 10) {
      ensure();
      Object.assign(spot.style, {
        left: `${rect.x - pad}px`, top: `${rect.y - pad}px`,
        width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px`,
      });
      spot.classList.add('on');
    },
    clearSpotlight() { ensure(); spot.classList.remove('on'); },

    callout(id, rect, html, placement = 'auto') {
      ensure();
      this.clearCallout(id, true);
      const el = document.createElement('div');
      el.className = '__demo-callout';
      el.innerHTML = html;
      root.insertBefore(el, cursor);
      const w = el.offsetWidth, h = el.offsetHeight, gap = 16, vw = innerWidth, vh = innerHeight;
      let p = placement;
      if (p === 'auto') {
        if (rect.y + rect.height + gap + h < vh - 20) p = 'bottom';
        else if (rect.y - gap - h > 20) p = 'top';
        else if (rect.x + rect.width + gap + w < vw - 20) p = 'right';
        else p = 'left';
      }
      let left, top;
      if (p === 'bottom' || p === 'top') {
        left = Math.max(16, Math.min(vw - w - 16, rect.x + rect.width / 2 - w / 2));
        top = p === 'bottom' ? rect.y + rect.height + gap : rect.y - gap - h;
        el.style.setProperty('--ax', `${Math.max(14, Math.min(w - 28, rect.x + rect.width / 2 - left - 7))}px`);
      } else {
        top = Math.max(16, Math.min(vh - h - 16, rect.y + rect.height / 2 - h / 2));
        left = p === 'right' ? rect.x + rect.width + gap : rect.x - gap - w;
        el.style.setProperty('--ay', `${Math.max(12, Math.min(h - 26, rect.y + rect.height / 2 - top - 7))}px`);
      }
      el.dataset.p = p;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      callouts.set(id, el);
      requestAnimationFrame(() => el.classList.add('on'));
    },
    clearCallout(id, instant = false) {
      const ids = id ? [id] : [...callouts.keys()];
      for (const k of ids) {
        const el = callouts.get(k);
        if (!el) continue;
        callouts.delete(k);
        if (instant) el.remove();
        else { el.classList.remove('on'); setTimeout(() => el.remove(), 300); }
      }
    },

    title(kicker, t, s) {
      ensure();
      titleEl.innerHTML = `<div class="kicker">${kicker}</div><div class="t">${t}</div><div class="s">${s}</div>`;
      titleEl.classList.add('on');
    },
    clearTitle() { ensure(); titleEl.classList.remove('on'); },

    chip(text) { ensure(); chip.textContent = text; chip.classList.add('on'); },
    clearChip() { ensure(); chip.classList.remove('on'); },

    cursorVisible(v) { ensure(); cursor.style.opacity = v ? '1' : '0'; },
  };

  const boot = () => ensure() || requestAnimationFrame(boot);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
  new MutationObserver(() => document.body && !document.getElementById('__demo-root') && mount())
    .observe(document.documentElement, { childList: true, subtree: false });
})();
