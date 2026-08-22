import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  CODIGO_CATALOGO_ESPECIALIDADES,
  MedicalSpecialtiesCatalog,
} from './medical-specialties.service';
import type { ValueSetOption } from './terminology.types';

/**
 * El catálogo de especialidades médicas.
 *
 * Lo que estas pruebas fijan, y que un refactor no puede romper en silencio:
 *
 * 1. **Se resuelve por código, no por uuid.** El uuid lo deriva el generador de
 *    seeds y cambia si el paquete se regenera; el código es lo que declara el
 *    modelo.
 * 2. **Un catálogo ausente falla, no devuelve una lista vacía.** «No hay
 *    especialidades» y «no pudimos leer el catálogo» le piden cosas distintas a
 *    quien está completando su perfil.
 * 3. **Se pide una vez.** Dos pantallas lo consumen y no tienen por qué costar
 *    cuatro peticiones.
 */
describe('MedicalSpecialtiesCatalog', () => {
  let http: HttpTestingController;
  let catalogo: MedicalSpecialtiesCatalog;

  const OPCIONES: ValueSetOption[] = [
    {
      conceptId: 'esp-cardio',
      code: 'CARDIOLOGIA',
      display: 'Cardiología',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'esp-pediatria',
      code: 'PEDIATRIA',
      display: 'Pediatría',
      codeSystemVersionId: 'csv-1',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    catalogo = TestBed.inject(MedicalSpecialtiesCatalog);
  });

  afterEach(() => http.verify());

  /** Responde el listado de conjuntos con el catálogo pedido. */
  function responderConjunto(items: readonly object[]): void {
    const pedido = http.expectOne((r) => r.url === '/terminology/value-sets');
    expect(pedido.request.params.get('code')).toBe(CODIGO_CATALOGO_ESPECIALIDADES);
    pedido.flush({ items, count: items.length, limit: 50, nextCursor: null });
  }

  function responderExpansion(opciones: readonly object[]): void {
    http
      .expectOne((r) => r.url.includes('/terminology/value-sets/vs-esp/$expand'))
      .flush({
        valueSetId: 'vs-esp',
        items: opciones,
        count: opciones.length,
        limit: 200,
        nextCursor: null,
      });
  }

  const CONJUNTO = {
    id: 'vs-esp',
    internalCode: CODIGO_CATALOGO_ESPECIALIDADES,
    name: 'Especialidades',
    defaultVersionId: 'v1',
  };

  it('resuelve el catálogo por su código interno y devuelve sus opciones', () => {
    let recibidas: readonly ValueSetOption[] = [];
    catalogo.listar().subscribe((opciones) => (recibidas = opciones));

    responderConjunto([CONJUNTO]);
    responderExpansion(OPCIONES);

    expect(recibidas.map((o) => o.display)).toEqual(['Cardiología', 'Pediatría']);
  });

  it('si el catálogo no está sembrado falla, no devuelve una lista vacía', () => {
    let fallo: unknown = null;
    catalogo.listar().subscribe({ error: (e: unknown) => (fallo = e) });

    responderConjunto([]);

    expect(fallo).toBeInstanceOf(Error);
    // Y no se pide la expansión de nada.
    http.expectNone((r) => r.url.includes('$expand'));
  });

  it('un conjunto con otro código no se toma por el nuestro', () => {
    let fallo: unknown = null;
    catalogo.listar().subscribe({ error: (e: unknown) => (fallo = e) });

    // El backend busca por texto además de por código exacto: si devolviera un
    // parecido, tomarlo sería ofrecer el catálogo equivocado sin decir nada.
    responderConjunto([{ ...CONJUNTO, internalCode: 'VS_MEDICAL_SPECIALTY_OLD' }]);

    expect(fallo).toBeInstanceOf(Error);
  });

  it('descarta los conceptos que no son elegibles', () => {
    let recibidas: readonly ValueSetOption[] = [];
    catalogo.listar().subscribe((opciones) => (recibidas = opciones));

    responderConjunto([CONJUNTO]);
    responderExpansion([...OPCIONES, { ...OPCIONES[0], conceptId: 'grupo', selectable: false }]);

    expect(recibidas).toHaveLength(2);
  });

  it('se pide una sola vez aunque lo consulten dos pantallas', () => {
    catalogo.listar().subscribe();
    responderConjunto([CONJUNTO]);
    responderExpansion(OPCIONES);

    let segundas: readonly ValueSetOption[] = [];
    catalogo.listar().subscribe((opciones) => (segundas = opciones));

    // El `http.verify()` del cierre falla si hubo una segunda ronda.
    expect(segundas).toHaveLength(2);
  });

  it('olvidar deja volver a pedirlo: un fallo cacheado no dura toda la sesión', () => {
    catalogo.listar().subscribe({ error: () => undefined });
    responderConjunto([]);

    catalogo.olvidar();

    let recibidas: readonly ValueSetOption[] = [];
    catalogo.listar().subscribe((opciones) => (recibidas = opciones));
    responderConjunto([CONJUNTO]);
    responderExpansion(OPCIONES);

    expect(recibidas).toHaveLength(2);
  });
});
