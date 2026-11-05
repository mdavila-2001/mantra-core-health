import { HttpErrorResponse } from '@angular/common/http';

import { CATALOGO_INFRAESTRUCTURA as CATALOGO } from '../../mock/fixtures/infraestructura';
import {
  admiteHijo,
  armarArbol,
  bloqueosDelError,
  descendientesDe,
  expandirPatron,
  formasHijasPermitidas,
  funcionesObligatoriasFaltantes,
  funcionesParaForma,
  leerErrorDeInfraestructura,
  MAX_ALTA_MASIVA,
  nombresDelAltaMasiva,
  normalizarBloqueos,
  ofrecerEscritura,
  padresValidos,
  parsearCsv,
  partirLineaCsv,
  tipologiaAdmite,
} from './infrastructure.rules';
import type { CareSpaceNode } from './infrastructure.types';

function espacio(id: string, parentId: string | null, form: string, status = 'SPACE_ACTIVE', fn = 'SPACE_FN_GENERIC'): CareSpaceNode {
  return {
    id,
    parentId,
    code: id.toUpperCase(),
    name: id,
    form: { code: `LOC_FORM_${form}`, display: form },
    function: { code: fn, display: fn },
    status: { code: status, display: status },
    operationalStatus: null,
    clinicalUnitId: null,
    capacity: null,
    rowVersion: 1,
    childCount: 0,
  };
}

/** Edificio > Pabellón > Piso > Sala > Habitación > Cama, más un piso suspendido. */
const ARBOL: readonly CareSpaceNode[] = [
  espacio('bld', null, 'BUILDING'),
  espacio('wing', 'bld', 'WING'),
  espacio('lvl', 'wing', 'LEVEL'),
  espacio('ward', 'lvl', 'WARD'),
  espacio('room', 'ward', 'ROOM', 'SPACE_ACTIVE', 'SPACE_FN_INPATIENT_ROOM'),
  espacio('bed', 'room', 'BED', 'SPACE_ACTIVE', 'SPACE_FN_BED_STANDARD'),
  espacio('lvl2', 'bld', 'LEVEL', 'SPACE_SUSPENDED'),
];

