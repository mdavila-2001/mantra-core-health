/* ============================================================================
    Pruebas de `relaciones-de-uso.mjs` y del índice que genera.

    Los casos de uso (M1–M4 de H2.S1) son archivos REALES del repo: si alguien
    los cambia, la prueba tiene que cambiar con ellos, no seguir pasando contra
    un ejemplo inventado. Sólo la declaración de nivel usa texto de prueba,
    porque ningún componente del repo lo declara todavía.

    Uso:  node --test scripts/lib/relaciones-de-uso.test.mjs
          (el bloque del índice necesita `yarn stock:generate` antes)
    ========================================================================== */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  cargasDinamicas,
  clasificarNivel,
  elementoQueCumple,
  elementosDeLaPlantilla,
  importsDelDecorador,
  importsDelModulo,
  nivelDeclarado,
  parsearSelector,
} from './relaciones-de-uso.mjs';
import { REPO_ROOT } from './scan.mjs';

const leer = (ruta) => readFileSync(join(REPO_ROOT, ruta), 'utf8');

describe('selectores de Angular', () => {
  it('separa etiqueta, atributo y etiqueta+atributo', () => {
    assert.deepEqual(parsearSelector('app-card'), [{ etiqueta: 'app-card', atributos: [], clases: [] }]);
    assert.deepEqual(parsearSelector('button[app-button]'), [
      { etiqueta: 'button', atributos: [{ nombre: 'app-button', valor: null }], clases: [] },
    ]);
    assert.equal(parsearSelector('[appTooltip]')[0].etiqueta, null);
  });

  it('no inventa una coincidencia para lo que no interpreta', () => {
    assert.equal(parsearSelector('button:not([plain])'), null);
    assert.equal(parsearSelector('div > app-x'), null);
  });
});

describe('H2.S1.M1 — importado y no instanciado (caso real: features/groups)', () => {
  const ts = leer('src/app/features/groups/groups.ts');
  const html = leer('src/app/features/groups/groups.html');

  it('Link está en imports: [...] del decorador', () => {
    assert.ok(importsDelDecorador(ts).clases.includes('Link'));
  });

  it('ningún elemento de groups.html cumple a[app-link]', () => {
    assert.equal(elementoQueCumple(parsearSelector('a[app-link]'), elementosDeLaPlantilla(html)), null);
  });

  it('en cambio AppButton sí se instancia (button[app-button] en la plantilla)', () => {
    assert.notEqual(elementoQueCumple(parsearSelector('button[app-button]'), elementosDeLaPlantilla(html)), null);
  });
});

describe('H2.S1.M2 — selector de atributo', () => {
  it('<button app-button …> en core/dev/toast-dev-panel.html:8 cumple button[app-button]', () => {
    const html = leer('src/app/core/dev/toast-dev-panel/toast-dev-panel.html');
    const el = elementoQueCumple(parsearSelector('button[app-button]'), elementosDeLaPlantilla(html));
    assert.equal(el?.linea, 8);
  });

  it('app-button="" de la maqueta también cumple el selector (features/alovida, línea 80)', () => {
    const html = leer(
      'src/app/features/alovida/accesos/acceso-de-emergencia-formulario/acceso-de-emergencia-formulario.html',
    );
    const el = elementoQueCumple(parsearSelector('button[app-button]'), elementosDeLaPlantilla(html));
    assert.equal(el?.linea, 80);
  });

  it('<a> repartido en varias líneas con app-button abajo (diagnostic-orders.html)', () => {
    const html = leer('src/app/features/account/diagnostic-orders/diagnostic-orders.html');
    assert.notEqual(elementoQueCumple(parsearSelector('a[app-button]'), elementosDeLaPlantilla(html)), null);
  });

  it('un selector comentado no cuenta', () => {
    const el = elementosDeLaPlantilla('<!-- <app-card></app-card> -->\n<p>hola</p>');
    assert.equal(elementoQueCumple(parsearSelector('app-card'), el), null);
  });

  it('un `>` dentro de un enlace no corta la etiqueta', () => {
    const el = elementosDeLaPlantilla('<button (click)="a > b" app-button>x</button>');
    assert.notEqual(elementoQueCumple(parsearSelector('button[app-button]'), el), null);
  });
});

describe('H2.S1.M3 — sólo tipos (caso real: core/dev/toast-dev-panel)', () => {
  it('`import type { ToastType }` se marca como tipo, AppButton como valor', () => {
    const imports = importsDelModulo(leer('src/app/core/dev/toast-dev-panel/toast-dev-panel.ts'));
    assert.equal(imports.find((i) => i.nombre === 'ToastType')?.esTipo, true);
    assert.equal(imports.find((i) => i.nombre === 'AppButton')?.esTipo, false);
  });

  it('en un import mixto sólo lo marcado con `type` es tipo (agenda-create.ts:27)', () => {
    const imports = importsDelModulo(leer('src/app/features/agenda/agenda-create/agenda-create.ts'));
    assert.equal(imports.find((i) => i.nombre === 'Calculo')?.esTipo, true);
    assert.equal(imports.find((i) => i.nombre === 'calcularTurnos')?.esTipo, false);
  });
});

