import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FARMACIAS_DEL_CORPUS,
  LABORATORIOS_DEL_CORPUS,
  SEMILLAS_DE_VITRINA,
  pruebaDelCorpus,
  vigenciaDe,
} from './bolivia-eje-central';
import {
  CADENAS_DEL_CORPUS,
  CATEGORIAS_DEL_CORPUS,
  ESTABLECIMIENTOS_DEL_CORPUS,
  PRUEBAS_DEL_CORPUS,
  RELACIONES_DEL_CORPUS,
  SUCURSALES_DEL_CORPUS,
  CORPUS_META,
} from './bolivia-eje-central.generated';

/* ============================================================================
    El corpus «Bolivia Salud · Eje Central» del simulador sale de
    `data/bolivia-salud-eje-central/`, y esta prueba es lo que impide que se
    separen.

    Es la misma clase de defecto que ya mordió con las fichas clínicas: un
    fixture portado a mano que se queda atrás de su fuente y nadie se entera,
    porque la pantalla sigue dibujando algo. Acá el «algo» serían laboratorios
    que no existen o sucursales que cerraron, que es peor que una pantalla
    vacía.

    Si alguien toca el corpus y no corre `yarn mock:bolivia`, los conteos dejan
    de cuadrar contra el disco y esto lo dice.
    ========================================================================== */

const CORPUS = join(process.cwd(), 'data', 'bolivia-salud-eje-central');

function leer<T>(...partes: string[]): T {
  return JSON.parse(readFileSync(join(CORPUS, ...partes), 'utf8')) as T;
}

describe('el corpus Bolivia · Eje Central portado al simulador', () => {
  it('trae tantos registros como declara su propio manifiesto', () => {
    const manifiesto = leer<{ conteos: Record<string, number> }>('manifest.json');

    expect(ESTABLECIMIENTOS_DEL_CORPUS.length).toBe(manifiesto.conteos['laboratorios_centros']);
    expect(CADENAS_DEL_CORPUS.length).toBe(manifiesto.conteos['cadenas_farmacias']);
    expect(PRUEBAS_DEL_CORPUS.length).toBe(manifiesto.conteos['pruebas_medicas_normalizadas']);
    expect(CATEGORIAS_DEL_CORPUS.length).toBe(manifiesto.conteos['categorias_pruebas']);
    expect(SUCURSALES_DEL_CORPUS.length).toBe(
      manifiesto.conteos['sucursales_laboratorios'] +
        manifiesto.conteos['registros_sucursales_farmacia'],
    );
  });

  it('conserva la fecha de corte y lo que el corpus se prohíbe inventar', () => {
    const metodologia = leer<{ criterios_no_inventar: string[] }>(
      'metadata',
      'metodologia.json',
    );

    expect(CORPUS_META.cutoffDate).toBe(leer<{ fecha_corte: string }>('manifest.json').fecha_corte);
    // Si esta lista cambia, cambia lo que la aplicación puede afirmar.
    expect(CORPUS_META.neverInvented).toEqual(metodologia.criterios_no_inventar);
    expect(CORPUS_META.neverInvented).toContain('coordenadas');
  });

  it('no inventa un solo código terminológico', () => {
    // El corpus declara `codigos.LOINC` y `codigos.SNOMED_CT` en `null` para
    // las 1 035 pruebas, y el generador descarta el campo entero. Si algún día
    // reaparece con contenido, tiene que venir de una verificación, no de acá.
    const catalogo = leer<{ pruebas: { codigos: Record<string, unknown> }[] }>(
      'analisis_medicos',
      'catalogo_maestro.json',
    );
    const conCodigo = catalogo.pruebas.filter(
      (prueba) =>
        prueba.codigos['LOINC'] !== null ||
        prueba.codigos['SNOMED_CT'] !== null ||
        (prueba.codigos['otros'] as unknown[]).length > 0,
    );

    expect(conCodigo).toHaveLength(0);
    expect(PRUEBAS_DEL_CORPUS.every((prueba) => !('codes' in prueba))).toBe(true);
  });
});

describe('las ubicaciones, que son capa derivada y no corpus', () => {
  it('cada sucursal tiene punto, y cada punto dice con qué precisión se resolvió', () => {
    const precisiones = ['direccion', 'via', 'zona', 'ciudad'];

    for (const sucursal of SUCURSALES_DEL_CORPUS) {
      expect(Number.isFinite(sucursal.lat)).toBe(true);
      expect(Number.isFinite(sucursal.lng)).toBe(true);
      expect(precisiones).toContain(sucursal.locationPrecision);
    }
  });

  it('todas caen dentro de Bolivia', () => {
    // Bolivia va de ~9,7° a ~22,9° de latitud sur y de ~57,5° a ~69,7° oeste.
    // Un punto fuera de esa caja es un homónimo de otro país colado por el
    // geocodificador, que es exactamente el defecto que ya apareció una vez.
    for (const sucursal of SUCURSALES_DEL_CORPUS) {
      expect(sucursal.lat).toBeGreaterThan(-23);
      expect(sucursal.lat).toBeLessThan(-9);
      expect(sucursal.lng).toBeGreaterThan(-70);
      expect(sucursal.lng).toBeLessThan(-57);
    }
  });
});

