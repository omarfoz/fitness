/* 3D badge: the badge becomes a thick coin you can spin with a finger.
 * - Opens with a spin-in.
 * - Drag to turn it (with momentum); it slows down and settles on a face.
 * - Tap to flip; the back shows the badge name and the date it was earned.
 * - Light sweeps across the face as it turns; the floor shadow narrows side-on.
 * Pure CSS 3D transforms + requestAnimationFrame, no library.
 * window.FitnessBadge3D.mount(container, badge, { size }) → { destroy } */
(() => {
  'use strict';
  const VB_W = 240, VB_H = 260, CX = 120, CY = 116, R = 101; // badge geometry from badges.js
  const LAYERS = 24, THICK = 16; // edge layers and coin thickness in px at size 220
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
  }

  function backSvg(b, t, size) {
    const B = window.FitnessBadges;
    const date = b.earnedOn
      ? new Date(b.earnedOn + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
      : 'KEEP WALKING';
    const words = String(b.title).toUpperCase().split(' ');
    const lines = [];
    for (const w of words) {
      const last = lines[lines.length - 1];
      if (last && (last + ' ' + w).length <= 12) lines[lines.length - 1] = last + ' ' + w; else lines.push(w);
    }
    const ty = CY - (lines.length - 1) * 11 - 4;
    return `<svg viewBox="0 0 ${VB_W} ${VB_H}" width="${size}" height="${Math.round(size * VB_H / VB_W)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><radialGradient id="b3b" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></radialGradient></defs>
  <polygon points="${B.rim(CX, CY, R, 113, 28)}" fill="${t.rim}"/>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="${t.rim}"/>
  <circle cx="${CX}" cy="${CY}" r="96" fill="url(#b3b)"/>
  <circle cx="${CX}" cy="${CY}" r="84" fill="none" stroke="${t.ring}" stroke-width="2" stroke-dasharray="2 5" opacity=".8"/>
  <circle cx="${CX}" cy="${CY}" r="76" fill="${shade(t.b, .78)}" opacity=".55"/>
  <g fill="${t.ring}"><path d="M120 46 l4 9 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1 Z"/></g>
  <g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" text-anchor="middle" fill="#fff">
    ${lines.map((l, i) => `<text x="${CX}" y="${ty + i * 22}" font-size="${l.length > 10 ? 17 : 19}" font-weight="800" letter-spacing="1">${esc(l)}</text>`).join('')}
    <text x="${CX}" y="${ty + lines.length * 22 + 8}" font-size="11" font-weight="700" letter-spacing="2" opacity=".85">${esc(date)}</text>
    <text x="${CX}" y="170" font-size="9" font-weight="800" letter-spacing="3" opacity=".7">${esc(t.name.toUpperCase())} · FITNESS</text>
  </g>
</svg>`;
  }

  function mount(host, badge, opts = {}) {
    const B = window.FitnessBadges;
    const t = B.TIERS[badge.tier];
    const size = opts.size || 220;
    const s = size / VB_W, h = Math.round(size * VB_H / VB_W);
    const thick = THICK * s / (220 / VB_W);
    const d = R * 2 * s;

    host.innerHTML = `
      <div class="b3-stage" style="width:${size}px;height:${h + 26}px">
        <div class="b3-coin" style="width:${size}px;height:${h}px;transform-origin:${CX * s}px ${CY * s}px" tabindex="0" role="img"
             aria-label="${esc(badge.title)} badge. Drag to spin, tap to flip.">
          <div class="b3-edge"></div>
          <div class="b3-face b3-front">${B.svg(badge, { size, flat: true })}<i class="b3-shine" style="left:${(CX - R) * s}px;top:${(CY - R) * s}px;width:${d}px;height:${d}px"></i></div>
          <div class="b3-face b3-back">${backSvg(badge, t, size)}</div>
        </div>
        <div class="b3-shadow" style="width:${size * .6}px"></div>
        <span class="b3-hint">Drag to spin · tap to flip</span>
      </div>`;
    const stage = host.querySelector('.b3-stage');
    const coin = host.querySelector('.b3-coin');
    const edge = host.querySelector('.b3-edge');
    const shine = host.querySelector('.b3-shine');
    const shadow = host.querySelector('.b3-shadow');
    const hint = host.querySelector('.b3-hint');

    // Edge: stacked discs between the two faces.
    const edgeLight = shade(t.rim, 1.35), edgeDark = shade(t.rim, .7);
    let layers = '';
    for (let i = 0; i < LAYERS; i++) {
      const z = -thick / 2 + (thick * i) / (LAYERS - 1);
      const mid = 1 - Math.abs(i - (LAYERS - 1) / 2) / ((LAYERS - 1) / 2);
      layers += `<i style="left:${(CX - R) * s}px;top:${(CY - R) * s}px;width:${d}px;height:${d}px;transform:translateZ(${z.toFixed(2)}px);background:${i % 3 === 1 ? edgeLight : mid > .5 ? t.rim : edgeDark}"></i>`;
    }
    edge.innerHTML = layers;
    host.querySelector('.b3-front').style.transform = `translateZ(${(thick / 2 + .5).toFixed(2)}px)`;
    host.querySelector('.b3-back').style.transform = `rotateY(180deg) translateZ(${(thick / 2 + .5).toFixed(2)}px)`;

    let ry = 0, rx = 0, vy = 0, vx = 0, target = 0, raf = 0, scale = 1;
    let dragging = false, moved = 0, lastX = 0, lastY = 0, lastT = 0, used = false;

    function draw() {
      coin.style.transform = `scale(${scale.toFixed(3)}) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      const rad = ry * Math.PI / 180;
      const facing = Math.cos(rad);
      shine.style.backgroundPosition = `${(50 - Math.sin(rad) * 120).toFixed(1)}% 50%`;
      shine.style.opacity = (0.25 + Math.abs(Math.sin(rad)) * 0.75).toFixed(2);
      shadow.style.transform = `translateX(-50%) scaleX(${(0.25 + Math.abs(facing) * 0.75).toFixed(3)}) scale(${scale.toFixed(3)})`;
    }

    function settle() {
      cancelAnimationFrame(raf);
      const step = () => {
        if (dragging) return;
        if (Math.abs(vy) > 1.2) {                // free spin with friction
          ry += vy; vy *= 0.955;
          target = Math.round(ry / 180) * 180;
        } else {                                  // spring to the nearest face
          vy += (target - ry) * 0.07; vy *= 0.78; ry += vy;
        }
        vx += -rx * 0.08; vx *= 0.8; rx += vx;
        draw();
        if (Math.abs(target - ry) < 0.05 && Math.abs(vy) < 0.05 && Math.abs(rx) < 0.05) {
          ry = target; rx = 0; draw(); return;
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    function intro() {
      if (reduce()) { draw(); return; }
      const t0 = performance.now(), dur = 1500, from = -720;
      const ease = (x) => 1 - Math.pow(1 - x, 4);
      const step = (now) => {
        if (dragging) return;
        const p = Math.min(1, (now - t0) / dur), e = ease(p);
        ry = from * (1 - e);
        scale = 0.45 + 0.55 * ease(Math.min(1, p * 1.4)) + Math.sin(Math.min(1, p * 1.4) * Math.PI) * 0.06;
        rx = Math.sin(p * Math.PI) * -12;
        draw();
        if (p < 1) raf = requestAnimationFrame(step); else { ry = 0; rx = 0; scale = 1; draw(); }
      };
      raf = requestAnimationFrame(step);
    }

    const down = (e) => {
      dragging = true; moved = 0; vy = 0; vx = 0;
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      cancelAnimationFrame(raf); scale = 1;
      coin.setPointerCapture?.(e.pointerId);
      stage.classList.add('is-grabbing');
    };
    const move = (e) => {
      if (!dragging) return;
      const now = performance.now(), dt = Math.max(8, now - lastT);
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      ry += dx * 0.75;
      rx = Math.max(-28, Math.min(28, rx - dy * 0.35));
      vy = (dx * 0.75) * (16 / dt);
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      draw();
      if (!used && moved > 12) { used = true; hint.classList.add('is-gone'); }
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-grabbing');
      if (performance.now() - lastT > 90) vy = 0;    // held still before letting go
      if (moved < 6) {                              // tap = flip
        target = Math.round(ry / 180) * 180 + 180; vy = 0;
        used = true; hint.classList.add('is-gone');
      } else {
        vy = Math.max(-40, Math.min(40, vy));
        target = Math.round(ry / 180) * 180;
      }
      settle();
    };
    const key = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); target = Math.round(ry / 180) * 180 + (e.key === 'ArrowRight' ? 180 : -180); vy = 0; settle();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); target = Math.round(ry / 180) * 180 + 180; vy = 0; settle();
      }
    };
    coin.addEventListener('pointerdown', down);
    coin.addEventListener('pointermove', move);
    coin.addEventListener('pointerup', up);
    coin.addEventListener('pointercancel', up);
    coin.addEventListener('lostpointercapture', up);
    coin.addEventListener('keydown', key);

    draw();
    intro();
    return {
      destroy() { cancelAnimationFrame(raf); dragging = false; host.innerHTML = ''; },
      spin(v = 24) { vy = v; settle(); }
    };
  }

  window.FitnessBadge3D = Object.freeze({ mount });
})();
