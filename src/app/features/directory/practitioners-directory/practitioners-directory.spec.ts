import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PractitionersDirectory, type GrupoDeEspecialidad } from './practitioners-directory';

/**
 * La guía de profesionales (carril R2-1).
 *
 * El cliente pidió una **guía telefónica agrupada por especialidad**, y el
 * carril fija tres cosas que se cumplen literal o el punto no está hecho.
 * Estas pruebas son esas tres, más lo que degrada:
 *
 * 1. **Están todos**: se agota el cursor al abrir, sin escribir nada.
 * 2. **La especialidad es el encabezado**, y quien ejerce dos aparece en las
 *    dos — es lo que hace una guía.
 * 3. El buscador **filtra encima**, nunca es la puerta de entrada.
 */

const FILA = {
  profileId: 'per-1',
  practitionerCode: 'MED-1',
  displayName: 'Dra. Lucía Salas',
  professionalTitle: 'Cardióloga',
  verificationStatusConceptId: 'st-ok',
  acceptsNewPatients: true,
  telehealthAvailable: false,
  specialties: [{ specialtyConceptId: 'esp-cardio', isPrimary: true }],
};

const OTRA = {
  ...FILA,
  profileId: 'per-2',
  practitionerCode: 'MED-2',
  displayName: 'Dr. Andrés Peña',
  professionalTitle: 'Pediatra',
  acceptsNewPatients: false,
  specialties: [{ specialtyConceptId: 'esp-pediatria', isPrimary: true }],
};

const CONCEPTOS = {
  items: [
    {
      conceptId: 'esp-cardio',
      code: 'CARDIOLOGY',
      display: 'Cardiología',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'esp-pediatria',
      code: 'PEDIATRICS',
      display: 'Pediatría',
      codeSystemVersionId: 'csv-1',
    },
  ],
  count: 2,
  limit: 200,
};

