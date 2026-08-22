import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PrescriptionFavoritesClient } from './prescription-favorites.client';
import type { PrescriptionFavorite } from './prescription-favorites.types';

/**
 * Las respuestas se fabrican con la forma que **el servidor manda de verdad**,
 * no con la que el tipo de la vista promete: los opcionales vacíos como `null`
 * y `quantityDecimal` como texto (columna `numeric`). Fabricarlas con la forma
 * supuesta es exactamente el defecto que documenta la cabecera de `wire.ts`, y
 * dejaría la normalización sin nadie que la desmienta.
 */
const FAVORITO_COMPLETO = {
  id: 'fav-1',
  name: 'ATB post extracción',
  medicationConceptId: 'med-1',
  substanceAtcConceptId: 'atc-1',
  doseText: '500 mg',
  routeConceptId: 'via-1',
  frequencyText: 'cada 8 horas',
  quantityDecimal: '21',
  unitConceptId: 'uni-1',
  patientInstructionsText: 'Con las comidas',
};

/** El mismo favorito con todo lo opcional vacío, como llega: en `null`. */
const FAVORITO_PELADO = {
  id: 'fav-2',
  name: 'Analgesia simple',
  medicationConceptId: 'med-2',
  substanceAtcConceptId: null,
  doseText: null,
  routeConceptId: null,
  frequencyText: null,
  quantityDecimal: null,
  unitConceptId: null,
  patientInstructionsText: null,
};