describe('H2.S1.M4 — cargas dinámicas', () => {
  it('createComponent(Dialog) en dialog-service.ts:89', () => {
    const cargas = cargasDinamicas(leer('src/app/shared/components/molecules/dialog/dialog-service.ts'));
    assert.deepEqual(cargas.find((c) => c.objetivo === 'Dialog'), { via: 'createComponent', objetivo: 'Dialog', linea: 89 });
  });

  it("import('./features/component-stock/component-stock') en app.routes.ts:1855", () => {
    const cargas = cargasDinamicas(leer('src/app/app.routes.ts'));
    assert.ok(cargas.some((c) => c.via === 'import()' && c.linea === 1855));
  });
});

describe('imports: [...] con comentarios y alias', () => {
  it('un comentario con comas y corchetes no parte el arreglo', () => {
    const src = `@Component({\n  imports: [\n    A, // uno, dos [tres]\n    /* B, C] */ D,\n  ],\n})`;
    assert.deepEqual(importsDelDecorador(src).clases, ['A', 'D']);
  });

  it('una expresión que no es una clase suelta se declara, no se descarta', () => {
    const src = `@Component({\n  imports: [A, ...COMUNES, forwardRef(() => B)],\n})`;
    assert.deepEqual(importsDelDecorador(src).noLiterales, ['...COMUNES', 'forwardRef(() => B)']);
  });

  it('register-patient importa Input con alias AppInput (caso real)', () => {
    const imports = importsDelModulo(leer('src/app/features/auth/register-patient/register-patient.ts'));
    const alias = imports.find((i) => i.nombre === 'AppInput');
    assert.equal(alias?.original, 'Input');
  });
});

describe('nivel atómico: procedencia y declaración (texto de prueba)', () => {
  it('sin declaración, sale de la carpeta y lo dice', () => {
    assert.deepEqual(clasificarNivel('/src/app/shared/components/atoms/x/x.ts', 'export class X {}'), {
      nivel: 'atomo',
      nivelOrigen: 'por-ruta',
      nivelPorRuta: 'atomo',
      nivelDeclaradoInvalido: null,
    });
  });

  it('lo declarado en el componente gana sobre la carpeta', () => {
    const src = '/** Tarjeta que compone varias moléculas. @nivelAtomico organismo */\nexport class X {}';
    assert.deepEqual(clasificarNivel('/src/app/shared/components/molecules/x/x.ts', src), {
      nivel: 'organismo',
      nivelOrigen: 'declarado',
      nivelPorRuta: 'molecula',
      nivelDeclaradoInvalido: null,
    });
  });

  it('un valor que no es un nivel no se acepta en silencio', () => {
    assert.deepEqual(nivelDeclarado('/** @nivelAtomico pagina */'), { nivel: null, invalido: 'pagina' });
    assert.equal(clasificarNivel('/src/app/features/a/a.ts', '/** @nivelAtomico pagina */').nivelDeclaradoInvalido, 'pagina');
  });
});

/* ---- el índice regenerado ------------------------------------------------ */

const RUTA_DEL_INDICE = join(REPO_ROOT, 'src/app/features/component-stock/component-index.generated.ts');

describe('el índice regenerado clasifica los casos reales', { skip: !existsSync(RUTA_DEL_INDICE) }, () => {
  const indice = [...readFileSync(RUTA_DEL_INDICE, 'utf8').matchAll(/\.\.\.(\{[\s\S]*?\}),\n {4}cargar:/g)].map(
    (m) => JSON.parse(m[1]),
  );
  const de = (clave) => indice.find((c) => c.clave === clave);

  it('groups: Link disponible sin instanciar, y fuera de la composición', () => {
    const groups = de('features/groups/groups');
    assert.ok(groups.relaciones.disponibleSinInstanciar.includes('Link'));
    assert.ok(!groups.relaciones.instancia.includes('Link'));
    assert.ok(!groups.usa.atomos.includes('Link'));
    assert.ok(groups.problemas.some((p) => p.tipo === 'importado-sin-instanciar' && p.detalle.startsWith('Link')));
  });

  it('toast-dev-panel: AppButton instanciado por atributo; Toast sólo por tipo, sin contar como consumidor', () => {
    const panel = de('core/dev/toast-dev-panel/toast-dev-panel');
    assert.ok(panel.relaciones.instancia.includes('AppButton'));
    assert.ok(panel.relaciones.soloTipo.includes('Toast'));
    assert.ok(!de('shared/components/molecules/toast/toast').usadoPor.includes('ToastDevPanel'));
  });

  it('Dialog: cargado dinámicamente por dialog-service.ts:89', () => {
    const dialog = indice.find((c) => c.clase === 'Dialog');
    assert.ok(dialog.cargadoDinamicamentePor.includes('src/app/shared/components/molecules/dialog/dialog-service.ts:89 (createComponent)'));
  });

  it('lo que no se pudo decidir figura como no resuelto, con causa', () => {
    const radio = de('shared/components/molecules/radio/radio');
    assert.equal(radio.unresolvedEvidence[0]?.causa, 'referencia-de-valor-no-clasificada');
    assert.match(radio.unresolvedEvidence[0]?.detalle, /RadioGroup/);
  });

  it('cada entrada declara la procedencia de su nivel', () => {
    assert.ok(indice.every((c) => ['por-ruta', 'declarado'].includes(c.nivelOrigen)));
  });
});