describe('PractitionersDirectory', () => {
  let componente: PractitionersDirectory;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function montar(): void {
    componente = TestBed.createComponent(PractitionersDirectory).componentInstance;
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible del componente.
   *
   * Aparte de `interno` porque aquél **liga** lo que devuelve, y una señal es
   * una función: `bind()` produce una copia sin `.set`.
   */
  function senal<T>(nombre: string): { (): T; set(valor: T): void } {
    return (componente as unknown as Record<string, { (): T; set(valor: T): void }>)[nombre];
  }

  function grupos(): readonly GrupoDeEspecialidad[] {
    return interno<() => readonly GrupoDeEspecialidad[]>('grupos')();
  }

  /** Responde una página de la guía y después el catálogo. */
  function responder(items: object[], nextCursor: string | null = null): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners')
      .flush({ items, count: items.length, limit: 50, nextCursor });
  }

  function responderConceptos(conceptos: object = CONCEPTOS): void {
    http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
  }

  /* -- 1 · Están todos, sin escribir nada ---------------------------------- */

  it('carga la guía al abrir, sin que nadie escriba nada', () => {
    montar();
    responder([FILA, OTRA]);
    responderConceptos();

    expect(grupos()).toHaveLength(2);
    expect(interno<() => number>('total')()).toBe(2);
  });

  /**
   * «Todos los doctores» significa agotar el cursor: con una sola página la
   * guía mostraría los primeros cincuenta y nada más.
   */
  it('agota el cursor: sigue pidiendo mientras haya páginas', () => {
    montar();
    responder([FILA], 'cursor-2');
    responder([OTRA], null);
    responderConceptos();

    expect(interno<() => number>('total')()).toBe(2);
  });

  /* -- 2 · La especialidad es el encabezado -------------------------------- */

  it('agrupa por especialidad con su nombre traducido', () => {
    montar();
    responder([FILA, OTRA]);
    responderConceptos();

    const nombres = grupos().map((g) => g.nombre);
    // Alfabético: una guía se hojea, no se ordena por cuántos tiene cada una.
    expect(nombres).toEqual(['Cardiología', 'Pediatría']);
  });

  /**
   * F-25 (18/08/2026): tres tarjetas de la Guía mostraban como subtítulo el
   * nombre de OTRO profesional. El dato cruzado lo arregla FX-4 en el seeder;
   * este es el guardia de la vista, que no depende de eso.
   */
  it('una tarjeta nunca muestra el nombre de otro como subtítulo (F-25)', () => {
    montar();
    responder([
      { ...FILA, displayName: 'Ana Lucía Flores', professionalTitle: 'Dr. Andrés Peña — Pediatría' },
      OTRA,
    ]);
    responderConceptos();

    const tarjetas = grupos().flatMap((g: GrupoDeEspecialidad) => g.profesionales);
    const cruzada = tarjetas.find((t) => t.title === 'Ana Lucía Flores');

    expect(cruzada, 'la tarjeta cruzada debería estar en la guía').toBeDefined();
    // Sin subtítulo: más pobre, pero no miente sobre quién es quién.
    expect(cruzada?.meta ?? []).toEqual([]);
    // Y el resto conserva el suyo, que es legítimo.
    const sana = tarjetas.find((t) => t.title === 'Dr. Andrés Peña');
    expect(sana?.meta?.[0]?.text).toBe('Pediatra');
  });

  /** Quien ejerce dos especialidades figura bajo las dos. */
  it('un profesional con dos especialidades aparece en las dos', () => {
    montar();
    responder([
      {
        ...FILA,
        specialties: [
          { specialtyConceptId: 'esp-cardio', isPrimary: true },
          { specialtyConceptId: 'esp-pediatria', isPrimary: false },
        ],
      },
    ]);
    responderConceptos();

    expect(grupos()).toHaveLength(2);
    for (const grupo of grupos()) {
      expect(grupo.profesionales.map((p) => p.id)).toContain('per-1');
    }
  });

  /** Sin especialidad declarada existe igual: va a un grupo propio, al final. */
  it('quien no declara especialidad va a un grupo propio al final', () => {
    montar();
    responder([FILA, { ...OTRA, specialties: [] }]);
    responderConceptos();

    const ultimo = grupos().at(-1);
    expect(ultimo?.conceptId).toBe('sin-especialidad');
    expect(ultimo?.profesionales.map((p) => p.id)).toEqual(['per-2']);
  });

  /** El catálogo caído deja los encabezados sin nombre, no la guía sin gente. */
  it('un fallo del catálogo no deja a nadie fuera de la guía', () => {
    montar();
    responder([FILA]);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

    expect(interno<() => number>('total')()).toBe(1);
    expect(grupos()[0].nombre).toBe('Sin especialidad registrada');
  });

  /* -- 3 · El buscador filtra encima --------------------------------------- */

  it('el buscador filtra la guía ya cargada, por nombre', () => {
    montar();
    responder([FILA, OTRA]);
    responderConceptos();

    senal<string>('filtro').set('lucía');

    expect(grupos()).toHaveLength(1);
    expect(grupos()[0].profesionales[0].title).toBe('Dra. Lucía Salas');
  });

  it('el buscador también encuentra por el título profesional', () => {
    montar();
    responder([FILA, OTRA]);
    responderConceptos();

    senal<string>('filtro').set('pediatra');

    expect(interno<() => number>('total')()).toBe(1);
  });

  it('el código interno del profesional no se muestra ni filtra: el paciente no lo conoce', () => {
    // Feedback de la analista (F-01, 18/08/2026): las tarjetas decían
    // «Código MED-…». Es un identificador de sistema; la Guía es sólo del
    // paciente y no hay a quién mostrárselo por rol. El DTO lo sigue trayendo.
    montar();
    responder([FILA, OTRA]);
    responderConceptos();

    const lineas = grupos().flatMap((g) => g.profesionales.flatMap((p) => p.meta ?? []));
    expect(lineas.some((linea) => /MED-|Código/.test(linea.text))).toBe(false);

    senal<string>('filtro').set('med-1');
    expect(interno<() => number>('total')()).toBe(0);
  });

  /**
   * Sin coincidencias NO es lo mismo que sin guía: el estado vacío tiene que
   * poder decir cuál de los dos es.
   */
  it('distingue «el filtro no encontró» de «no hay guía»', () => {
    montar();
    responder([FILA]);
    responderConceptos();

    expect(interno<() => boolean>('sinCoincidencias')()).toBe(false);

    senal<string>('filtro').set('nadie con este nombre');

    expect(interno<() => boolean>('sinCoincidencias')()).toBe(true);
  });

  /* -- La traducción a la tarjeta ------------------------------------------ */

  it('la disponibilidad se dice con palabras, no sólo con color', () => {
    montar();
    responder([FILA, OTRA]);
    responderConceptos();

    const sellos = (etiqueta: string) =>
      grupos()
        .flatMap((g) => g.profesionales)
        .flatMap((p) => p.seals ?? [])
        .some((s) => s.label === etiqueta);

    expect(sellos('Acepta pacientes nuevos')).toBe(true);
    expect(sellos('No toma pacientes nuevos')).toBe(true);
  });

  it('el clic lleva a la ficha del profesional', () => {
    montar();
    responder([FILA]);
    responderConceptos();

    expect(grupos()[0].profesionales[0].link).toBe('/directory/per-1');
  });
});
