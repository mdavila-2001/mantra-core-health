import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { DiagnosticUnitsClient } from '../../../core/data-access/diagnostic-units/diagnostic-units.client';
import type {
  DiagnosticStudy,
  DiagnosticUnitDetail,
  DiagnosticUnitKind,
} from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  AvailabilityProduct,
  AvailabilitySite,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { ProcedureNomenclatureItem } from '../../../core/data-access/services-catalog/services-catalog.types';
import { environment } from '../../../../environments/environment';
import type { SearchOrigin } from '../../nearby-places/search-origin-picker/search-origin-picker.types';
import {
  normalizarCotizacion,
  type CotizacionResultado,
  type PrecioPublicado,
  type VerticalCotizacion,
} from './cotizaciones.logic';

/** Cuántos productos de farmacia se cotizan por búsqueda. */
const TOPE_DE_PRODUCTOS = 20;

/** Cuántas sedes de farmacia devuelve la disponibilidad. */
const TOPE_DE_FARMACIAS = 20;

/** Cuántos centros diagnósticos se abren para buscar el estudio adentro. */
const TOPE_DE_CENTROS = 10;

/** Cuántas prestaciones del arancel de referencia se muestran. */
const TOPE_DE_PRESTACIONES = 25;

/**
 * El rótulo del arancel en UMA. Lo fija el carril (Q-16) y la cabecera de
 * `fee-schedules.generated.ts`: «honorarios médicos del Colegio Médico de Santa
 * Cruz (2025, en UMA)». UMA no es una moneda y no se convierte.
 */
const PROCEDENCIA_UMA = 'Referencia del Colegio Médico de Santa Cruz 2025, en UMA (sin conversión)';

/**
 * La marca de procedencia de lo que sirve el backend simulado.
 *
 * Los precios de farmacia y de estudios de la maqueta salen de los dobles
 * (`pharmacy.handlers.ts`, y una fórmula sintética en `diagnostics.handlers.ts`),
 * aunque lleven nombres de sedes con forma de reales. Sin esta marca la celda
 * atribuiría un precio inventado a una institución con nombre (regla 00 §2.1).
 * El arancel de referencia **no** la lleva: la maqueta sirve la tabla real
 * del propietario (`fee-schedules.generated.ts`).
 */
function deMaqueta(procedencia: string): string {
  return environment.mockBackend ? `${procedencia} · dato de la maqueta` : procedencia;
}

/** Lo que devuelve una búsqueda: las filas y qué fuentes no respondieron. */
export interface BusquedaDeCotizaciones {
  readonly resultados: readonly CotizacionResultado[];
  /** Las verticales cuya fuente falló; las otras se muestran igual. */
  readonly fuentesCaidas: readonly Exclude<VerticalCotizacion, 'TODAS'>[];
}

/**
 * Las cotizaciones del paciente, compuestas de lo que ya existe (N-02, H3.S1.M2
 * alternativa «a»): no hay un endpoint de «cuatro verticales por precio», así
 * que cada vertical sale de su fuente y todas se normalizan a la misma fila.
 *
 * | Vertical | Fuente | Precio | Distancia |
 * |---|---|---|---|
 * | Medicamentos | `GET /pharmacy/products` + `GET /pharmacy-inventory/availability` | lista de precios de cada sede | Haversine desde el origen, la calcula la API |
 * | Análisis / Imagenología | `GET /diagnostic-units/search` + `GET /diagnostic-units/:id` | tarifario publicado del estudio | el contrato no trae coordenadas del centro: `null`, declarado |
 * | Servicios médicos | `GET /billing/service-catalog/procedures` | arancel de referencia, en su unidad | no aplica: es una referencia, no una sede |
 *
 * **Ningún número se escribe acá**: todo importe viene de la respuesta de la
 * fuente, con su unidad y procedencia. Sin importe publicado, la fila dice
 * «Precio no publicado» (regla 97.4.1).
 */
@Injectable({ providedIn: 'root' })
export class CotizacionesFuentes {
  private readonly farmacia = inject(PharmacyClient);
  private readonly diagnostico = inject(DiagnosticUnitsClient);
  private readonly aranceles = inject(ServicesCatalogClient);

