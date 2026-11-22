/* Monthly challenge medals: a finisher's medal, deliberately unlike the
 * round badges. A Sadu-woven neck ribbon, an eight-pointed Najdi star in
 * the tier's metal, the month's landmark embossed in one tone, and the
 * challenge name engraved around the rim.
 */
(() => {
  'use strict';
  const METALS = {
    bronze: { hi: '#F6C79A', mid: '#C98A52', lo: '#7A4A22', ink: '#5A3415' },
    silver: { hi: '#FFFFFF', mid: '#C9D5E6', lo: '#7F93B0', ink: '#3E4E66' },
    gold: { hi: '#FFF1B8', mid: '#E6B53A', lo: '#9A6B08', ink: '#5E4005' }
  };
  let uid = 0;
  const star = (cx, cy, R, r) => {
    const p = [];
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * i) / 8 - Math.PI / 2, rad = i % 2 ? r : R;
      p.push((cx + rad * Math.cos(a)).toFixed(1) + ',' + (cy + rad * Math.sin(a)).toFixed(1));
    }
    return p.join(' ');
  };
  function svg(ch, tier = 'gold', opts = {}) {
    const m = METALS[tier], id = 'cm' + (++uid), size = opts.size || 240, locked = !!opts.locked;
    const art = window.FitnessRecap?.svg?.(ch.art, ch.place) || '';
    const inner = art.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const ring = `${ch.title.toUpperCase()}  •  ${ch.month.toUpperCase()} ${ch.year}  •  EVERYONE WINS  •`;
    return `<svg viewBox="0 0 240 300" width="${size}" height="${Math.round(size * 300 / 240)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${ch.title} ${tier} medal${locked ? ', not yet won' : ''}">
  <defs>
    <pattern id="${id}p" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#8E1F1A"/>
      <path d="M0 16 L8 6 L16 16 Z" fill="#F4E9D8"/><path d="M4 16 L8 11 L12 16 Z" fill="#1E1410"/>
      <rect y="0" width="16" height="3" fill="#1E1410"/>
    </pattern>
    <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".45" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
    <linearGradient id="${id}r" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
    <filter id="${id}e" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 1 0"/>
      <feComponentTransfer><feFuncR type="table" tableValues="${hex(m.lo, 0)} ${hex(m.hi, 0)}"/><feFuncG type="table" tableValues="${hex(m.lo, 1)} ${hex(m.hi, 1)}"/><feFuncB type="table" tableValues="${hex(m.lo, 2)} ${hex(m.hi, 2)}"/></feComponentTransfer>
    </filter>
    <clipPath id="${id}c"><circle cx="120" cy="196" r="52"/></clipPath>
    <path id="${id}t" d="M120 196 m-66 0 a66 66 0 1 1 132 0 a66 66 0 1 1 -132 0"/>
    ${locked ? `<filter id="${id}g"><feColorMatrix type="saturate" values="0"/></filter>` : ''}
  </defs>
  <g ${locked ? `filter="url(#${id}g)" opacity=".45"` : ''}>
    <path d="M58 0 H104 L134 106 H104 Z" fill="url(#${id}p)"/>
    <path d="M182 0 H136 L106 106 H136 Z" fill="url(#${id}p)"/>
    <path d="M58 0 H104 L134 106 H104 Z M182 0 H136 L106 106 H136 Z" fill="#000" opacity=".12"/>
    <rect x="104" y="98" width="32" height="18" rx="6" fill="url(#${id}r)" stroke="${m.ink}" stroke-width="2"/>
    <ellipse cx="120" cy="292" rx="64" ry="6" fill="#000" opacity=".25"/>
    <polygon points="${star(120, 196, 98, 84)}" fill="${m.lo}"/>
    <polygon points="${star(120, 194, 95, 81)}" fill="url(#${id}m)"/>
    <circle cx="120" cy="196" r="78" fill="${m.lo}" opacity=".35"/>
    <circle cx="120" cy="196" r="76" fill="url(#${id}m)"/>
    <text font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="11" font-weight="800" letter-spacing="2" fill="${m.ink}"><textPath href="#${id}t" startOffset="0" textLength="405" lengthAdjust="spacing">${ring}</textPath></text>
    <circle cx="120" cy="196" r="55" fill="${m.lo}"/>
    <g clip-path="url(#${id}c)" filter="url(#${id}e)"><svg x="64" y="140" width="112" height="112" viewBox="20 20 360 360">${inner}</svg></g>
    <circle cx="120" cy="196" r="52" fill="none" stroke="${m.hi}" stroke-width="2.5" opacity=".9"/>
    <path d="M58 160 A70 70 0 0 1 150 128" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".35"/>
  </g>
</svg>`;
  }
  // Two hex digits of channel i of #rrggbb as 0..1, for feFuncX tables.
  function hex(c, i) { return (parseInt(c.slice(1 + i * 2, 3 + i * 2), 16) / 255).toFixed(3); }

  window.FitnessChallengeMedals = Object.freeze({ svg, METALS });
})();
