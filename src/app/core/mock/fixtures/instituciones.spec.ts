import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PHARMACIES_AND_LABS, PRIMARY_CARE_CENTERS } from './markdown-institutions.generated';

import {
  ASEGURADORAS_DE_SALUD,
  SEMILLAS_DE_INSTITUCIONES,
  institucionPorSlug,
  ubicacionAproximada,
} from './instituciones';
import {
  ASEGURADORAS_REALES,
  CLINICAS_REALES,
  HOSPITALES_REALES,
  INSTITUCIONES_META,
} from './instituciones.generated';

/* ============================================================================
    Las instituciones del simulador salen de `data/bolivia-instituciones/`, y
    esta prueba es lo que impide que se separen.

    Pero sobre todo vigila lo que no se puede inventar. Estas son clínicas,
    hospitales y aseguradoras que **existen**, con NIT y dirección: una nota
    media fabricada, un servicio que no prestan o un sello de verificado que
    nadie otorgó son afirmaciones sobre alguien que puede leerlas.
    ========================================================================== */

const DATOS = join(process.cwd(), 'data', 'bolivia-instituciones');

function leer<T>(nombre: string): T {
  return JSON.parse(readFileSync(join(DATOS, `${nombre}.json`), 'utf8')) as T;
}

describe('las instituciones de salud reales portadas al simulador', () => {
  it('trae tantas como declara su propio manifiesto', () => {
    const { counts } = leer<{ counts: Record<string, number> }>('manifest');
    expect(CLINICAS_REALES).toHaveLength(counts['clinics']!);
    expect(HOSPITALES_REALES).toHaveLength(counts['hospitals']!);
    expect(ASEGURADORAS_REALES).toHaveLength(counts['insurers']!);
    // Más las 7 farmacias y los 464 centros de primer nivel de
    // `markdown_convertidos/` (ver `markdown-institutions.generated.ts`).
    expect(SEMILLAS_DE_INSTITUCIONES).toHaveLength(
      counts['clinics']! +
        counts['hospitals']! +
        counts['insurers']! +
        PHARMACIES_AND_LABS.filter((f) => f.kind === 'PHARMACY').length +
        PRIMARY_CARE_CENTERS.length,
    );
  });

  it('no deja dos instituciones con el mismo enlace', () => {
    const slugs = SEMILLAS_DE_INSTITUCIONES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(institucionPorSlug(slugs[0]!)?.slug).toBe(slugs[0]);
    expect(institucionPorSlug('no-existe')).toBeUndefined();
  });

  it('le da un punto en el mapa a todas', () => {
    for (const semilla of SEMILLAS_DE_INSTITUCIONES) {
      // Bolivia va de ~9,7° a ~22,9° de latitud sur y de ~57,5° a ~69,7° oeste.
      expect(semilla.lat).toBeGreaterThan(-23);
      expect(semilla.lat).toBeLessThan(-9);
      expect(semilla.lng).toBeGreaterThan(-70);
      expect(semilla.lng).toBeLessThan(-57);
    }
  });

  it('dice cuándo el punto es el centro de la ciudad y no la dirección', () => {
    // Mandar a alguien a una dirección que no es, en salud, es peor que no
    // dibujar el mapa. La ficha necesita poder avisarlo.
    expect(ubicacionAproximada('ciudad')).toBe(true);
    expect(ubicacionAproximada('via')).toBe(false);
    expect(ubicacionAproximada('direccion')).toBe(false);
    expect(SEMILLAS_DE_INSTITUCIONES.some((s) => ubicacionAproximada(s.precision))).toBe(true);
  });

  /* ---- lo que no se inventa --------------------------------------------- */

  it('no le fabrica opiniones ni sello de verificado a nadie', () => {
    // `verified` es «lo verificó la plataforma». Salen de una planilla.
    for (const semilla of SEMILLAS_DE_INSTITUCIONES) {
      expect(semilla.verified).toBe(false);
    }
  });

  it('deja en null lo que la planilla no declara, sin rellenarlo', () => {
    const sinRazonSocial = CLINICAS_REALES.filter((c) => c.legalName === null);
    expect(sinRazonSocial.length).toBeGreaterThan(0);
    for (const clinica of sinRazonSocial) {
      expect(clinica.legalName).toBeNull();
      // Y su biografía no se la inventa: dice lo genérico y verdadero.
      const semilla = SEMILLAS_DE_INSTITUCIONES.find((s) => s.displayName === clinica.name)!;
      expect(semilla.biography).not.toContain('null');
      expect(semilla.biography).not.toContain('undefined');
    }
  });

  it('separa las aseguradoras de salud de las patrimoniales', () => {
    // Poner «Seguros Illimani» en un directorio médico sería falso.
    expect(ASEGURADORAS_DE_SALUD.length).toBeGreaterThan(0);
    expect(ASEGURADORAS_DE_SALUD.length).toBeLessThan(ASEGURADORAS_REALES.length);
    for (const aseguradora of ASEGURADORAS_DE_SALUD) {
      expect(aseguradora.branch).toBe('personas');
      expect(aseguradora.coversHealth).toBe(true);
    }
    const generales = ASEGURADORAS_REALES.filter((a) => !a.coversHealth);
    for (const aseguradora of generales) {
      // Por su clave y no por el nombre: BISA y Fortaleza tienen el mismo
      // nombre en los dos ramos, y buscar por nombre devolvía la de salud.
      const semilla = SEMILLAS_DE_INSTITUCIONES.find((s) => s.clave === `institucion-${aseguradora.id}`)!;
      expect(semilla.headline).toContain('no cubre salud');
    }
  });

  it('trae los 464 centros de primer nivel, cada uno con su aviso de ubicación', () => {
    // Antes quedaban afuera; el propietario pidió todos los datos (18/09/2026).
    const primerNivel = SEMILLAS_DE_INSTITUCIONES.filter((s) => s.headline.startsWith('Centro de salud de primer nivel'));
    expect(primerNivel).toHaveLength(464);
    for (const centro of primerNivel) {
      expect(ubicacionAproximada(centro.precision)).toBe(true);
      expect(centro.biography).toContain('Ubicación aproximada');
    }
  });

  it('declara su alcance y sus advertencias, para poder citarlas', () => {
    expect(INSTITUCIONES_META.scope).toContain('Santa Cruz');
    expect(INSTITUCIONES_META.warnings.length).toBeGreaterThan(0);
    expect(INSTITUCIONES_META.warnings.join(' ')).toContain('coordenadas');
  });

  it('usa los nombres reales y no los inventados que reemplaza', () => {
    const nombres = SEMILLAS_DE_INSTITUCIONES.map((s) => s.displayName).join(' | ');
    // Con el nombre completo: hay un centro de primer nivel real llamado
    // «Los Olivos», y ése sí va.
    for (const inventado of ['Clínica Los Olivos', 'Hospital San Lucas', 'Clínica Nueva Esperanza']) {
      expect(nombres).not.toContain(inventado);
    }
    expect(nombres).toContain('Foianini');
  });
});
