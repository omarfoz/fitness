/* "Wear it": put your medal or badge on a photo yourself, then save it as an
 * animated GIF (the medal swings and shines) or a still photo.
 *
 * 1. Take a photo or choose one from Photos (plain file inputs: no live camera).
 * 2. Place the medal: drag with one finger; pinch with two to resize and rotate.
 *    The size slider and the strip of earned medals sit under the photo.
 * 3. Save GIF (gifenc, self-hosted, loaded only then) or Save photo.
 * Everything stays on the phone.
 * window.FitnessWear.open(items, startIndex)
 *   items: [{ id, title, kind: 'badge' | 'medal', svg, ribbon: [c1, c2] }]
 */
(() => {
  'use strict';
  const GIFENC = '/vendor/gifenc-1.0.3.esm.js';
  const MAX_SIDE = 1280;            // photos are scaled down to this on load
  const GIF_W = 480, GIF_FRAMES = 24, GIF_DELAY = 70;  // ~1.7 s loop
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    photos: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
    gif: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9.5 10.2A2 2 0 1 0 9.5 14h.7v-1.6M13 10v4M16 14v-4h2.2M16 12h1.6"/>',
    still: '<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 19h14"/>',
    change: '<path d="M4 7h11a5 5 0 0 1 0 10H9"/><path d="m7 4-3 3 3 3"/>'
  };

  function svgImage(svg) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('art'));
      const src = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
  }
  function loadPhoto(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);   // Safari applies the photo's rotation
        URL.revokeObjectURL(url);
        res(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('photo')); };
      img.src = url;
    });
  }

  /* Draw the photo and the medal. m: { x, y } = where the ribbon meets the neck
   * (fractions of the photo), w = medal width (fraction of photo width), rot (rad).
   * swing (rad) and shine (0..1, outside = none) animate the GIF. */
  function render(g, W, H, photo, art, it, m, swing = 0, shine = -1) {
    g.drawImage(photo, 0, 0, W, H);
    if (!art) return;
    const size = m.w * W, ax = m.x * W, ay = m.y * H, ang = m.rot + swing;
    g.save();
    g.translate(ax, ay); g.rotate(ang);
    g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = size * 0.09; g.shadowOffsetY = size * 0.04;
    let face; // the coin's centre and radius in local space, for the shine
    if (it.kind === 'medal') {
      // Challenge medals carry their own Sadu ribbon: its top is the anchor.
      const h = size * (art.height / art.width || 1.25);
      g.drawImage(art, -size / 2, 0, size, h);
      face = { x: 0, y: h * 0.64, r: size * 0.36 };
    } else {
      // Badges: two straps from the anchor to a ring on top of the coin.
      const drop = size * 0.95, half = size * 0.62, strap = size * 0.2;
      const [c1, c2] = it.ribbon || ['#E0461A', '#FF9A5C'];
      g.shadowColor = 'transparent';
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.moveTo(sx * half - strap / 2, -size * 0.05); g.lineTo(sx * half + strap / 2, -size * 0.05);
        g.lineTo(sx * strap * 0.28, drop - size * 0.5); g.lineTo(-sx * strap * 0.28, drop - size * 0.5); g.closePath();
        const gr = g.createLinearGradient(0, 0, 0, drop); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
        g.fillStyle = gr; g.fill();
      }
      g.beginPath(); g.arc(0, drop - size * 0.5, size * 0.06, 0, Math.PI * 2);
      g.lineWidth = size * 0.03; g.strokeStyle = '#E8C77A'; g.stroke();
      g.shadowColor = 'rgba(0,0,0,.4)';
      const h = size * (art.height / art.width || 1.08);
      g.drawImage(art, -size / 2, drop - size * (116 / 240), size, h);
      face = { x: 0, y: drop, r: size * 0.42 };
    }
    if (shine >= 0 && shine <= 1) {   // a light streak sweeping across the coin
      g.shadowColor = 'transparent';
      g.save();
      g.beginPath(); g.arc(face.x, face.y, face.r, 0, Math.PI * 2); g.clip();
      const sx = face.x - face.r * 1.6 + shine * face.r * 3.2;
      const gr = g.createLinearGradient(sx - face.r * 0.35, 0, sx + face.r * 0.35, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr; g.fillRect(face.x - face.r, face.y - face.r, face.r * 2, face.r * 2);
      g.restore();
    }
    g.restore();
  }

  let ui = null;
  async function open(items, start = 0) {
    if (!items?.length) return;
    ui?.close?.();
    const el = document.createElement('div');
    el.className = 'wf';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Wear your medal');
    el.innerHTML = `
      <div class="wf-top">
        <button type="button" class="wf-round" data-wf="close" aria-label="Close">${icon(I.close)}</button>
        <div class="wf-title"><small>WEAR IT</small><strong data-wf="name"></strong></div>
        <button type="button" class="wf-round" data-wf="change" aria-label="Change photo" hidden>${icon(I.change)}</button>
      </div>
      <div class="wf-pick" data-wf="pick">
        <div class="wf-pick-art" data-wf="pickArt" aria-hidden="true"></div>
        <h2>Put your medal on a photo</h2>
        <p>Take a selfie or pick a photo, then drag the medal where you want it. Pinch to resize and turn it.</p>
        <label class="button primary wf-pick-btn">${icon(I.camera)} Take a photo<input type="file" accept="image/*" capture="user" data-wf="cam" hidden></label>
        <label class="button subtle wf-pick-btn">${icon(I.photos)} Choose from Photos<input type="file" accept="image/*" data-wf="lib" hidden></label>
      </div>
      <div class="wf-stage" data-wf="stage" hidden>
        <canvas class="wf-canvas" data-wf="canvas" aria-label="Your photo with the medal. Drag to move, pinch to resize."></canvas>
      </div>
      <div class="wf-bottom" data-wf="tools" hidden>
        <p class="wf-hint">Drag to move · pinch to resize and turn</p>
        <label class="wf-size"><span>Size</span><input type="range" min="0.12" max="0.8" step="0.01" data-wf="size" aria-label="Medal size"></label>
        <div class="wf-strip" data-wf="strip" role="radiogroup" aria-label="Choose a medal"></div>
        <div class="wf-actions">
          <button type="button" class="button subtle" data-wf="still">${icon(I.still)} Photo</button>
          <button type="button" class="button primary" data-wf="gif">${icon(I.gif)} Save GIF</button>
        </div>
        <p class="wf-status" data-wf="status" role="status" aria-live="polite"></p>
      </div>
      <div class="wf-preview" data-wf="preview" hidden>
        <img alt="Your medal photo" data-wf="out">
        <div class="wf-preview-actions">
          <button type="button" class="button subtle" data-wf="back">Edit</button>
          <button type="button" class="button primary" data-wf="share">Save or share</button>
        </div>
      </div>`;
    document.body.append(el);
    document.documentElement.classList.add('wf-open');
    const q = (k) => el.querySelector(`[data-wf="${k}"]`);
    const canvas = q('canvas'), g = canvas.getContext('2d');

    let index = Math.max(0, Math.min(items.length - 1, start));
    let art = null, photo = null, raf = 0, outBlob = null, outName = '';
    const m = { x: 0.5, y: 0.55, w: 0.34, rot: 0 };
    const t0 = performance.now();

    const status = (t) => { q('status').textContent = t || ''; };
    async function setItem(i) {
      index = i;
      const it = items[index];
      q('name').textContent = it.title;
      q('strip').querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-checked', String(j === index)));
      try { art = await svgImage(it.svg); } catch (_) { art = null; }
    }
    q('strip').innerHTML = items.map((it, i) => `<button type="button" role="radio" aria-checked="false" aria-label="${esc(it.title)}" data-i="${i}">${it.svg}</button>`).join('');
    q('strip').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) setItem(Number(b.dataset.i)); });
    q('pickArt').innerHTML = items[index].svg;

    function fitCanvas() {
      if (!photo) return;
      const box = q('stage').getBoundingClientRect();
      const s = Math.min(box.width / photo.width, box.height / photo.height);
      canvas.style.width = Math.round(photo.width * s) + 'px';
      canvas.style.height = Math.round(photo.height * s) + 'px';
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(photo.width * s * dpr); canvas.height = Math.round(photo.height * s * dpr);
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!photo || !canvas.width) return;
      const t = (now - t0) / 1000;
      const swing = reduce() ? 0 : Math.sin(t * Math.PI * 2 / 1.7) * 0.07;
      const shine = reduce() ? -1 : ((t % 2.4) / 1.2) - 0.1;
      render(g, canvas.width, canvas.height, photo, art, items[index], m, swing, shine);
    }

    async function usePhoto(file) {
      if (!file) return;
      status('');
      try { photo = await loadPhoto(file); } catch (_) { alert('Could not open that photo. Try another one.'); return; }
      // start on the chest: centred, a bit below the middle, sized to the photo
      const w = photo.width > photo.height ? 0.2 : 0.32;
      const medalH = w * (photo.width / photo.height) * (items[index].kind === 'medal' ? 1.3 : 1.55);
      Object.assign(m, { x: 0.5, y: Math.max(0.15, Math.min(0.5, 0.97 - medalH)), w, rot: 0 });
      q('size').value = String(m.w);
      q('pick').hidden = true; q('stage').hidden = false; q('tools').hidden = false; q('change').hidden = false;
      requestAnimationFrame(fitCanvas);
    }
    q('cam').addEventListener('change', (e) => { usePhoto(e.target.files?.[0]); e.target.value = ''; });
    q('lib').addEventListener('change', (e) => { usePhoto(e.target.files?.[0]); e.target.value = ''; });
    q('change').addEventListener('click', () => { q('pick').hidden = false; q('stage').hidden = true; q('tools').hidden = true; q('change').hidden = true; });
    q('size').addEventListener('input', (e) => { m.w = Number(e.target.value); });
    window.addEventListener('resize', fitCanvas);

    /* gestures: one finger moves the medal, two fingers resize and rotate it */
    const pts = new Map();
    let base = null;
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, local(e));
      base = null;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = local(e);
      pts.set(e.pointerId, cur);
      if (pts.size === 1) {
        m.x = Math.min(1, Math.max(0, m.x + cur.x - prev.x));
        m.y = Math.min(1, Math.max(-0.2, m.y + cur.y - prev.y));
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const ar = canvas.height / canvas.width;
        const dist = Math.hypot(b.x - a.x, (b.y - a.y) * ar), ang = Math.atan2((b.y - a.y) * ar, b.x - a.x);
        if (!base) base = { dist, ang, w: m.w, rot: m.rot };
        m.w = Math.min(0.9, Math.max(0.08, base.w * dist / (base.dist || dist)));
        m.rot = base.rot + (ang - base.ang);
        q('size').value = String(m.w);
      }
    });
    const up = (e) => { pts.delete(e.pointerId); base = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); m.w = Math.min(0.9, Math.max(0.08, m.w * (e.deltaY < 0 ? 1.06 : 0.94))); q('size').value = String(m.w); }, { passive: false });

    /* export */
    function exportCanvas(width) {
      const c = document.createElement('canvas');
      c.width = width; c.height = Math.round(width * photo.height / photo.width);
      return c;
    }
    function tag(gx, c) {
      const s = c.width / 480, pad = 12 * s, label = `Fitness · ${items[index].title}`;
      gx.font = `700 ${Math.round(15 * s)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;
      const tw = gx.measureText(label).width, bh = 30 * s, bw = tw + 24 * s;
      gx.fillStyle = 'rgba(14,15,18,.72)';
      gx.beginPath(); if (gx.roundRect) gx.roundRect(pad, pad, bw, bh, bh / 2); else gx.rect(pad, pad, bw, bh); gx.fill();
      gx.fillStyle = '#FFB27A'; gx.textBaseline = 'middle'; gx.fillText(label, pad + 12 * s, pad + bh / 2 + 1);
    }
    function showOut(blob, name) {
      outBlob = blob; outName = name;
      q('out').src = URL.createObjectURL(blob);
      q('preview').hidden = false;
    }
    q('still').addEventListener('click', async () => {
      if (!photo) return;
      const c = exportCanvas(Math.min(1080, photo.width)), gx = c.getContext('2d');
      render(gx, c.width, c.height, photo, art, items[index], m, 0, 0.45);
      tag(gx, c);
      showOut(await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92)), `fitness-${items[index].id}.jpg`);
    });
    q('gif').addEventListener('click', async () => {
      if (!photo || q('gif').disabled) return;
      q('gif').disabled = true; status('Making your GIF…');
      try {
        const { GIFEncoder, quantize, applyPalette } = await import(GIFENC);
        const c = exportCanvas(GIF_W), gx = c.getContext('2d', { willReadFrequently: true });
        const frames = [];
        for (let i = 0; i < GIF_FRAMES; i++) {
          const p = i / GIF_FRAMES;
          render(gx, c.width, c.height, photo, art, items[index], m, Math.sin(p * Math.PI * 2) * 0.07, p * 1.4 - 0.2);
          tag(gx, c);
          frames.push(gx.getImageData(0, 0, c.width, c.height).data);
          if (i % 6 === 5) { status(`Making your GIF… ${Math.round((i + 1) / GIF_FRAMES * 60)}%`); await new Promise((r) => setTimeout(r)); }
        }
        // one palette for every frame (no flicker), sampled from a plain and a shiny frame
        const mid = frames[Math.round(GIF_FRAMES * 0.45)];
        const sample = new Uint8Array(frames[0].length + mid.length);
        sample.set(frames[0]); sample.set(mid, frames[0].length);
        // 255 real colours + one transparent slot. After the first frame only the
        // pixels that changed (the swinging medal) are stored; the rest are
        // transparent and show the frame before, which keeps the file small.
        const palette = quantize(sample, 255);
        const T = palette.length;
        const full = palette.concat([[0, 0, 0]]);
        const gif = GIFEncoder();
        let prev = null;
        for (let i = 0; i < frames.length; i++) {
          const idx = applyPalette(frames[i], palette);
          if (!prev) {
            gif.writeFrame(idx, c.width, c.height, { palette: full, delay: GIF_DELAY, repeat: 0, dispose: 1 });
          } else {
            const out = new Uint8Array(idx.length);
            for (let k = 0; k < idx.length; k++) out[k] = idx[k] === prev[k] ? T : idx[k];
            gif.writeFrame(out, c.width, c.height, { delay: GIF_DELAY, transparent: true, transparentIndex: T, dispose: 1 });
          }
          prev = idx;
          if (i % 6 === 5) { status(`Making your GIF… ${60 + Math.round((i + 1) / frames.length * 40)}%`); await new Promise((r) => setTimeout(r)); }
        }
        gif.finish();
        status('');
        showOut(new Blob([gif.bytes()], { type: 'image/gif' }), `fitness-${items[index].id}.gif`);
      } catch (err) {
        status('Could not make the GIF. Try again, or save a photo.');
      } finally { q('gif').disabled = false; }
    });
    q('back').addEventListener('click', () => { q('preview').hidden = true; URL.revokeObjectURL(q('out').src); });
    q('share').addEventListener('click', async () => {
      if (!outBlob) return;
      const file = new File([outBlob], outName, { type: outBlob.type });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: items[index].title }); return; } catch (e) { if (e?.name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(outBlob); a.download = outName;
      document.body.append(a); a.click(); a.remove();
    });

    function close() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fitCanvas);
      document.removeEventListener('keydown', onKey);
      el.remove(); document.documentElement.classList.remove('wf-open');
      ui = null;
    }
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    q('close').addEventListener('click', close);
    ui = { close };

    await setItem(index);
    raf = requestAnimationFrame(loop);
  }

  window.FitnessWear = Object.freeze({ open });
})();
