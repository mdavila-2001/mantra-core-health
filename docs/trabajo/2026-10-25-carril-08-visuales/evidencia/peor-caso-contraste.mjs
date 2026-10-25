// Peor caso teórico de contraste del celeste: los cuatro focos apilados en el mismo punto,
// a la opacidad máxima de capa. Reproducible: `node peor-caso-contraste.mjs`.
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const FOCOS = [[[159, 216, 208], 0.40], [[79, 179, 169], 0.24], [[122, 191, 232], 0.30], [[159, 216, 208], 0.26]]; // --fondo-a..d
const TINTAS = { 'tinta-3 #656768': [0x65, 0x67, 0x68], 'tinta-2 #4E5151': [0x4e, 0x51, 0x51] };
for (const tope of [0.6, 0.35, 0.3]) {
  let bg = [255, 255, 255];
  for (const [c, a] of FOCOS) bg = bg.map((v, i) => v * (1 - a * tope) + c[i] * a * tope);
  console.log(`tope ${tope}: fondo ${bg.map(Math.round)}`, Object.entries(TINTAS).map(([k, v]) => `${k} ${cr(v, bg).toFixed(2)}:1`).join(' | '));
}