  /**
   * Busca un término en una vertical, o en las cuatro a la vez.
   *
   * Con «Todas», las cuatro lecturas salen en paralelo y una fuente caída no
   * tira abajo a las otras: se anota en `fuentesCaidas`. Con una sola
   * vertical, su error se propaga para que la pantalla ofrezca reintentar.
   */
  buscar(
    termino: string,
    vertical: VerticalCotizacion,
    origen: SearchOrigin | null,
  ): Observable<BusquedaDeCotizaciones> {
    if (vertical !== 'TODAS') {
      return this.deVertical(vertical, termino, origen).pipe(
        map((resultados) => ({ resultados, fuentesCaidas: [] })),
      );
    }
    const verticales = ['MEDICAMENTOS', 'ANALISIS', 'IMAGENOLOGIA', 'SERVICIOS_MEDICOS'] as const;
    return forkJoin(
      verticales.map((una) =>
        this.deVertical(una, termino, origen).pipe(
          map((resultados) => ({ una, resultados, caida: false })),
          catchError(() =>
            of({ una, resultados: [] as readonly CotizacionResultado[], caida: true }),
          ),
        ),
      ),
    ).pipe(
      map((partes) => {
        if (partes.every((parte) => parte.caida)) {
          throw new Error('Ninguna fuente de cotizaciones respondió.');
        }
        return {
          resultados: partes.flatMap((parte) => parte.resultados),
          fuentesCaidas: partes.filter((parte) => parte.caida).map((parte) => parte.una),
        };
      }),
    );
  }

  private deVertical(
    vertical: Exclude<VerticalCotizacion, 'TODAS'>,
    termino: string,
    origen: SearchOrigin | null,
  ): Observable<readonly CotizacionResultado[]> {
    switch (vertical) {
      case 'MEDICAMENTOS':
        return this.medicamentos(termino, origen);
      case 'ANALISIS':
        return this.estudios(termino, 'LABORATORY', 'ANALISIS');
      case 'IMAGENOLOGIA':
        return this.estudios(termino, 'IMAGING', 'IMAGENOLOGIA');
      case 'SERVICIOS_MEDICOS':
        return this.serviciosMedicos(termino);
    }
  }

  /** Productos que coinciden → qué sedes los tienen, a qué precio y a qué distancia. */
  private medicamentos(
    termino: string,
    origen: SearchOrigin | null,
  ): Observable<readonly CotizacionResultado[]> {
    return this.farmacia.searchProducts({ search: termino, limit: TOPE_DE_PRODUCTOS }).pipe(
      switchMap((pagina) => {
        const productIds = [...new Set(pagina.items.map((producto) => producto.id))];
        if (productIds.length === 0) {
          return of([]);
        }
        return this.farmacia
          .availability({
            productIds,
            origin: origen === null ? undefined : { lat: origen.lat, lng: origen.lng },
            limit: TOPE_DE_FARMACIAS,
          })
          .pipe(map((disponibilidad) => sinRepetir(disponibilidad.items.flatMap(filasDeSede))));
      }),
    );
  }

  /**
   * Centros del tipo pedido → el estudio que coincide dentro de cada uno.
   *
   * El buscador de centros filtra por nombre del centro, no por estudio, así
   * que se abren los primeros centros publicados —en paralelo— y se buscan
   * sus estudios por nombre o código.
   */
  private estudios(
    termino: string,
    kind: DiagnosticUnitKind,
    vertical: 'ANALISIS' | 'IMAGENOLOGIA',
  ): Observable<readonly CotizacionResultado[]> {
    return this.diagnostico.search({ kind, limit: TOPE_DE_CENTROS }).pipe(
      switchMap((pagina) =>
        pagina.items.length === 0
          ? of([] as DiagnosticUnitDetail[])
          : forkJoin(pagina.items.map((centro) => this.diagnostico.getById(centro.id))),
      ),
      map((centros) => {
        const buscado = normalizarCotizacion(termino);
        return centros.flatMap((centro) =>
          centro.studies
            .filter(
              (estudio) =>
                normalizarCotizacion(estudio.name).includes(buscado) ||
                normalizarCotizacion(estudio.code).includes(buscado),
            )
            .map((estudio) => filaDeEstudio(centro, estudio, vertical)),
        );
      }),
    );
  }

  private serviciosMedicos(termino: string): Observable<readonly CotizacionResultado[]> {
    return this.aranceles
      .searchProcedures({ query: termino, limit: TOPE_DE_PRESTACIONES })
      .pipe(map((pagina) => pagina.items.map(filaDePrestacion)));
  }
}

