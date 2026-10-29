import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ATOM_DIR, findViolations, SEAL_PATH_PREFIX } from './verification-badge-gate.mjs';

const reglas = (ruta, texto) => findViolations(ruta, texto).map((h) => h.regla.split(' ')[0]);

test('una plantilla que usa el átomo no tiene hallazgos', () => {
  const html = '<h1>{{ nombre }} <app-verification-badge [status]="v.status" /></h1>';
  assert.deepEqual(reglas('src/app/features/x/x.html', html), []);
});

test('R1: un glifo ✓ junto a «verificado» se detecta, en cualquier variante del glifo', () => {
  for (const glifo of ['✓', '✔', '☑', '✅', '🔵']) {
    assert.deepEqual(reglas('src/app/features/x/x.html', `<span>${glifo} Verificado</span>`), ['R1']);
  }
  assert.deepEqual(reglas('src/app/features/x/x.ts', "const t = 'Perfil oficial ✓';"), ['R1']);
});

test('R1: un glifo sin afirmación de verificación no es un hallazgo', () => {
  assert.deepEqual(reglas('src/app/features/x/x.html', '<li>✓ Guardado</li>'), []);
});

test('R2: un svg junto a «identidad verificada» es un sello dibujado a mano', () => {
  const html = `<span class="sello" title="Identidad verificada"><svg viewBox="0 0 24 24"><path d="m9 12 2 2 4-4"/></svg></span>`;
  assert.deepEqual(reglas('src/app/features/x/x.html', html), ['R2']);
});

test('R2: un svg de un icono cualquiera no es un hallazgo', () => {
  const html = `<button><svg viewBox="0 0 24 24"><path d="M3 3h18"/></svg> Imprimir</button>`;
  assert.deepEqual(reglas('src/app/features/x/x.html', html), []);
});

test('R3: copiar el contorno del escudo del átomo se detecta', () => {
  const html = `<svg><path d="${SEAL_PATH_PREFIX}c.3 0 .5.2.5.5z"/></svg>`;
  assert.ok(reglas('src/app/features/x/x.html', html).includes('R3'));
});

test('R4: una clase propia que dice verified o verificado se detecta en plantilla y en CSS', () => {
  assert.deepEqual(reglas('src/app/features/x/x.html', '<span class="tarjeta__verificado"></span>'), ['R4']);
  assert.deepEqual(reglas('src/app/features/x/x.html', '<i class="is-verified"></i>'), ['R4']);
  assert.deepEqual(reglas('src/app/features/x/x.css', '.perfil__verified { color: red; }'), ['R4']);
});

test('R4: una clase que sólo contiene la palabra por casualidad no se marca', () => {
  assert.deepEqual(reglas('src/app/features/x/x.html', '<div class="reverifier-note"></div>'), []);
});

test('el átomo, las pruebas, los generados y los mocks están exentos', () => {
  const sucio = '<span class="x-verified">✓ Verificado</span>';
  assert.deepEqual(reglas(`${ATOM_DIR}verification-badge.html`, sucio), []);
  assert.deepEqual(reglas('src/app/features/x/x.spec.ts', sucio), []);
  assert.deepEqual(reglas('src/app/core/x/x.generated.ts', sucio), []);
  assert.deepEqual(reglas('src/app/core/mock/handlers/x.ts', sucio), []);
});

test('informa la línea del hallazgo', () => {
  const [h] = findViolations('src/app/features/x/x.html', '<p>uno</p>\n<p>dos</p>\n<span>✓ verificado</span>');
  assert.equal(h.linea, 3);
});