describe('PrescriptionFavoritesClient', () => {
  let client: PrescriptionFavoritesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(PrescriptionFavoritesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('listOwn', () => {
    it('pide la lista propia sin parámetros ni identificador de profesional', () => {
      client.listOwn().subscribe();

      const req = http.expectOne((r) => r.url === '/prescription-favorites');
      expect(req.request.method).toBe('GET');
      // El dueño lo deduce el servidor de la sesión: si el cliente lo mandara,
      // habría una segunda fuente de verdad sobre de quién es la lista.
      expect(req.request.params.keys()).toEqual([]);

      req.flush([]);
    });

    it('devuelve el array completo respetando el orden del servidor', () => {
      let recibidos: readonly PrescriptionFavorite[] | undefined;
      client.listOwn().subscribe((r) => (recibidos = r));

      http
        .expectOne((r) => r.url === '/prescription-favorites')
        .flush([FAVORITO_PELADO, FAVORITO_COMPLETO]);

      // Ordenado por rótulo por la API; el cliente no reordena.
      expect(recibidos?.map((f) => f.name)).toEqual([
        'Analgesia simple',
        'ATB post extracción',
      ]);
    });

    it('convierte quantityDecimal de texto a número', () => {
      let recibidos: readonly PrescriptionFavorite[] | undefined;
      client.listOwn().subscribe((r) => (recibidos = r));

      http
        .expectOne((r) => r.url === '/prescription-favorites')
        .flush([{ ...FAVORITO_COMPLETO, quantityDecimal: '1.500' }]);

      const cantidad = recibidos?.[0]?.quantityDecimal;
      expect(cantidad).toBe(1.5);
      expect(typeof cantidad).toBe('number');
    });

    it('quita las claves que llegaron en null en vez de dejarlas', () => {
      let recibidos: readonly PrescriptionFavorite[] | undefined;
      client.listOwn().subscribe((r) => (recibidos = r));

      http.expectOne((r) => r.url === '/prescription-favorites').flush([FAVORITO_PELADO]);

      const favorito = recibidos?.[0];
      expect(favorito).toEqual({
        id: 'fav-2',
        name: 'Analgesia simple',
        medicationConceptId: 'med-2',
      });
      // No basta con que valgan `undefined`: la clave no debe existir, para que
      // `'x' in favorito` y `Object.keys()` digan lo mismo que el tipo.
      expect('doseText' in (favorito as object)).toBe(false);
      expect('quantityDecimal' in (favorito as object)).toBe(false);
    });

    it('descarta una cantidad que no es un número en vez de propagar NaN', () => {
      let recibidos: readonly PrescriptionFavorite[] | undefined;
      client.listOwn().subscribe((r) => (recibidos = r));

      http
        .expectOne((r) => r.url === '/prescription-favorites')
        .flush([{ ...FAVORITO_COMPLETO, quantityDecimal: 'media caja' }]);

      // `NaN` viajaría de vuelta en el cuerpo de la próxima receta y recién ahí
      // lo rechazaría el `@IsNumber()` del DTO.
      expect('quantityDecimal' in (recibidos?.[0] as object)).toBe(false);
    });
  });

  describe('create', () => {
    it('manda el cuerpo completo y devuelve el favorito ya normalizado', () => {
      let creado: PrescriptionFavorite | undefined;
      client
        .create({
          name: 'ATB post extracción',
          medicationConceptId: 'med-1',
          substanceAtcConceptId: 'atc-1',
          doseText: '500 mg',
          routeConceptId: 'via-1',
          frequencyText: 'cada 8 horas',
          quantityDecimal: 21,
          unitConceptId: 'uni-1',
          patientInstructionsText: 'Con las comidas',
        })
        .subscribe((r) => (creado = r));

      const req = http.expectOne((r) => r.url === '/prescription-favorites');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'ATB post extracción',
        medicationConceptId: 'med-1',
        substanceAtcConceptId: 'atc-1',
        doseText: '500 mg',
        routeConceptId: 'via-1',
        frequencyText: 'cada 8 horas',
        quantityDecimal: 21,
        unitConceptId: 'uni-1',
        patientInstructionsText: 'Con las comidas',
      });
      // Numérica al ir, aunque vuelva como texto: el DTO la valida con
      // `@IsNumber()` y un `'21'` sería 400.
      expect(typeof (req.request.body as Record<string, unknown>)['quantityDecimal']).toBe(
        'number',
      );

      req.flush(FAVORITO_COMPLETO);
      expect(creado?.quantityDecimal).toBe(21);
    });

    it('no manda las claves que no se cargaron', () => {
      client
        .create({ name: 'Analgesia simple', medicationConceptId: 'med-2' })
        .subscribe();

      const req = http.expectOne((r) => r.url === '/prescription-favorites');
      // El backend valida con `forbidNonWhitelisted`: una clave declarada en
      // `undefined` viaja como clave presente y vuelve 400.
      expect(req.request.body).toEqual({
        name: 'Analgesia simple',
        medicationConceptId: 'med-2',
      });
      expect(Object.keys(req.request.body as object)).toEqual([
        'name',
        'medicationConceptId',
      ]);

      req.flush(FAVORITO_PELADO);
    });

    it('no manda las claves que se cargaron y se borraron', () => {
      client
        .create({
          name: 'Analgesia simple',
          medicationConceptId: 'med-2',
          doseText: undefined,
          quantityDecimal: undefined,
        })
        .subscribe();

      const req = http.expectOne((r) => r.url === '/prescription-favorites');
      expect('doseText' in (req.request.body as object)).toBe(false);
      expect('quantityDecimal' in (req.request.body as object)).toBe(false);

      req.flush(FAVORITO_PELADO);
    });
  });

  describe('remove', () => {
    it('borra por id y no devuelve cuerpo', () => {
      let completado = false;
      let recibido: unknown = 'sin emitir';
      client.remove('fav-1').subscribe({
        next: (r) => {
          recibido = r;
        },
        complete: () => (completado = true),
      });

      const req = http.expectOne((r) => r.url === '/prescription-favorites/fav-1');
      expect(req.request.method).toBe('DELETE');

      // 204 sin cuerpo, como responde el controlador.
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(recibido).toBeUndefined();
      expect(completado).toBe(true);
    });

    it('escapa el id en la ruta', () => {
      client.remove('fav/1 raro').subscribe();

      const req = http.expectOne(
        (r) => r.url === `/prescription-favorites/${encodeURIComponent('fav/1 raro')}`,
      );
      expect(req.request.method).toBe('DELETE');

      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