/** Una fila por producto y sede aunque la respuesta lo repita. */
function sinRepetir(filas: readonly CotizacionResultado[]): CotizacionResultado[] {
  return [...new Map(filas.map((fila) => [fila.id, fila])).values()];
}

function filasDeSede(sede: AvailabilitySite): CotizacionResultado[] {
  return sede.products.map((producto) => ({
    id: `farmacia:${sede.siteId}:${producto.productId}`,
    vertical: 'MEDICAMENTOS',
    que: nombreDeProducto(producto),
    donde:
      sede.siteName === sede.pharmacyName
        ? sede.pharmacyName
        : `${sede.pharmacyName} · ${sede.siteName}`,
    price: precioDeProducto(producto, sede),
    distanceKm: sede.distanceKm,
    sinPrecio: 'La farmacia no publicó este precio',
    sinDistancia: 'Sin ubicación publicada',
    accion: { etiqueta: 'Ver farmacias', ruta: '/pharmacies-directory' },
  }));
}

function nombreDeProducto(producto: AvailabilityProduct): string {
  const nombre = producto.brandName ?? producto.genericName ?? producto.productCode;
  return [nombre, producto.strengthText, producto.packageSizeText]
    .filter((parte): parte is string => parte !== null && parte !== '')
    .join(' · ');
}

function precioDeProducto(
  producto: AvailabilityProduct,
  sede: AvailabilitySite,
): PrecioPublicado | null {
  const precio = producto.price;
  const importe = precio === null ? null : Number(precio.patientAmount ?? precio.unitAmount);
  if (
    precio === null ||
    precio.currency === null ||
    importe === null ||
    !Number.isFinite(importe)
  ) {
    return null;
  }
  return {
    amount: importe,
    currency: precio.currency.code,
    source: deMaqueta(`Precio publicado por ${sede.pharmacyName}`),
  };
}

function filaDeEstudio(
  centro: DiagnosticUnitDetail,
  estudio: DiagnosticStudy,
  vertical: 'ANALISIS' | 'IMAGENOLOGIA',
): CotizacionResultado {
  // El precio de la sede del estudio si la lista lo distingue; si no, el
  // general del centro. Nunca el de otra sede.
  const publicado =
    estudio.prices.find((precio) => precio.siteId !== null && precio.siteId === estudio.siteId) ??
    estudio.prices.find((precio) => precio.siteId === null) ??
    null;
  const importe = publicado === null ? null : Number(publicado.amount);
  return {
    id: `estudio:${centro.id}:${estudio.id}`,
    vertical,
    que: estudio.name,
    donde: centro.name,
    price:
      publicado === null || importe === null || !Number.isFinite(importe)
        ? null
        : {
            amount: importe,
            currency: publicado.currency.code,
            source: deMaqueta(`Tarifario publicado por ${centro.name}`),
          },
    distanceKm: null,
    sinPrecio: 'El centro no publicó el precio de este estudio',
    sinDistancia: 'No disponible: el directorio de centros no trae su ubicación',
    accion: { etiqueta: 'Ver el centro', ruta: `/laboratory-directory/${centro.id}` },
  };
}

function filaDePrestacion(prestacion: ProcedureNomenclatureItem): CotizacionResultado {
  const importe = prestacion.referencePrice === null ? null : Number(prestacion.referencePrice);
  const unidad = prestacion.priceUnit;
  return {
    id: `arancel:${prestacion.code}`,
    vertical: 'SERVICIOS_MEDICOS',
    que: prestacion.display,
    donde:
      prestacion.specialty === null
        ? 'Arancel de referencia'
        : `Arancel de referencia · ${prestacion.specialty}`,
    price:
      importe === null || !Number.isFinite(importe) || unidad === null
        ? null
        : {
            amount: importe,
            currency: unidad,
            source: unidad === 'UMA' ? PROCEDENCIA_UMA : `Arancel de referencia, en ${unidad}`,
          },
    distanceKm: null,
    sinPrecio: 'El arancel de referencia no fija precio para esta prestación',
    sinDistancia: 'No aplica: es un arancel de referencia, no una sede',
    ...(prestacion.ocrSuspect
      ? { advertencia: 'El texto de esta fila viene de un escaneo y está por revisar' }
      : {}),
    accion: { etiqueta: 'Buscar un profesional', ruta: '/directory' },
  };
}