describe('los laboratorios que llegan al directorio', () => {
  it('son los diez del corpus, cada uno con sus sedes', () => {
    expect(LABORATORIOS_DEL_CORPUS).toHaveLength(ESTABLECIMIENTOS_DEL_CORPUS.length);

    for (const laboratorio of LABORATORIOS_DEL_CORPUS) {
      expect(laboratorio.sites.length).toBeGreaterThan(0);
      expect(laboratorio.name).not.toBe('');
    }
  });

  it('el catálogo publicado de Plexus son sus 252 pruebas, no una derivación', () => {
    const plexus = LABORATORIOS_DEL_CORPUS.find(
      (laboratorio) => laboratorio.corpusId === 'lab_plexus',
    );

    expect(plexus?.evidenciaDeOferta).toBe('CATALOGO_PUBLICADO');
    expect(plexus?.testIds).toHaveLength(RELACIONES_DEL_CORPUS.length);
  });

  it('los otros nueve declaran que su oferta es derivada, y no la disfrazan', () => {
    const derivados = LABORATORIOS_DEL_CORPUS.filter(
      (laboratorio) => laboratorio.corpusId !== 'lab_plexus',
    );

    expect(derivados).toHaveLength(9);
    for (const laboratorio of derivados) {
      expect(laboratorio.evidenciaDeOferta).toBe('DERIVADA_DE_SERVICIOS');
      // Un laboratorio sin nada que ofrecer no sirve de nada en el directorio:
      // la tabla de servicios tiene que cubrir a los diez.
      expect(laboratorio.testIds.length).toBeGreaterThan(0);
    }
  });

  it('toda prueba ofrecida existe en el catálogo', () => {
    for (const laboratorio of LABORATORIOS_DEL_CORPUS) {
      for (const testId of laboratorio.testIds) {
        expect(pruebaDelCorpus(testId)).toBeDefined();
      }
    }
  });

  it('la toma a domicilio sale de lo que el laboratorio declara, no de una suposición', () => {
    for (const laboratorio of LABORATORIOS_DEL_CORPUS) {
      expect(laboratorio.homeCollection).toBe(laboratorio.services.includes('toma a domicilio'));
    }
  });
});

describe('las farmacias que llegan al directorio', () => {
  it('son las 50 sucursales, no las 5 cadenas', () => {
    const sucursalesDeFarmacia = SUCURSALES_DEL_CORPUS.filter((sucursal) =>
      CADENAS_DEL_CORPUS.some((cadena) => cadena.id === sucursal.parentId),
    );

    expect(FARMACIAS_DEL_CORPUS).toHaveLength(sucursalesDeFarmacia.length);
  });

  it('cada una tiene un slug único, porque es la URL de su ficha', () => {
    const slugs = FARMACIAS_DEL_CORPUS.map((farmacia) => farmacia.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('la vigencia, que es lo que el corpus se niega a afirmar', () => {
  it('distingue lo verificado en 2026 de la línea base histórica', () => {
    const vigencias = SUCURSALES_DEL_CORPUS.map(vigenciaDe);

    // Las tres tienen que aparecer: si alguna desapareciera, o el corpus cambió
    // o la traducción dejó de distinguir, y en los dos casos hay que mirarlo.
    expect(vigencias).toContain('VERIFICADA');
    expect(vigencias).toContain('HISTORICA');
    expect(vigencias).toContain('POR_RECONCILIAR');
  });

  it('una sucursal sin vigencia confirmada nunca sale como verificada', () => {
    for (const farmacia of FARMACIAS_DEL_CORPUS) {
      const semilla = SEMILLAS_DE_VITRINA.find(
        (candidata) => candidata.targetId === farmacia.id,
      );
      expect(semilla?.verified).toBe(farmacia.vigencia === 'VERIFICADA');
    }
  });
});

describe('las fichas públicas del corpus', () => {
  it('son una por laboratorio y una por sucursal de farmacia', () => {
    expect(SEMILLAS_DE_VITRINA).toHaveLength(
      LABORATORIOS_DEL_CORPUS.length + FARMACIAS_DEL_CORPUS.length,
    );
  });

  it('no repiten slug entre sí', () => {
    const slugs = SEMILLAS_DE_VITRINA.map((semilla) => semilla.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('son deterministas: el mismo id en cada carga', () => {
    // Un enlace copiado tiene que seguir abriendo el mismo laboratorio. Los
    // identificadores se derivan del id del corpus con `uuid()`, así que esto
    // falla si alguien los cambia por algo aleatorio.
    const ids = LABORATORIOS_DEL_CORPUS.map((laboratorio) => laboratorio.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });
});
