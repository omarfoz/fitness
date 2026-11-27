/* "Wear it": a camera filter that hangs your badge or challenge medal around
 * your neck, following your face like a Snapchat lens.
 *
 * - Face tracking: MediaPipe Face Detection (short range), self-hosted in
 *   /vendor/mp-face and loaded only when the filter opens. Everything runs on
 *   the phone; no video leaves it.
 * - Placement: from the eyes and mouth we get the head's position, size and
 *   tilt; the medal hangs below the chin and swings a little when you move.
 * - Capture: a photo (with a small Fitness tag) to save or share.
 * window.FitnessWear.open(items, startIndex)
 *   items: [{ id, title, kind: 'badge' | 'medal', svg, ribbon: [c1, c2] }]
 */
(() => {
  'use strict';
  const VENDOR = '/vendor/mp-face/';
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    flip: '<path d="M4 7h11a5 5 0 0 1 0 10H9"/><path d="m7 4-3 3 3 3"/><path d="m12 20-3-3 3-3"/>',
    save: '<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 19h14"/>',
    share: '<path d="M12 15V4m0 0-4 4m4-4 4 4"/><path d="M6 12v7h12v-7"/>'
  };
  const icon = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  let detector = null, detectorLoading = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = res; s.onerror = () => rej(new Error('Could not load the face filter.'));
      document.head.append(s);
    });
  }
  async function getDetector() {
    if (detector) return detector;
    if (!detectorLoading) detectorLoading = (async () => {
      await loadScript(VENDOR + 'face_detection.js');
      const fd = new window.FaceDetection({ locateFile: (f) => VENDOR + f });
      fd.setOptions({ model: 'short', minDetectionConfidence: 0.55, selfieMode: false });
      await fd.initialize();
      detector = fd;
      return fd;
    })();
    return detectorLoading;
  }

  function svgImage(svg) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('art'));
      const src = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
  }

  let ui = null;
  function build() {
    const el = document.createElement('div');
    el.className = 'wf';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Wear your medal');
    el.innerHTML = `
      <canvas class="wf-canvas" aria-hidden="true"></canvas>
      <video class="wf-video" playsinline muted autoplay></video>
      <div class="wf-top">
        <button type="button" class="wf-round" data-wf="close" aria-label="Close">${icon(ICON.close)}</button>
        <div class="wf-title"><small>WEAR IT</small><strong data-wf="name"></strong></div>
        <button type="button" class="wf-round" data-wf="flip" aria-label="Switch camera">${icon(ICON.flip)}</button>
      </div>
      <p class="wf-status" data-wf="status" role="status" aria-live="polite">Getting the filter ready…</p>
      <div class="wf-bottom">
        <div class="wf-strip" data-wf="strip" role="radiogroup" aria-label="Choose a medal"></div>
        <button type="button" class="wf-shutter" data-wf="shot" aria-label="Take photo"><i></i></button>
      </div>
      <div class="wf-preview" data-wf="preview" hidden>
        <img alt="Your photo with the medal" data-wf="photo">
        <div class="wf-preview-actions">
          <button type="button" class="button subtle" data-wf="retake">Retake</button>
          <button type="button" class="button subtle" data-wf="save">${icon(ICON.save)} Save</button>
          <button type="button" class="button primary" data-wf="share">${icon(ICON.share)} Share</button>
        </div>
      </div>`;
    document.body.append(el);
    const q = (k) => el.querySelector(`[data-wf="${k}"]`);
    return { el, q, canvas: el.querySelector('.wf-canvas'), video: el.querySelector('.wf-video') };
  }

  async function open(items, start = 0) {
    if (!items?.length) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Your browser does not allow camera access here. Open Fitness in Safari or Chrome and try again.');
      return;
    }
    ui?.el.remove();
    ui = build();
    const { el, q, canvas, video } = ui;
    const g = canvas.getContext('2d');
    document.documentElement.classList.add('wf-open');

    let index = Math.max(0, Math.min(items.length - 1, start));
    let facing = 'user', stream = null, running = true, raf = 0, busy = false;
    let art = null, artFor = -1;
    // pose: smoothed head position in canvas pixels
    let pose = null, target = null, lastSeen = 0, alpha = 0;
    let sway = 0, swayV = 0, lastX = null;
    let photoBlob = null;

    const status = (t) => { q('status').textContent = t || ''; q('status').hidden = !t; };

    async function loadArt() {
      const it = items[index];
      q('name').textContent = it.title;
      q('strip').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-checked', String(i === index)));
      try { art = await svgImage(it.svg); artFor = index; } catch (_) { art = null; }
    }
    q('strip').innerHTML = items.map((it, i) => `<button type="button" role="radio" aria-checked="${i === index}" aria-label="${esc(it.title)}" data-i="${i}">${it.svg}</button>`).join('');
    q('strip').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      index = Number(b.dataset.i); loadArt();
      b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });

    async function startCamera() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        // Ask for the camera in the same orientation as the screen, so nothing is cropped away.
        video: innerHeight >= innerWidth
          ? { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 } }
          : { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      await new Promise((r) => (video.readyState >= 2 ? r() : video.addEventListener('loadeddata', r, { once: true })));
    }

    function close() {
      running = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      el.remove();
      document.documentElement.classList.remove('wf-open');
      document.removeEventListener('keydown', onKey);
      ui = null;
    }
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    q('close').addEventListener('click', close);
    q('flip').addEventListener('click', async () => {
      facing = facing === 'user' ? 'environment' : 'user';
      pose = target = null;
      try { await startCamera(); } catch (_) { facing = 'user'; }
    });

    function onResults(res) {
      const d = res.detections?.[0];
      if (!d) return;
      const w = canvas.width, h = canvas.height, mirror = facing === 'user';
      const P = (i) => { const p = d.landmarks[i]; return { x: (mirror ? 1 - p.x : p.x) * w, y: p.y * h }; };
      let re = P(0), le = P(1); const mouth = P(3);
      if (re.x > le.x) [re, le] = [le, re];
      const roll = Math.atan2(le.y - re.y, le.x - re.x);
      const eyes = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 };
      const faceW = d.boundingBox.width * w;
      const down = { x: -Math.sin(roll), y: Math.cos(roll) };
      const em = Math.hypot(mouth.x - eyes.x, mouth.y - eyes.y);
      const chin = { x: mouth.x + down.x * em * 0.95, y: mouth.y + down.y * em * 0.95 };
      target = { x: chin.x, y: chin.y, roll, faceW, down };
      lastSeen = performance.now();
    }

    function drawRibbonAndCoin(cx, cy, size, it, neck, down, roll) {
      const across = { x: Math.cos(roll), y: Math.sin(roll) };
      const half = size * 0.5, strap = size * 0.2;
      const topL = { x: neck.x - across.x * half * 1.25, y: neck.y - across.y * half * 1.25 };
      const topR = { x: neck.x + across.x * half * 1.25, y: neck.y + across.y * half * 1.25 };
      const ring = { x: cx - down.x * half * 1.02, y: cy - down.y * half * 1.02 };
      const [c1, c2] = it.ribbon || ['#E0461A', '#FF9A5C'];
      const band = (a, b2) => {
        const ax = { x: -across.x * strap / 2, y: -across.y * strap / 2 };
        g.beginPath();
        g.moveTo(a.x + ax.x, a.y + ax.y); g.lineTo(a.x - ax.x, a.y - ax.y);
        g.lineTo(b2.x - ax.x * .55, b2.y - ax.y * .55); g.lineTo(b2.x + ax.x * .55, b2.y + ax.y * .55); g.closePath();
        const gr = g.createLinearGradient(a.x, a.y, b2.x, b2.y);
        gr.addColorStop(0, c1); gr.addColorStop(1, c2);
        g.fillStyle = gr; g.fill();
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, size * 0.012);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b2.x, b2.y); g.stroke();
      };
      band(topL, ring); band(topR, ring);
      g.beginPath(); g.arc(ring.x, ring.y, size * 0.06, 0, Math.PI * 2);
      g.lineWidth = size * 0.03; g.strokeStyle = '#E8C77A'; g.stroke();
    }

    function draw() {
      if (!running) return;
      raf = requestAnimationFrame(draw);
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw) return;
      if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
      const mirror = facing === 'user';
      g.save();
      if (mirror) { g.translate(vw, 0); g.scale(-1, 1); }
      g.drawImage(video, 0, 0, vw, vh);
      g.restore();

      const now = performance.now();
      const seen = target && now - lastSeen < 700;
      alpha += ((seen ? 1 : 0) - alpha) * 0.18;
      if (target) {
        if (!pose) pose = { ...target };
        const k = 0.38;
        pose.x += (target.x - pose.x) * k; pose.y += (target.y - pose.y) * k;
        pose.roll += (target.roll - pose.roll) * k; pose.faceW += (target.faceW - pose.faceW) * k;
        pose.down = { x: -Math.sin(pose.roll), y: Math.cos(pose.roll) };
        // pendulum: sideways head movement swings the medal
        if (!reduce()) {
          const vx = lastX == null ? 0 : (pose.x - lastX) / pose.faceW;
          lastX = pose.x;
          swayV += -sway * 0.07 - vx * 0.5; swayV *= 0.86; sway += swayV;
          sway = Math.max(-0.3, Math.min(0.3, sway));
        }
      }
      status(!art ? 'Loading the medal…' : alpha < 0.2 ? (facing === 'user' ? 'Show your face to the camera' : 'Point the camera at a face') : '');
      if (pose && art && alpha > 0.02) {
        const it = items[artFor] || items[index];
        const fw = pose.faceW, d = pose.down, ang = pose.roll + sway;
        const dd = { x: -Math.sin(ang), y: Math.cos(ang) };
        const neck = { x: pose.x + d.x * fw * 0.32, y: pose.y + d.y * fw * 0.32 };
        g.save();
        g.globalAlpha = Math.min(1, alpha);
        g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = fw * 0.08; g.shadowOffsetY = fw * 0.03;
        if (it.kind === 'medal') {
          // The challenge medal carries its own ribbon: hang its top from the neck.
          const wImg = fw * 1.05, hImg = wImg * (art.height / art.width || 1.25);
          g.translate(neck.x, neck.y); g.rotate(ang);
          g.drawImage(art, -wImg / 2, -hImg * 0.06, wImg, hImg);
        } else {
          const size = fw * 0.72;
          const strapTop = { x: neck.x + d.x * fw * 0.12, y: neck.y + d.y * fw * 0.12 };  // collarbones, below the chin
          const cx = strapTop.x + dd.x * fw * 0.78, cy = strapTop.y + dd.y * fw * 0.78;
          g.shadowColor = 'transparent';
          drawRibbonAndCoin(cx, cy, size, it, strapTop, dd, ang);
          g.shadowColor = 'rgba(0,0,0,.45)';
          g.translate(cx, cy); g.rotate(ang);
          const hImg = size * (art.height / art.width || 1.08);
          g.drawImage(art, -size / 2, -size * (116 / 240), size, hImg);
        }
        g.restore();
      }
    }

    async function detectLoop(fd) {
      while (running) {
        if (video.readyState >= 2 && !busy && q('preview').hidden) {
          busy = true;
          try { await fd.send({ image: video }); } catch (_) {}
          busy = false;
        }
        await new Promise((r) => setTimeout(r, 30));
      }
    }

    // capture
    q('shot').addEventListener('click', async () => {
      if (!canvas.width) return;
      // Save exactly what is on screen: the canvas is shown with object-fit: cover.
      const cw = canvas.clientWidth || canvas.width, chh = canvas.clientHeight || canvas.height;
      const sc = Math.max(cw / canvas.width, chh / canvas.height);
      const vwid = Math.round(cw / sc), vhei = Math.round(chh / sc);
      const sx = Math.round((canvas.width - vwid) / 2), sy = Math.round((canvas.height - vhei) / 2);
      const out = document.createElement('canvas');
      out.width = vwid; out.height = vhei;
      const o = out.getContext('2d');
      o.drawImage(canvas, sx, sy, vwid, vhei, 0, 0, vwid, vhei);
      const s = out.width / 720, pad = 22 * s;
      const label = `Fitness  ·  ${items[index].title}`;
      o.font = `700 ${Math.round(24 * s)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;
      const tw = o.measureText(label).width, bh = 50 * s, bw = tw + 40 * s;
      const bx = (out.width - bw) / 2, by = out.height - bh - pad;
      o.fillStyle = 'rgba(14,15,18,.72)';
      o.beginPath(); o.roundRect ? o.roundRect(bx, by, bw, bh, bh / 2) : o.rect(bx, by, bw, bh); o.fill();
      o.fillStyle = '#FFB27A'; o.textBaseline = 'middle'; o.fillText(label, bx + 20 * s, by + bh / 2 + 1);
      photoBlob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92));
      q('photo').src = URL.createObjectURL(photoBlob);
      q('preview').hidden = false;
      el.classList.add('is-preview');
    });
    q('retake').addEventListener('click', () => {
      q('preview').hidden = true; el.classList.remove('is-preview');
      URL.revokeObjectURL(q('photo').src);
    });
    const fileName = () => `fitness-${items[index].id}.jpg`;
    q('save').addEventListener('click', () => {
      if (!photoBlob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(photoBlob); a.download = fileName();
      document.body.append(a); a.click(); a.remove();
    });
    q('share').addEventListener('click', async () => {
      if (!photoBlob) return;
      const file = new File([photoBlob], fileName(), { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: items[index].title }); } catch (_) {}
      } else q('save').click();
    });

    // start
    await loadArt();
    try {
      await startCamera();
    } catch (e) {
      status(e?.name === 'NotAllowedError'
        ? 'Camera access is off. Allow the camera for this site in Settings, then try again.'
        : 'Could not open the camera.');
      q('shot').disabled = true;
      return;
    }
    raf = requestAnimationFrame(draw);
    try {
      const fd = await getDetector();
      if (!running) return;
      fd.onResults(onResults);
      detectLoop(fd);
    } catch (_) {
      status('The face filter could not load. Check your connection and try again.');
    }
  }

  window.FitnessWear = Object.freeze({ open });
})();
