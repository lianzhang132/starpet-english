// Original, code-native 2D story animation. Everything is rigged from SVG shapes;
// no stock footage, external images, or flattened drifting character cards.
const W = 960, H = 540;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const lerp = (a, b, n) => a + (b - a) * clamp(n);
const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const esc = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const f = n => Number(n).toFixed(2);
const star = (x, y, outer, inner, fill = '#ffe18a', stroke = '#408fbc') => {
  const p = Array.from({length: 10}, (_, i) => {
    const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? inner : outer;
    return `${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r)}`;
  }).join(' ');
  return `<polygon points="${p}" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>`;
};

function eye(x, y, t, mood, look = 0) {
  const blinking = (t % 4.7 > 4.54 && t % 4.7 < 4.69);
  if (blinking || mood === 'laugh') return `<path d="M${x - 9} ${y + 2} Q${x} ${y - (mood === 'laugh' ? 10 : -4)} ${x + 9} ${y + 2}" fill="none" stroke="#243a50" stroke-width="5" stroke-linecap="round"/>`;
  return `<ellipse cx="${x}" cy="${y}" rx="${mood === 'surprise' ? 12 : 10}" ry="${mood === 'surprise' ? 15 : 12}" fill="white"/><ellipse cx="${x + look * 3}" cy="${y + 1}" rx="5.5" ry="8" fill="#23374b"/><circle cx="${x + look * 3 + 2}" cy="${y - 2}" r="2" fill="white"/>`;
}
function mouth(y, t, mood = 'happy', talking = false) {
  if (mood === 'surprise') return `<ellipse cy="${y + 2}" rx="8" ry="12" fill="#425a71"/>`;
  if (mood === 'sad') return `<path d="M-11 ${y + 8} Q0 ${y - 2} 11 ${y + 8}" fill="none" stroke="#3c536a" stroke-width="4" stroke-linecap="round"/>`;
  if (talking || mood === 'laugh') {
    const level = talking === true ? .8 : talking || (.6 + Math.sin(t * 13) * .25), h = 4 + level * 12;
    return `<path d="M-14 ${y - 1} Q0 ${y + 2} 14 ${y - 1} Q12 ${f(y + h)} 0 ${f(y + h + 1)} Q-12 ${f(y + h)} -14 ${y - 1}Z" fill="#385570"/><ellipse cy="${f(y + h - 2)}" rx="7" ry="2" fill="#f094a6"/>`;
  }
  return `<path d="M-12 ${y} Q0 ${y + 14} 12 ${y}" fill="none" stroke="#3c536a" stroke-width="4" stroke-linecap="round"/>`;
}
function hat(x = 0, y = 0, rotate = 0, scale = 1) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rotate)}) scale(${f(scale)})"><ellipse rx="60" ry="12" fill="#e5b45c" stroke="#c29344" stroke-width="3"/><path d="M-40 -2 L-32 -35 Q0 -47 32 -35 L40 -2Z" fill="#ffe0a0" stroke="#d9ad61" stroke-width="3"/><path d="M-37 -9 Q0 1 37 -9 L35 -19 Q0 -10 -35 -19Z" fill="#f18b81"/></g>`;
}
function bobo(x, y, t, o = {}) {
  const s = o.scale ?? 1, pose = o.pose ?? 'idle', mood = o.mood ?? 'happy';
  const run = pose === 'run', walk = pose === 'walk' || run;
  const stride = walk ? Math.sin(t * (run ? 13 : 7)) : 0;
  const bob = walk ? Math.abs(stride) * (run ? 8 : 4) : Math.sin(t * 2.2) * 1.7;
  let left = [-62, -75], right = [62, -75];
  if (walk) { left = [-63, -83 + stride * 21]; right = [63, -83 - stride * 21]; }
  if (pose === 'wave') right = [89, -151 + Math.sin(t * 10) * 12];
  if (pose === 'point' || pose === 'offer') right = [101, -107];
  if (pose === 'hold') right = [71, -131];
  if (pose === 'reach') { left = [-77, -164]; right = [78, -172]; }
  if (pose === 'surprise') { left = [-88, -130]; right = [88, -130]; }
  if (pose === 'think') right = [26, -115];
  const arm = (side, end) => `<path d="M${side * 47} -99 Q${side * 75} -90 ${end[0]} ${end[1]}" fill="none" stroke="#529fd0" stroke-width="22" stroke-linecap="round"/><circle cx="${end[0]}" cy="${end[1]}" r="11" fill="#77c5eb"/>`;
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">
    <ellipse cy="7" rx="70" ry="12" fill="#476c66" opacity=".16"/>
    <g transform="translate(0 ${f(-bob)})">
    <ellipse cx="-34" cy="${f(-7 + stride * 10)}" rx="25" ry="14" fill="${o.boots ? '#f4b95d' : '#438fbc'}" transform="rotate(${f(stride * 12)} -34 -9)"/>
    <ellipse cx="34" cy="${f(-7 - stride * 10)}" rx="25" ry="14" fill="${o.boots ? '#f4b95d' : '#438fbc'}" transform="rotate(${f(-stride * 12)} 34 -9)"/>
    ${arm(-1, left)}${arm(1, right)}
    <path d="M-58 -109 Q-70 -58 -48 -22 Q0 9 49 -22 Q72 -58 58 -109Z" fill="#62b4df" stroke="#438fbc" stroke-width="3"/>
    <ellipse cy="-59" rx="39" ry="39" fill="#c3edfa"/>
    ${star(0, -57, 20, 10, '#ffe38f', '#f0c668')}
    ${star(-59, -181, 37, 22, '#7dc9ee')}${star(59, -181, 37, 22, '#7dc9ee')}
    ${star(-59, -181, 21, 12, '#fff1b2', '#fff1b2')}${star(59, -181, 21, 12, '#fff1b2', '#fff1b2')}
    <path d="M-76 -145 Q-79 -193 -30 -204 Q0 -215 30 -204 Q79 -193 76 -145 Q73 -99 0 -96 Q-73 -99 -76 -145Z" fill="#80cdef" stroke="#438fbc" stroke-width="3"/>
    <ellipse cx="-43" cy="-127" rx="13" ry="7" fill="#f6a6ad" opacity=".8"/><ellipse cx="43" cy="-127" rx="13" ry="7" fill="#f6a6ad" opacity=".8"/>
    ${eye(-26, -151, t, mood, o.look ?? 0)}${eye(26, -151, t, mood, o.look ?? 0)}
    ${mood === 'think' || mood === 'sad' ? '<path d="M-37 -171 L-17 -177 M17 -177 L37 -171" stroke="#3e779b" stroke-width="4" stroke-linecap="round"/>' : ''}
    <ellipse cy="-135" rx="6" ry="4" fill="#377498"/>${mouth(-121, t, mood, o.talking)}
    ${o.hat ? hat(0, -209) : ''}
    </g></g>`;
}
function bird(x, y, t, o = {}) {
  const flap = Math.sin(t * 17), s = o.scale ?? 1, flip = o.face === 'left' ? -1 : 1;
  const beakGap = (o.talking || 0) * 7;
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * flip)} ${f(s)})"><path d="M-33 10 L-56 19 L-48 -1Z" fill="#d69a43"/><ellipse cy="4" rx="31" ry="23" fill="#f4c55e" stroke="#c7923c" stroke-width="2"/><path d="M-12 0 Q-22 ${f(-38 - flap * 15)} 17 ${f(-23 - flap * 16)} Q17 10 -12 0Z" fill="#ffdf88" stroke="#d2a04b" stroke-width="2"/><circle cx="20" cy="-12" r="22" fill="#ffe6a0"/><path d="M38 -13 L56 ${f(-6-beakGap)} L38 -6Z M38 -6 L54 ${f(-3+beakGap)} L38 0Z" fill="#f1974c"/><circle cx="27" cy="-15" r="4" fill="#35445a"/><circle cx="28" cy="-16" r="1.2" fill="white"/><path d="M-4 23 L-1 32 M9 23 L13 32" stroke="#d69a43" stroke-width="3" stroke-linecap="round"/>${o.hat ? hat(19, -30, -8, .55) : ''}</g>`;
}
function mouse(x, y, t, o = {}) {
  const s = o.scale ?? 1, hop = o.walk ? Math.abs(Math.sin(t * 10)) * 7 : Math.sin(t * 2) * 1;
  return `<g transform="translate(${f(x)} ${f(y - hop)}) scale(${f(s)})"><ellipse cy="3" rx="42" ry="8" fill="#476c66" opacity=".15"/><path d="M26 -26 Q80 -20 68 -50 Q58 -65 48 -50" fill="none" stroke="#df9fa9" stroke-width="7" stroke-linecap="round"/><ellipse cx="-15" cy="-2" rx="15" ry="7" fill="#8c92a8"/><ellipse cx="19" cy="-2" rx="15" ry="7" fill="#8c92a8"/><ellipse cy="-34" rx="31" ry="35" fill="#a6aec6"/><path d="M-27 -53 Q0 -65 27 -53 L23 -17 Q0 -9 -23 -17Z" fill="#8ccbb9"/><circle cx="-31" cy="-99" r="28" fill="#b9bfd3" stroke="#939cb6" stroke-width="2"/><circle cx="31" cy="-99" r="28" fill="#b9bfd3" stroke="#939cb6" stroke-width="2"/><circle cx="-31" cy="-99" r="18" fill="#efb5bc"/><circle cx="31" cy="-99" r="18" fill="#efb5bc"/><ellipse cy="-71" rx="43" ry="35" fill="#c5cbdc"/>${eye(-16, -77, t, o.mood ?? 'happy', -1)}${eye(16, -77, t, o.mood ?? 'happy', -1)}<ellipse cy="-63" rx="6" ry="5" fill="#d98f9e"/>${mouth(-53, t, o.mood ?? 'happy', o.talking)}<path d="M-31 -55 L-58 -60 M-29 -47 L-57 -43 M31 -55 L58 -60 M29 -47 L57 -43" stroke="#8b8f9d" stroke-width="2"/><path d="M-27 -40 Q-42 -31 -24 -27 M27 -40 Q43 -31 24 -27" fill="none" stroke="#a6aec6" stroke-width="11" stroke-linecap="round"/></g>`;
}
function cat(x, y, t, o = {}) {
  const s = o.scale ?? 1, step = o.walk ? Math.sin(t * 9) * 6 : 0, mood = o.wet ? 'sad' : 'happy';
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><ellipse cy="5" rx="52" ry="9" fill="#476c66" opacity=".15"/><path d="M33 -29 Q89 -30 74 -86" fill="none" stroke="#d59862" stroke-width="17" stroke-linecap="round"/><ellipse cx="-23" cy="${f(-3 + step)}" rx="19" ry="9" fill="#c98b54"/><ellipse cx="23" cy="${f(-3 - step)}" rx="19" ry="9" fill="#c98b54"/><ellipse cy="-42" rx="39" ry="48" fill="#e6ae77"/><ellipse cy="-36" rx="23" ry="30" fill="#ffe4bf"/><path d="M-43 -102 L-45 -155 L-7 -125 M43 -102 L45 -155 L7 -125" fill="#e6ae77" stroke="#c9905a" stroke-width="3"/><path d="M-34 -112 L-37 -142 L-17 -123 M34 -112 L37 -142 L17 -123" fill="#edb6ad"/><ellipse cy="-100" rx="48" ry="37" fill="#f4c28e" stroke="#c9905a" stroke-width="2"/><path d="M-15 -134 L-10 -119 M0 -137 L0 -119 M15 -134 L10 -119" stroke="#c9905a" stroke-width="5" stroke-linecap="round"/>${eye(-18, -103, t, mood, -1)}${eye(18, -103, t, mood, -1)}<path d="M-5 -88 L5 -88 L0 -82Z" fill="#af747c"/>${mouth(-78, t, mood, o.talking)}<path d="M-30 -87 L-59 -93 M-29 -79 L-59 -75 M30 -87 L59 -93 M29 -79 L59 -75" stroke="#a77755" stroke-width="2"/>${o.wet ? '<path d="M-34 -58 Q-42 -45 -34 -40 Q-26 -45 -34 -58 M37 -122 Q29 -109 37 -104 Q45 -109 37 -122" fill="#8ac8e7"/>' : ''}</g>`;
}
function duck(x, y, t, o = {}) {
  const hop = o.hop ?? 0, s = o.scale ?? 1;
  const gap=(o.talking||0)*7;
  return `<g transform="translate(${f(x)} ${f(y - hop)}) scale(${f(s)})"><ellipse cy="3" rx="43" ry="8" fill="#527f7b" opacity=".14"/><path d="M-15 -5 L-36 5 L-9 4 M15 -5 L36 5 L9 4" fill="#e99544"/><path d="M-34 -37 L-55 -53 L-45 -24" fill="#f4ca62"/><ellipse cy="-34" rx="43" ry="29" fill="#ffdb72" stroke="#dbb24e" stroke-width="2"/><path d="M-15 -45 Q4 -57 17 -35 Q-2 -22 -15 -45" fill="#f0bf4e"/><circle cx="23" cy="-66" r="26" fill="#ffe58c"/><path d="M42 -69 L66 ${f(-63-gap)} L44 -61Z M44 -61 L64 ${f(-59+gap)} L45 -54Z" fill="#ed9852"/>${eye(31, -70, t, 'happy', 0)}</g>`;
}
function apple(x, y, scale = 1) {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(scale)})"><path d="M0 -20 C-26 -39 -48 -3 -29 24 Q-12 43 0 31 Q14 44 29 24 C48 -3 26 -39 0 -20Z" fill="#ef7774" stroke="#c95354" stroke-width="2"/><path d="M0 -19 Q-4 -38 10 -41" fill="none" stroke="#886342" stroke-width="5" stroke-linecap="round"/><ellipse cx="17" cy="-31" rx="12" ry="6" fill="#7ab983" transform="rotate(-24 17 -31)"/><path d="M-23 -10 Q-32 -1 -27 9" fill="none" stroke="#ffb2a5" stroke-width="5" stroke-linecap="round"/></g>`;
}
function appleHalf(x,y,scale=1,rotate=0){
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rotate)}) scale(${f(scale)})"><path d="M-27 -20 Q-38 11 -17 30 Q0 43 18 27 Q34 9 27 -20Z" fill="#ef7774" stroke="#c95354" stroke-width="2"/><path d="M-22 -16 Q-28 10 -13 23 Q0 33 13 23 Q27 10 22 -16Z" fill="#fff3cf"/><path d="M-3 -18 V22" stroke="#ead9b0" stroke-width="2"/><ellipse cx="-8" cy="7" rx="3" ry="6" fill="#886342" transform="rotate(-20 -8 7)"/><ellipse cx="8" cy="7" rx="3" ry="6" fill="#886342" transform="rotate(20 8 7)"/></g>`;
}
function banana(x, y, scale = 1, rotate = -15) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rotate)}) scale(${f(scale)})"><path d="M-36 -29 Q-34 26 43 2 Q10 56 -28 29 Q-46 12 -36 -29Z" fill="#ffdb6e" stroke="#d0a74a" stroke-width="3"/><path d="M-29 -19 Q-21 24 31 10" fill="none" stroke="#f1bc4e" stroke-width="3"/><path d="M-37 -29 L-32 -37" stroke="#8d7540" stroke-width="6" stroke-linecap="round"/></g>`;
}
function basket(x, y, open = false) {
  return `<g transform="translate(${f(x)} ${f(y)})"><path d="M-32 -35 Q-34 -90 0 -90 Q34 -90 32 -35" stroke="#be8d53" stroke-width="9" fill="none"/><path d="M-55 -41 L55 -41 L43 5 Q0 18 -43 5Z" fill="#d7ad73" stroke="#aa7b46" stroke-width="3"/><path d="M-48 -27 H48 M-46 -13 H46 M-30 -40 L-26 7 M-12 -40 L-10 10 M10 -40 L10 10 M30 -40 L26 7" stroke="#bc8d58" stroke-width="3"/><path d="M-55 -41 L55 -41 L${open ? 40 : 51} ${open ? -78 : -47} L${open ? -55 : -51} ${open ? -70 : -47}Z" fill="#e6c18a" stroke="#b98b54" stroke-width="3"/></g>`;
}
function balloon(x, y, t, hand, o = {}) {
  const sway = Math.sin(t * 2.7) * 5, xx = x + sway;
  const str = hand ? `<path d="M${f(xx)} ${f(y + 48)} Q${f((xx + hand[0]) / 2 - 22)} ${f((y + 48 + hand[1]) / 2)} ${f(hand[0])} ${f(hand[1])}" fill="none" stroke="#b99c87" stroke-width="2.5"/>` : `<path d="M${f(xx)} ${f(y + 48)} Q${f(xx - 18)} ${f(y + 95)} ${f(xx + 18 + Math.sin(t * 4) * 15)} ${f(y + 126)}" fill="none" stroke="#b99c87" stroke-width="2.5"/>`;
  return `${str}<g transform="translate(${f(xx)} ${f(y)}) rotate(${f(Math.sin(t * 2.2) * 5)})"><ellipse rx="37" ry="47" fill="#ef737b" stroke="#ca586b" stroke-width="2.5"/><ellipse cx="-12" cy="-16" rx="9" ry="17" fill="#ffc0c0" opacity=".9" transform="rotate(20 -12 -16)"/><path d="M0 46 L-7 55 L7 55Z" fill="#d65d71"/></g>`;
}
function umbrella(x, y, opening = 1, tilt = 0) {
  const p = Math.max(.06, opening);
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(tilt)})"><path d="M0 -6 V166 Q0 187 -19 186 Q-33 185 -31 171" fill="none" stroke="#92754b" stroke-width="9" stroke-linecap="round"/><g transform="scale(${f(p)} 1)"><path d="M-176 13 Q-160 -68 -87 -89 Q0 -120 87 -89 Q160 -68 176 13 Q139 -8 117 19 Q86 -6 58 17 Q29 -6 0 16 Q-29 -6 -58 17 Q-86 -6 -117 19 Q-139 -8 -176 13Z" fill="#ffd97b" stroke="#c59c4f" stroke-width="3"/><path d="M0 -103 Q-50 -75 -58 17 M0 -103 Q-102 -76 -117 19 M0 -103 Q50 -75 58 17 M0 -103 Q102 -76 117 19" fill="none" stroke="#e8b75b" stroke-width="3"/><path d="M0 -112 V-102" stroke="#92754b" stroke-width="6" stroke-linecap="round"/></g></g>`;
}
function leaf(x, y, scale = 1, rotate = 0) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rotate)}) scale(${f(scale)})"><path d="M-53 0 Q-30 -46 46 -18 Q49 20 -9 32 Q-36 31 -53 0Z" fill="#80ba80" stroke="#5d9b68" stroke-width="3"/><path d="M-48 1 L42 -16 M-23 -8 L-23 17 M-1 -14 L6 15 M18 -17 L27 -2" fill="none" stroke="#b7d8a1" stroke-width="2.5"/></g>`;
}
function sparkles(x, y, t, color = '#f2c35a') {
  return Array.from({length: 5}, (_, i) => {
    const a = i * Math.PI * .4 + t * .4, r = 38 + Math.sin(t * 3 + i) * 9;
    return star(x + Math.cos(a) * r, y + Math.sin(a) * r, 6, 2.5, color, color);
  }).join('');
}
function hearts(x, y, t) {
  return [0, 1, 2].map(i => {
    const p = (t * .35 + i / 3) % 1;
    return `<path d="M0 3 C-17 -7 -7 -20 0 -10 C7 -20 17 -7 0 3Z" fill="#ed929c" opacity="${f(Math.sin(p * Math.PI) * .8)}" transform="translate(${f(x + Math.sin(i * 2) * 34)} ${f(y - p * 65)}) scale(.85)"/>`;
  }).join('');
}
function cloud(x, y, scale = 1, color = '#fffdf5') {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(scale)})" fill="${color}"><ellipse rx="68" ry="23"/><circle cx="-30" cy="-16" r="29"/><circle cx="12" cy="-28" r="39"/><circle cx="46" cy="-8" r="27"/></g>`;
}
function tree(x, y, scale = 1, variant = 0) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-12 0 L-8 -120 L9 -120 L15 0Z" fill="#ae9369"/><path d="M0 -64 L-42 -104 M3 -86 L37 -119" stroke="#ae9369" stroke-width="12" stroke-linecap="round"/><circle cx="-30" cy="-148" r="57" fill="${variant ? '#97c6a0' : '#81bda0'}"/><circle cx="31" cy="-155" r="60" fill="${variant ? '#a3d2ab' : '#96ccac'}"/><circle cy="-190" r="62" fill="${variant ? '#b5dbb5' : '#add9b9'}"/><circle cx="-31" cy="-177" r="5" fill="#dbf0c8"/><circle cx="42" cy="-151" r="5" fill="#dbf0c8"/></g>`;
}
function park(t, kind = 'park', rain = 0) {
  const sky = rain ? '#dce9f1' : '#dff1f7';
  let result = `<rect width="960" height="540" fill="${sky}"/><circle cx="815" cy="88" r="43" fill="#ffe7a6" opacity="${f(1 - rain * .85)}"/>${cloud(170 + Math.sin(t * .04) * 10, 96, .72)}${cloud(650 + Math.sin(t * .03) * 12, 64, .55)}<path d="M0 328 Q160 252 345 320 T710 310 T1000 297 V540 H0Z" fill="#c3dfbe"/><path d="M0 362 Q230 311 433 353 T960 345 V540 H0Z" fill="#a8cfae"/>`;
  if (kind === 'picnic') {
    result += tree(110, 368, 1.23, 1) + tree(902, 374, .9) + `<path d="M0 430 Q200 390 480 426 T960 415 V540 H0Z" fill="#b8d6ae"/>`;
  } else if (kind === 'rain') {
    result += `<path d="M0 342 H960 V390 H0Z" fill="#c4d7d0"/><path d="M-20 428 Q440 355 980 398 V540 H-20Z" fill="#dfd5c0"/><path d="M0 464 Q450 405 960 446" fill="none" stroke="#ebe4d4" stroke-width="6"/>` + tree(870, 367, .9, 1);
    result += `<g transform="translate(10 158)"><path d="M0 116 H156 V237 H0Z" fill="#f5dfb9"/><path d="M-20 118 L75 40 L175 118Z" fill="#e5aa8c"/><path d="M24 150 H67 V194 H24Z" fill="#c4dce3" stroke="#c2a784" stroke-width="4"/><path d="M105 157 H143 V237 H105Z" fill="#b7bd9e"/></g><ellipse cx="745" cy="464" rx="112" ry="18" fill="#a5cbd7" opacity="${f(.25 + rain * .55)}"/><ellipse cx="745" cy="464" rx="76" ry="10" fill="none" stroke="#cfe6ec" stroke-width="3"/>`;
  } else {
    result += tree(83, 367, 1.08) + tree(875, 365, 1.2, 1);
    result += `<path d="M0 410 Q245 362 960 392 V540 H0Z" fill="#dfd3b9"/><path d="M0 445 Q500 397 960 438" stroke="#efe5d1" stroke-width="7" fill="none"/><g transform="translate(70 372)"><path d="M0 0 V-47 M112 0 V-47" stroke="#9a8c70" stroke-width="8"/><path d="M-8 -50 H120 M-8 -31 H120" stroke="#c99f73" stroke-width="12" stroke-linecap="round"/></g>`;
  }
  result += `<path d="M0 480 Q130 459 240 479 L224 540 H0Z M960 481 Q860 456 813 488 L823 540 H960Z" fill="#95bd91"/>`;
  for (const [x, y, c] of [[39,485,'#fff1ae'],[205,504,'#fff8d8'],[866,505,'#ffced2'],[917,480,'#fff8d8']]) {
    result += `<path d="M${x} ${y+17} V${y}" stroke="#79a580" stroke-width="3"/><g fill="${c}"><circle cx="${x-5}" cy="${y}" r="5"/><circle cx="${x+5}" cy="${y}" r="5"/><circle cx="${x}" cy="${y-5}" r="5"/><circle cx="${x}" cy="${y+5}" r="5"/></g><circle cx="${x}" cy="${y}" r="3" fill="#e7b65d"/>`;
  }
  return result;
}
function wind(t, opacity = 1) {
  return `<g fill="none" stroke="#f9ffff" stroke-width="5" stroke-linecap="round" opacity="${f(opacity * .8)}">${[0,1,2].map(i => {
    const x = ((t * 100 + i * 330) % 1250) - 230, y = 160 + i * 58;
    return `<path d="M${f(x)} ${y} H${f(x+115)} Q${f(x+157)} ${y-1} ${f(x+145)} ${y-23} Q${f(x+133)} ${y-42} ${f(x+120)} ${y-24}"/>`;
  }).join('')}</g>`;
}
function rainDrops(t, intensity) {
  if (intensity <= 0) return '';
  return `<g stroke="#8db8cf" stroke-width="3" stroke-linecap="round" opacity="${f(intensity * .65)}">${Array.from({length: 47}, (_, i) => {
    const x = (i * 131 + t * 65) % 1040 - 40, y = (i * 73 + t * 260) % 550 - 20;
    return `<path d="M${f(x)} ${f(y)} l-7 17"/>`;
  }).join('')}</g>`;
}
function cloth(x, y, reveal = 1) {
  return `<g transform="translate(${x} ${y}) scale(${f(reveal)} 1)"><path d="M-188 -39 L170 -39 L224 33 L-224 33Z" fill="url(#picnic-check)" stroke="#f4e7ca" stroke-width="5"/><path d="M-224 33 L-207 43 L-191 33 L-175 43 L-159 33 M224 33 L207 43 L191 33 L175 43 L159 33" fill="none" stroke="#f4e7ca" stroke-width="5"/></g>`;
}
function bush(x, y, wiggle = 0) {
  return `<g transform="translate(${f(x)} ${y}) rotate(${f(wiggle)})"><ellipse rx="73" ry="30" fill="#7aac89"/><circle cx="-36" cy="-17" r="31" fill="#87b995"/><circle cx="10" cy="-24" r="39" fill="#8ebf96"/><circle cx="48" cy="-14" r="29" fill="#79ae8a"/><path d="M-40 -11 L-29 -24 M19 -19 L29 -32 M37 -4 L52 -11" stroke="#b2d5a8" stroke-width="3" stroke-linecap="round"/></g>`;
}
function speech(lesson, t, x = 500, y = 92) {
  const cue = lesson.transcript?.find(c => t >= c.start && t < c.end);
  if (!cue?.en) return '';
  const line = String(cue.en), words = line.split(' '), lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 27 && current) { lines.push(current); current = word; }
    else current = (current + ' ' + word).trim();
  }
  if (current) lines.push(current);
  const width = Math.min(580, Math.max(210, Math.max(...lines.map(l => l.length)) * 17 + 48));
  const height = lines.length * 35 + 28, top = y - height / 2;
  return `<g><rect x="${f(x-width/2+3)}" y="${f(top+5)}" width="${f(width)}" height="${height}" rx="24" fill="#6d8b87" opacity=".13"/><path d="M${f(x-90)} ${f(top+height-2)} L${f(x-114)} ${f(top+height+20)} L${f(x-112)} ${f(top+height-2)}" fill="white"/><rect x="${f(x-width/2)}" y="${f(top)}" width="${f(width)}" height="${height}" rx="24" fill="#fffefa" stroke="#d9e5dc" stroke-width="2"/>${lines.map((l,i)=>`<text x="${x}" y="${f(top+35+i*35)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="29" font-weight="700" fill="#354b60">${esc(l)}</text>`).join('')}</g>`;
}
function actionAt(lesson, t) {
  const beats = lesson.story?.beats ?? [];
  const found = beats.findIndex(b => t >= b.start && t < b.end);
  const index = found >= 0 ? found : (t >= (beats.at(-1)?.end ?? Infinity) ? beats.length-1 : 0);
  const beat = beats[index];
  return {index, beat, p: beat ? clamp((t-beat.start)/(beat.end-beat.start)) : 0};
}
function speakerLevel(lesson,t,assets,speaker){
  const cue=lesson.transcript?.find(c=>t>=c.start&&t<c.end);
  const active=assets.speaker??cue?.speaker??'bobo';
  if(active!==speaker||!cue)return 0;
  if(Number.isFinite(assets.speechLevel))return clamp(assets.speechLevel);
  return t-cue.start<2.5?.45+.4*Math.abs(Math.sin(t*13)):0;
}
function balloonStory(lesson, t, assets) {
  const {index: i, p} = actionAt(lesson,t), q = ease(p);
  let scene = park(t), actors = '', front = '', camera = '', bx = 310, by = 443, pose = 'hold', mood = 'happy', hatOn = true;
  let ball = [405,173], hand = [bx+69,by-132], birdPos = null, birdHat = false;
  if(i===0) { bx=lerp(220,310,q); hand=[bx+69,by-132]; ball=[bx+100,173]; pose='walk'; }
  if(i===1) { bx=350; hand=[bx+69,by-132]; ball=[465,172]; camera='translate(-60 -19) scale(1.09)'; }
  if(i===2) { bx=350; pose='surprise'; mood='surprise'; ball=[lerp(465,680,q),lerp(172,116,q)]; hand=null; scene+=wind(t,Math.sin(p*Math.PI)); }
  if(i===3) { bx=lerp(295,568,p); by=443; pose='run'; ball=[lerp(660,820,p),112+Math.sin(t)*7]; hand=null; scene+=wind(t,.7); front+='<path d="M227 439 h-26 M215 452 h-44" stroke="#f7f1df" stroke-width="5" stroke-linecap="round"/>'; }
  if(i===4) { bx=650; by=443-Math.sin(p*Math.PI)*83; pose=p<.76?'reach':'surprise'; mood=p>.72?'surprise':'happy'; ball=[800,105]; hand=null; if(p>.76)front+=`<ellipse cx="650" cy="448" rx="${f(55+(p-.76)*80)}" ry="7" fill="none" stroke="#f4edda" stroke-width="5" opacity="${f(1-(p-.76)*3)}"/>`; }
  if(i===5) { bx=585; pose='wave'; ball=[811,111]; hand=null; birdPos=[lerp(954,692,q),lerp(205,218,q)]; }
  if(i===6) { bx=535; pose='point'; ball=[810,117]; hand=null; birdPos=[lerp(692,811,q),lerp(218,224,q)]; }
  if(i===7) { bx=435; pose='reach'; ball=[lerp(810,540,q),lerp(117,178,q)]; birdPos=[ball[0]+3,ball[1]+126]; hand=[birdPos[0]-3,birdPos[1]+23]; }
  if(i===8) { bx=435; pose='hold'; ball=[548,173]; hand=[bx+69,by-132]; birdPos=[687,228+Math.sin(t*2)*7]; front+=hearts(586,260,t); }
  if(i===9) {
    bx=435; pose=p<.5?'surprise':'wave'; mood=p<.4?'surprise':'laugh'; ball=[550,173]; hand=[bx+69,by-132]; birdPos=[688,232+Math.sin(t*2)*7];
    const hp=ease(clamp(p/.52)); hatOn=false; birdHat=p>.52;
    if(!birdHat){
      const hx=lerp(bx,birdPos[0]+19,hp),hy=lerp(by-210,birdPos[1]-30,hp)-Math.sin(hp*Math.PI)*80;
      // The loose balloon string visibly catches the brim before it lets go.
      // Its endpoint follows the hat, so the joke has a visible physical cause.
      hand=[hx+45*lerp(1,.55,hp),hy-3];ball[0]-=Math.sin(hp*Math.PI)*48;
      front+=hat(hx,hy,lerp(0,352,hp),lerp(1,.55,hp));
      if(p<.2)scene+=wind(t,Math.sin(p/.2*Math.PI)*.45);
    }
    if(p>.55)front+=sparkles(705,203,t,'#f0c55f');
  }
  actors+=balloon(ball[0],ball[1],t,hand);
  actors+=bobo(bx,by,t,{pose,mood,hat:hatOn,look:1,talking:speakerLevel(lesson,t,assets,'bobo')});
  if(birdPos)actors+=bird(birdPos[0],birdPos[1],t,{face:i===7?'left':'right',hat:birdHat,talking:speakerLevel(lesson,t,assets,'bird')});
  return `${camera?`<g transform="${camera}">`:''}${scene}${actors}${front}${camera?'</g>':''}${speech(lesson,t,485,88)}`;
}
function picnicStory(lesson,t,assets) {
  const {index:i,p}=actionAt(lesson,t), q=ease(p);
  let result=park(t,'picnic'), bx=320, by=445, pose='idle', mood='happy', mx=746, showMouse=i>=3, fruitApple=[513,406], fruitBanana=[601,416];
  let appleVisible=true, extra='', front='', cutFruit='';
  result+=cloth(515,448,i===0?lerp(.06,1,q):1);
  result+=basket(700,441,i>0||p>.45);
  if(i===0){ bx=lerp(160,330,q);pose=p<.7?'walk':'offer'; }
  if(i===1){pose='point';extra+=sparkles(516,387,t);}
  if(i===2){pose='think';mood='think';fruitApple=[lerp(513,639,q),lerp(406,416,q)];extra+=`<text x="${f(755+Math.sin(t*22)*4)}" y="344" font-family="Arial" font-size="37" font-weight="bold" fill="#6c9b76">?</text>`;}
  if(i===3){mx=lerp(805,730,q);fruitApple=[639,416];pose='surprise';mood='surprise';}
  if(i===4){mx=730;fruitApple=[639,416];pose='think';mood='think';extra+=`<g transform="translate(812 306)"><path d="M-29 -8 Q-40 -35 -12 -39 Q0 -58 17 -40 Q49 -42 43 -18 Q53 8 25 9 H-8 Q-35 12 -29 -8" fill="#fffefa" stroke="#d7e6d4" stroke-width="2"/>${apple(6,-16,.45)}<circle cx="-27" cy="23" r="6" fill="#fffefa"/><circle cx="-42" cy="38" r="4" fill="#fffefa"/></g>`;}
  if(i===5){bx=420;pose='offer';mx=720;fruitApple=[lerp(521,679,q),lerp(338,417,q)-Math.sin(q*Math.PI)*24];extra+=hearts(577,331,t);}
  if(i===6){bx=420;pose='wave';mx=lerp(720,610,q);fruitApple=[mx-35,422];}
  if(i>=7){bx=380;mx=610;appleVisible=false;pose='offer';cutFruit=appleHalf(481,338,.52,-10)+appleHalf(575,422,.47,12);}
  if(i===7){extra+=hearts(514,304,t);}
  if(i===8){pose='hold';extra+=sparkles(518,350,t);}
  if(i===9){pose=p<.45?'surprise':'point';mood=p<.45?'surprise':'laugh';extra+=leaf(lerp(650,536,q),lerp(404,419,q),.35,lerp(-25,5,q));if(p>.65)front+=hearts(498,318,t);}
  result+=bobo(bx,by,t,{pose,mood,look:1,talking:speakerLevel(lesson,t,assets,'bobo')});
  if(showMouse)result+=mouse(mx,447,t,{scale:.91,walk:(i===3||i===6)&&p<.9,mood:i===4?'sad':'happy',talking:speakerLevel(lesson,t,assets,'mouse')});
  result+=extra;
  if(appleVisible)result+=apple(fruitApple[0],fruitApple[1],.78);
  result+=banana(fruitBanana[0],fruitBanana[1],.81)+cutFruit;
  if(i<4)front+=bush(794,447,i===2?Math.sin(t*22)*3:0);
  else front+=bush(857,468);
  const close=i===4||i===9;
  return `${close?'<g transform="translate(-70 -42) scale(1.12)">':''}${result}${front}${close?'</g>':''}${speech(lesson,t,491,89)}`;
}
function rainStory(lesson,t,assets) {
  const {index:i,p}=actionAt(lesson,t),q=ease(p);
  const intensity=i===0?0:i===1?lerp(0,1,q):i===9?lerp(1,.5,q):1;
  let result=park(t,'rain',intensity), bx=340, by=447, cx=760, pose='idle', mood='happy', showCat=i>=3, umbrellaOpen=i>=2?1:0;
  let ux=bx+52,uy=204, duckX=196,showDuck=i>=8,wet=i<7,catWalk=false,front='';
  if(i===0){bx=lerp(215,335,q);pose='walk';ux=bx+45;}
  if(i===1){pose='surprise';mood='surprise';ux=bx+45;}
  if(i===2){pose='hold';umbrellaOpen=ease(clamp(p*2));ux=bx+52;uy=lerp(257,204,q);}
  if(i===3){pose='think';mood='think';ux=bx+52;cx=760;}
  if(i===4){bx=lerp(340,510,q);pose='walk';ux=bx+52;cx=760;}
  if(i===5){bx=510;pose='wave';ux=bx+52;cx=760;front+=`<text x="780" y="269" font-family="Arial" font-size="40" fill="#7e95ab" font-weight="bold">?</text>`;}
  if(i===6){bx=510;pose='wave';ux=bx+52;cx=lerp(760,641,q);wet=p<.5;catWalk=true;}
  if(i===7){bx=510;pose='hold';ux=bx+52;cx=641;wet=false;front+=hearts(591,277,t);}
  if(i===8){bx=485;pose='wave';ux=bx+52;cx=619;wet=false;duckX=lerp(195,725,q);}
  if(i===9){bx=485;pose=p<.5?'surprise':'wave';mood=p<.45?'surprise':'laugh';ux=bx+52;cx=619;wet=false;duckX=744;}
  // Weather is behind the canopy; the two friends are visibly dry underneath.
  result+=rainDrops(t,intensity);
  result+=bobo(bx,by,t,{pose,mood,look:1,boots:true,talking:speakerLevel(lesson,t,assets,'bobo')});
  if(showCat)result+=cat(cx,449,t,{wet,scale:.9,walk:catWalk,talking:speakerLevel(lesson,t,assets,'cat')});
  if(umbrellaOpen>0)result+=umbrella(ux,uy,umbrellaOpen,Math.sin(t*1.2)*1.4);
  else result+=`<g transform="translate(${f(bx+72)} 354) rotate(-18)"><path d="M0 -95 L-15 -12 L15 -12Z" fill="#f6c966" stroke="#c59c50" stroke-width="3"/><path d="M0 -17 V55 Q0 71 -14 67" fill="none" stroke="#92754b" stroke-width="7" stroke-linecap="round"/></g>`;
  if(showDuck){
    const hop=i===9?Math.max(0,Math.sin(p*Math.PI*6))*24:Math.abs(Math.sin(t*8))*5;
    result+=duck(duckX,461,t,{hop,scale:.92,talking:speakerLevel(lesson,t,assets,'duck')});
    if(i===9){
      for(let j=0;j<9;j++){
        const cycle=(p*3+j*.071)%1, a=Math.PI*(.15+j*.08),r=45+cycle*80;
        const dx=duckX+Math.cos(a)*r,dy=457-Math.sin(a)*r+cycle*cycle*57;
        front+=`<ellipse cx="${f(dx)}" cy="${f(dy)}" rx="4" ry="7" transform="rotate(${f(j*23)} ${f(dx)} ${f(dy)})" fill="#84b8d3" opacity="${f(1-cycle)}"/>`;
      }
      front+=`<ellipse cx="${duckX}" cy="465" rx="${f(43+((p*3)%1)*65)}" ry="${f(6+((p*3)%1)*8)}" fill="none" stroke="#d4edf3" stroke-width="3" opacity="${f(1-((p*3)%1))}"/>`;
    }
  }
  const close=i===3||i===5;
  return `${close?'<g transform="translate(-100 -48) scale(1.12)">':''}${result}${front}${close?'</g>':''}${speech(lesson,t,491,84)}`;
}

/** Render a deterministic, self-contained 960×540 SVG frame at story time t. */
export function renderStoryFrame(lesson, t, assets = {}) {
  const scene = lesson.id === 'story-balloon' ? balloonStory(lesson,t,assets) : lesson.id === 'story-picnic' ? picnicStory(lesson,t,assets) : lesson.id === 'story-rain' ? rainStory(lesson,t,assets) : null;
  if(scene===null)throw new Error(`Unknown original story: ${lesson.id}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><pattern id="picnic-check" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="#fff0d5"/><path d="M0 9 H36 M9 0 V36" stroke="#f0a9a0" stroke-width="18" opacity=".65"/></pattern></defs>${scene}<g opacity=".8"><rect x="17" y="14" width="117" height="27" rx="13" fill="#fffdf4"/><text x="76" y="33" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#54778a">BOBO STORIES</text></g></svg>`;
}
