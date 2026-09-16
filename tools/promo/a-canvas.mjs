/**
 * Convierte cada pantalla congelada del repositorio en un artboard de Claude Design.
 * El HTML y el CSS son los mismos que usa el video: lo único que cambia es el envoltorio
 * del formato y que las tipografías viajan incrustadas (el lienzo no sale a la red).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const dir = '/private/tmp/claude-501/-Users-josejeremias-Desktop-Mantra-Core-Technologies/1901004d-50fd-4c2e-930f-484f6d1c06d9/scratchpad/video3';
mkdirSync(dir + '/canvas', { recursive: true });

/** Las tipografías del repositorio, incrustadas: el lienzo no puede ir a buscarlas. */
const fuente = (archivo) => readFileSync(`${dir}/fuentes/${archivo}`).toString('base64');
const CARAS = `
/* ---- tipografías del repositorio, incrustadas para el lienzo ---- */
@font-face{font-family:'Inter Variable';src:url(data:font/woff2;base64,${fuente('inter-latin-wght-normal.woff2')}) format('woff2');font-weight:100 900;font-style:normal;font-display:block}
@font-face{font-family:Poppins;src:url(data:font/woff2;base64,${fuente('poppins-500.woff2')}) format('woff2');font-weight:500;font-display:block}
@font-face{font-family:Poppins;src:url(data:font/woff2;base64,${fuente('poppins-600.woff2')}) format('woff2');font-weight:600;font-display:block}
@font-face{font-family:Poppins;src:url(data:font/woff2;base64,${fuente('poppins-latin-700-normal.woff2')}) format('woff2');font-weight:700;font-display:block}
@font-face{font-family:'Nunito Sans';src:url(data:font/woff2;base64,${fuente('nunito-sans-variable.woff2')}) format('woff2');font-weight:200 1000;font-display:block}
`;

const PANTALLAS = [
  ['medico-pago', 'Main', 'Agenda y cobro'],
  ['registro-tipos', 'Registro', 'Crear cuenta'],
  ['registro-medico', 'RegistroMedico', 'Alta del profesional'],
  ['paciente-turnos', 'PedirTurno', 'Pedir turno'],
  ['paciente-citas', 'MisCitas', 'Mis citas'],
  ['medico-consulta', 'Consulta', 'La consulta'],
  ['red-muro', 'Muro', 'Muro profesional'],
  ['directorio-medicos', 'DirectorioMedicos', 'Directorio de médicos'],
  ['directorio-clinicas', 'DirectorioClinicas', 'Directorio de clínicas'],
];

const artboards = [];
PANTALLAS.forEach(([archivo, nombre, titulo], i) => {
  const crudo = readFileSync(`${dir}/pantallas/${archivo}.html`, 'utf8');
  const css = crudo.slice(crudo.indexOf('<style>') + 7, crudo.indexOf('</style>'));
  const cuerpo = crudo.slice(crudo.indexOf('>', crudo.indexOf('<body')) + 1, crudo.lastIndexOf('</body>'));
  /* las caras van al final para ganarle a las @font-face que apuntan a archivos sueltos */
  const dc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
${css}
${CARAS}
  </style>
</helmet>
<div style="width: 1520px; height: 950px; overflow: hidden; background: #fff">
${cuerpo}
</div>
</x-dc>
</body>
</html>`;
  writeFileSync(`${dir}/canvas/${nombre}.dc.html`, dc);
  const col = i % 3, fila = Math.floor(i / 3);
  artboards.push({ file: `${nombre}.dc.html`, title: titulo, x: col * 1680, y: fila * 1140, w: 1520, h: 950 });
  console.log(`· ${nombre}.dc.html · ${(dc.length/1024).toFixed(0)} kB`);
});

writeFileSync(`${dir}/canvas/canvas.json`, JSON.stringify({
  artboards,
  annotations: [{
    id: 'de-donde-sale', x: 0, y: -170, w: 900,
    text: 'Cada artboard es el DOM y las hojas de estilo reales de mantra-core-health, congelados desde la maqueta.\nEl video promocional se anima sobre este mismo HTML y CSS.',
  }],
  launch: { view: 'canvas' },
}, null, 2));
console.log('canvas.json listo ·', artboards.length, 'artboards');