describe('reglas de infraestructura', () => {
  describe('formas permitidas por padre (§2)', () => {
    it('en la raíz sólo edificio, área, local y virtual', () => {
      expect(formasHijasPermitidas(CATALOGO, null)).toEqual([
        'LOC_FORM_BUILDING',
        'LOC_FORM_AREA',
        'LOC_FORM_ROOM',
        'LOC_FORM_VIRTUAL',
      ]);
    });

    it('una cama sólo cuelga de sala, área o local', () => {
      expect(admiteHijo(CATALOGO, 'LOC_FORM_ROOM', 'LOC_FORM_BED')).toBe(true);
      expect(admiteHijo(CATALOGO, 'LOC_FORM_WARD', 'LOC_FORM_BED')).toBe(true);
      expect(admiteHijo(CATALOGO, 'LOC_FORM_AREA', 'LOC_FORM_BED')).toBe(true);
      expect(admiteHijo(CATALOGO, 'LOC_FORM_BUILDING', 'LOC_FORM_BED')).toBe(false);
      expect(admiteHijo(CATALOGO, 'LOC_FORM_LEVEL', 'LOC_FORM_BED')).toBe(false);
      expect(admiteHijo(CATALOGO, null, 'LOC_FORM_BED')).toBe(false);
    });

    it('un local sólo admite camas', () => {
      expect(formasHijasPermitidas(CATALOGO, 'LOC_FORM_ROOM')).toEqual(['LOC_FORM_BED']);
    });

    it('una cama no admite hijos', () => {
      expect(formasHijasPermitidas(CATALOGO, 'LOC_FORM_BED')).toEqual([]);
    });

    it('las funciones de una cama son sólo funciones de cama', () => {
      const codigos = funcionesParaForma(CATALOGO, 'LOC_FORM_BED').map((f) => f.code);
      expect(codigos).toEqual(['SPACE_FN_BED_STANDARD', 'SPACE_FN_BED_ICU', 'SPACE_FN_CRIB', 'SPACE_FN_STRETCHER']);
    });
  });

  describe('tipología', () => {
    it('un Puesto de Salud no admite quirófano ni camas', () => {
      expect(tipologiaAdmite(CATALOGO, 'TYPOLOGY_HEALTH_POST', 'SPACE_FN_OPERATING_ROOM')).toBe(false);
      expect(tipologiaAdmite(CATALOGO, 'TYPOLOGY_HEALTH_POST', 'SPACE_FN_BED_STANDARD')).toBe(false);
      expect(tipologiaAdmite(CATALOGO, 'TYPOLOGY_HEALTH_POST', 'SPACE_FN_CONSULTING_ROOM')).toBe(true);
    });

    it('una tipología sin lista blanca no restringe', () => {
      expect(tipologiaAdmite(CATALOGO, 'TYPOLOGY_HOSPITAL_L2', 'SPACE_FN_OPERATING_ROOM')).toBe(true);
      expect(tipologiaAdmite(CATALOGO, null, 'SPACE_FN_OPERATING_ROOM')).toBe(true);
    });

    it('lista las funciones obligatorias que faltan', () => {
      expect(funcionesObligatoriasFaltantes(CATALOGO, 'TYPOLOGY_HOSPITAL_L2', ARBOL)).toEqual([
        'SPACE_FN_EMERGENCY_BOX',
        'SPACE_FN_OPERATING_ROOM',
      ]);
    });
  });

  describe('árbol', () => {
    it('arma N niveles a partir de la lista plana', () => {
      const arbol = armarArbol(ARBOL);
      expect(arbol.map((n) => n.item.id)).toEqual(['bld']);
      let nivel = arbol[0]!;
      const camino = [nivel.item.id];
      while (nivel.children.length > 0) {
        nivel = nivel.children.find((c) => c.item.id !== 'lvl2')!;
        camino.push(nivel.item.id);
      }
      expect(camino).toEqual(['bld', 'wing', 'lvl', 'ward', 'room', 'bed']);
    });

    it('ordena hermanos por código con orden numérico', () => {
      const arbol = armarArbol([espacio('h10', null, 'ROOM'), espacio('h9', null, 'ROOM'), espacio('h301', null, 'ROOM')]);
      expect(arbol.map((n) => n.item.id)).toEqual(['h9', 'h10', 'h301']);
    });

    it('un huérfano sube a la raíz y un ciclo no cuelga el armado', () => {
      const arbol = armarArbol([espacio('a', 'b', 'ROOM'), espacio('b', 'a', 'ROOM'), espacio('c', 'zzz', 'ROOM')]);
      expect(arbol.map((n) => n.item.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('calcula los descendientes', () => {
      expect([...descendientesDe(ARBOL, 'lvl')].sort()).toEqual(['bed', 'room', 'ward']);
    });
  });

  describe('padres válidos para mover', () => {
    it('una cama puede ir a un local o a una sala, nunca a sí misma', () => {
      const { incluyeRaiz, padres } = padresValidos(CATALOGO, ARBOL, 'LOC_FORM_BED', 'bed');
      expect(incluyeRaiz).toBe(false);
      expect(padres.map((p) => p.id).sort()).toEqual(['room', 'ward']);
    });

    it('excluye los descendientes (sería un ciclo) y los suspendidos', () => {
      const { padres } = padresValidos(CATALOGO, ARBOL, 'LOC_FORM_LEVEL', 'lvl');
      // Un piso cuelga de edificio o pabellón; el pabellón es su padre actual y sigue valiendo.
      expect(padres.map((p) => p.id).sort()).toEqual(['bld', 'wing']);
      const sala = padresValidos(CATALOGO, ARBOL, 'LOC_FORM_WARD', 'ward');
      expect(sala.padres.map((p) => p.id)).not.toContain('lvl2');
    });

    it('un edificio puede volver a la raíz', () => {
      expect(padresValidos(CATALOGO, ARBOL, 'LOC_FORM_BUILDING', 'bld').incluyeRaiz).toBe(true);
    });
  });

  describe('patrón de alta masiva', () => {
    it('expande letras: 301-{A..H}', () => {
      const r = expandirPatron('301-{A..H}');
      expect(r).toEqual({ ok: true, valores: ['301-A', '301-B', '301-C', '301-D', '301-E', '301-F', '301-G', '301-H'] });
    });

    it('expande números y conserva ceros a la izquierda', () => {
      expect(expandirPatron('CAMA-{1..3}')).toEqual({ ok: true, valores: ['CAMA-1', 'CAMA-2', 'CAMA-3'] });
      expect(expandirPatron('C-{08..10}')).toEqual({ ok: true, valores: ['C-08', 'C-09', 'C-10'] });
    });

    it('rechaza patrones sin rango, con dos rangos, invertidos o mezclados', () => {
      expect(expandirPatron('301').ok).toBe(false);
      expect(expandirPatron('{A..B}-{1..2}').ok).toBe(false);
      expect(expandirPatron('{H..A}').ok).toBe(false);
      expect(expandirPatron('{A..9}').ok).toBe(false);
      expect(expandirPatron('').ok).toBe(false);
    });

    it(`no pasa del tope de ${MAX_ALTA_MASIVA}`, () => {
      const r = expandirPatron('X-{1..201}');
      expect(r.ok).toBe(false);
      expect(expandirPatron('X-{1..200}').ok).toBe(true);
    });

    it('nombres: con rango propio deben coincidir; sin rango se completan', () => {
      expect(nombresDelAltaMasiva('301-{A..C}', 'Cama 301-{A..C}')).toEqual({ ok: true, valores: ['Cama 301-A', 'Cama 301-B', 'Cama 301-C'] });
      expect(nombresDelAltaMasiva('301-{A..B}', 'Cama')).toEqual({ ok: true, valores: ['Cama A', 'Cama B'] });
      expect(nombresDelAltaMasiva('301-{A..C}', 'Cama {1..2}').ok).toBe(false);
    });
  });

  describe('CSV', () => {
    it('respeta comillas y comillas escapadas', () => {
      expect(partirLineaCsv('a,"b, c","d ""e"""', ',')).toEqual(['a', 'b, c', 'd "e"']);
    });

    it('parsea con encabezado en español, separador ; y códigos cortos', () => {
      const r = parsearCsv('codigo;nombre;forma;funcion;padre;superficie\n401;Habitación 401;ROOM;INPATIENT_ROOM;A-PN-P3-SI;18,5\n401-A;Cama 401-A;bed;bed_standard;401;');
      expect(r.errors).toEqual([]);
      expect(r.rows).toEqual([
        { line: 2, code: '401', name: 'Habitación 401', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_INPATIENT_ROOM', parentCode: 'A-PN-P3-SI', areaM2: 18.5 },
        { line: 3, code: '401-A', name: 'Cama 401-A', formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', parentCode: '401' },
      ]);
    });

    it('informa por línea del archivo los campos obligatorios vacíos y números inválidos', () => {
      const r = parsearCsv('code,name,form,function,capacity\nA,,ROOM,GENERIC,\nB,Bien,ROOM,GENERIC,dos');
      expect(r.rows).toEqual([]);
      expect(r.errors).toEqual([
        { line: 2, field: 'name', reason: 'Campo obligatorio vacío.' },
        { line: 3, field: 'capacity', reason: '«dos» no es un número.' },
      ]);
    });

    it('falla el encabezado sin las columnas obligatorias', () => {
      const r = parsearCsv('code,name\nA,B');
      expect(r.rows).toEqual([]);
      expect(r.errors[0]).toEqual({ line: 1, field: 'formCode, functionCode', reason: 'Faltan columnas obligatorias en el encabezado.' });
    });

    it('avisa de columnas desconocidas y de archivos vacíos', () => {
      expect(parsearCsv('').errors[0]?.reason).toBe('El archivo está vacío.');
      const r = parsearCsv('code,name,form,function,color\nA,B,ROOM,GENERIC,rojo');
      expect(r.rows).toHaveLength(1);
      expect(r.errors).toEqual([{ line: 1, field: 'color', reason: 'Columna desconocida: se ignora.' }]);
    });

    it('ignora el BOM y las líneas en blanco', () => {
      const r = parsearCsv('﻿code,name,form,function\n\nA,B,ROOM,GENERIC\n');
      expect(r.rows.map((x) => x.line)).toEqual([3]);
    });
  });

  describe('bloqueos de retiro', () => {
    const error409 = new HttpErrorResponse({
      status: 409,
      error: {
        code: 'CONFLICT',
        reason: 'SPACE_RETIRE_BLOCKED',
        message: 'bloqueado',
        details: {
          blockers: [
            { kind: 'ACTIVE_CHILDREN', count: 2, sampleIds: ['a', 'b'], nextAction: { label: 'Mover los hijos', route: '/x' } },
            { kind: 'EQUIPMENT', count: 1, sampleIds: [], nextAction: 'Reubicar el tomógrafo' },
            { kind: 'INVENTORY_LOCATION', count: 1 },
          ],
        },
      },
    });

    it('lee los bloqueos del 409 SPACE_RETIRE_BLOCKED por reason, no por mensaje', () => {
      const bloqueos = bloqueosDelError(error409)!;
      expect(bloqueos).toHaveLength(3);
      expect(bloqueos[0]!.nextAction).toEqual({ label: 'Mover los hijos', route: '/x' });
    });

    it('normaliza la próxima acción en texto y la completa si falta (S3 nunca sin salida)', () => {
      const bloqueos = bloqueosDelError(error409)!;
      expect(bloqueos[1]!.nextAction).toEqual({ label: 'Reubicar el tomógrafo' });
      expect(bloqueos[2]!.nextAction.label).toBe('Trasladar el stock a otro depósito');
      expect(bloqueos[2]!.sampleIds).toEqual([]);
    });

    it('otro error no es una lista de bloqueos', () => {
      expect(bloqueosDelError(new HttpErrorResponse({ status: 409, error: { code: 'CONFLICT', reason: 'SPACE_CODE_TAKEN' } }))).toBeNull();
      expect(bloqueosDelError(new Error('x'))).toBeNull();
      expect(normalizarBloqueos('nada')).toEqual([]);
    });

    it('lee reason también desde details (formato viejo)', () => {
      const leido = leerErrorDeInfraestructura(new HttpErrorResponse({ status: 422, error: { code: 'PRECONDITION_FAILED', details: { reason: 'SPACE_CYCLE' } } }));
      expect(leido?.reason).toBe('SPACE_CYCLE');
    });
  });

  describe('reflejo de permisos (la API decide)', () => {
    it('sólo ofrece escritura a SECURITY_ADMIN (el token ya no dice quién es dueño)', () => {
      expect(ofrecerEscritura(['SECURITY_ADMIN'])).toBe(true);
      expect(ofrecerEscritura(['PRACTITIONER'])).toBe(false);
      expect(ofrecerEscritura([])).toBe(false);
    });
  });
});
