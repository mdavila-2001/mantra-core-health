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
  PharmacyProduct,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { ProcedureNomenclatureItem } from '../../../core/data-access/services-catalog/services-catalog.types';
import { environment } from '../../../../environments/environment';
import type { SearchOrigin } from '../../nearby-places/search-origin-picker/search-origin-picker.types';
import { PHARMACY_PRESCRIPTIONS_ROUTE } from '../pharmacy/pharmacy.routes';
import {
  normalizeQuotation,
  type ResultQuotation,
  type PublishedPrice,
  type VerticalQuotation,
} from './quotations.logic';

/** Cuántos productos de farmacia se cotizan por búsqueda. */
const PRODUCTS_LIMIT = 20;

/** Cuántas sedes de farmacia devuelve la disponibilidad. */
const PHARMACIES_LIMIT = 20;

/** Cuántos centros diagnósticos se abren para buscar el estudio adentro. */
const CENTERS_LIMIT = 10;

/** Cuántas prestaciones del arancel de referencia se muestran. */
const BENEFITS_LIMIT = 25;

/**
 * El rótulo del arancel en UMA. Lo fija el carril (Q-16) y la cabecera de
 * `fee-schedules.generated.ts`: «honorarios médicos del Colegio Médico de Santa
 * Cruz (2025, en UMA)». UMA no es una moneda y no se convierte.
 */
const PROVENANCE_UMA = 'Referencia del Colegio Médico de Santa Cruz 2025, en UMA (sin conversión)';

/**
 * La procedencia de un precio servido por una sede.
 *
 * Con el backend simulado, los precios de farmacia y de estudios salen de los
 * dobles (`pharmacy.handlers.ts`, y una fórmula sintética en
 * `diagnostics.handlers.ts`) aunque las sedes lleven nombres con forma de
 * reales. Decir «publicado por <sede>» —aun con una marca al final— sería
 * atribuirle a una institución con nombre un precio inventado (regla 00 §2.1),
 * así que en la maqueta se dice lo contrario: que es de ejemplo y que esa sede
 * **no** lo publicó. El arancel de referencia no pasa por acá: la maqueta sirve
 * la tabla real del propietario (`fee-schedules.generated.ts`).
 */
function siteProvenance(queFue: 'Precio' | 'Tarifario', sede: string): string {
  return environment.mockBackend
    ? `${queFue} de ejemplo de la maqueta: ${sede} no lo publicó`
    : `${queFue} publicado por ${sede}`;
}

/** Lo que devuelve una búsqueda: las filas y qué fuentes no respondieron. */
export interface QuotationsSearch {
  readonly resultados: readonly ResultQuotation[];
  /** Las verticales cuya fuente falló; las otras se muestran igual. */
  readonly fuentesCaidas: readonly Exclude<VerticalQuotation, 'TODAS'>[];
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
export class QuotationSources {
  private readonly pharmacy = inject(PharmacyClient);
  private readonly diagnosis = inject(DiagnosticUnitsClient);
  private readonly tariffs = inject(ServicesCatalogClient);

  /**
   * Busca un término en una vertical, o en las cuatro a la vez.
   *
   * Con «Todas», las cuatro lecturas salen en paralelo y una fuente caída no
   * tira abajo a las otras: se anota en `fuentesCaidas`. Con una sola
   * vertical, su error se propaga para que la pantalla ofrezca reintentar.
   */
  search(
    termino: string,
    vertical: VerticalQuotation,
    origen: SearchOrigin | null,
  ): Observable<QuotationsSearch> {
    if (vertical !== 'TODAS') {
      return this.vertical(vertical, termino, origen).pipe(
        map((resultados) => ({ resultados, fuentesCaidas: [] })),
      );
    }
    const verticales = ['MEDICAMENTOS', 'ANALISIS', 'IMAGENOLOGIA', 'SERVICIOS_MEDICOS'] as const;
    return forkJoin(
      verticales.map((una) =>
        this.vertical(una, termino, origen).pipe(
          map((resultados) => ({ una, resultados, caida: false })),
          catchError(() =>
            of({ una, resultados: [] as readonly ResultQuotation[], caida: true }),
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

  private vertical(
    vertical: Exclude<VerticalQuotation, 'TODAS'>,
    termino: string,
    origen: SearchOrigin | null,
  ): Observable<readonly ResultQuotation[]> {
    switch (vertical) {
      case 'MEDICAMENTOS':
        return this.medications(termino, origen);
      case 'ANALISIS':
        return this.studies(termino, 'LABORATORY', 'ANALISIS');
      case 'IMAGENOLOGIA':
        return this.studies(termino, 'IMAGING', 'IMAGENOLOGIA');
      case 'SERVICIOS_MEDICOS':
        return this.medicalServices(termino);
    }
  }

  /** Productos que coinciden → qué sedes los tienen, a qué precio y a qué distancia. */
  private medications(
    termino: string,
    origen: SearchOrigin | null,
  ): Observable<readonly ResultQuotation[]> {
    return this.pharmacy.searchProducts({ search: termino, limit: PRODUCTS_LIMIT }).pipe(
      switchMap((pagina) => {
        const productIds = [...new Set(pagina.items.map((producto) => producto.id))];
        if (productIds.length === 0) {
          return of([]);
        }
        return this.pharmacy
          .availability({
            productIds,
            origin: origen === null ? undefined : { lat: origen.lat, lng: origen.lng },
            limit: PHARMACIES_LIMIT,
          })
          .pipe(
            map((disponibilidad) => {
              // El catálogo es el que dice si el producto exige receta: sin él
              // no se sabe si la fila lleva «Agregar al carrito» o el camino
              // de la receta.
              const catalogo = new Map(pagina.items.map((producto) => [producto.id, producto]));
              return withoutRepeat(
                disponibilidad.items.flatMap((sede) => siteRows(sede, catalogo)),
              );
            }),
          );
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
  private studies(
    termino: string,
    kind: DiagnosticUnitKind,
    vertical: 'ANALISIS' | 'IMAGENOLOGIA',
  ): Observable<readonly ResultQuotation[]> {
    return this.diagnosis.search({ kind, limit: CENTERS_LIMIT }).pipe(
      switchMap((pagina) =>
        pagina.items.length === 0
          ? of([] as DiagnosticUnitDetail[])
          : forkJoin(pagina.items.map((centro) => this.diagnosis.getById(centro.id))),
      ),
      map((centros) => {
        const buscado = normalizeQuotation(termino);
        return centros.flatMap((centro) =>
          centro.studies
            .filter(
              (estudio) =>
                normalizeQuotation(estudio.name).includes(buscado) ||
                normalizeQuotation(estudio.code).includes(buscado),
            )
            .map((estudio) => studyRow(centro, estudio, vertical)),
        );
      }),
    );
  }

  private medicalServices(termino: string): Observable<readonly ResultQuotation[]> {
    return this.tariffs
      .searchProcedures({ query: termino, limit: BENEFITS_LIMIT })
      .pipe(map((pagina) => pagina.items.map(benefitRow)));
  }
}

/** Una fila por producto y sede aunque la respuesta lo repita. */
function withoutRepeat(filas: readonly ResultQuotation[]): ResultQuotation[] {
  return [...new Map(filas.map((fila) => [fila.id, fila])).values()];
}

/**
 * Una fila por producto que la sede tiene.
 *
 * La acción es la de la tienda de Farmacia: **agregar al carrito** de esa sede.
 * Mandar al directorio de farmacias obligaba a buscar de nuevo lo que ya se
 * había encontrado. Dos excepciones, las mismas que en `product-results.ts`:
 * lo que exige receta no entra al carrito libre (se ofrece el camino de la
 * receta), y lo que no tiene precio publicado no se agrega a ciegas.
 */
function siteRows(
  sede: AvailabilitySite,
  catalogo: ReadonlyMap<string, PharmacyProduct>,
): ResultQuotation[] {
  return sede.products.map((producto) => {
    const precio = productPrice(producto, sede);
    const exigeReceta = catalogo.get(producto.productId)?.requiresPrescription === true;
    const fila: ResultQuotation = {
      id: `farmacia:${sede.siteId}:${producto.productId}`,
      vertical: 'MEDICAMENTOS',
      que: productName(producto),
      // El nombre de la farmacia puede traer ya la sucursal («Farmacorp ·
      // Grigotá»): no se repite («Farmacorp · Grigotá · Grigotá»).
      donde: sede.pharmacyName.includes(sede.siteName)
        ? sede.pharmacyName
        : `${sede.pharmacyName} · ${sede.siteName}`,
      price: precio,
      distanceKm: sede.distanceKm,
      sinPrecio: 'La farmacia no publicó este precio',
      sinDistancia: 'Sin ubicación publicada',
    };
    if (exigeReceta) {
      return {
        ...fila,
        advertencia: 'Requiere receta',
        accion: { etiqueta: 'Busque su receta para comprarlo', ruta: PHARMACY_PRESCRIPTIONS_ROUTE },
      };
    }
    if (precio === null) {
      return fila;
    }
    return {
      ...fila,
      carrito: {
        sede: {
          pharmacyId: sede.pharmacyId,
          pharmacyName: sede.pharmacyName,
          siteId: sede.siteId,
          siteName: sede.siteName,
          addressText: sede.addressText,
        },
        linea: {
          productId: producto.productId,
          name: producto.brandName ?? producto.genericName ?? producto.productCode,
          presentation: presentationOf(producto),
          // El texto exacto de la lista, no el número ya convertido: el
          // carrito suma en centavos a partir de él.
          unitAmount:
            producto.price?.patientAmount ?? producto.price?.unitAmount ?? String(precio.amount),
          currency: precio.currency,
          requiresPrescription: false,
          medicationConceptId: null,
        },
      },
    };
  });
}

function presentationOf(producto: AvailabilityProduct): string | null {
  const partes = [producto.strengthText, producto.packageSizeText].filter(
    (parte): parte is string => parte !== null && parte !== '',
  );
  return partes.length === 0 ? null : partes.join(' · ');
}

function productName(producto: AvailabilityProduct): string {
  const nombre = producto.brandName ?? producto.genericName ?? producto.productCode;
  return [nombre, producto.strengthText, producto.packageSizeText]
    .filter((parte): parte is string => parte !== null && parte !== '')
    .join(' · ');
}

function productPrice(
  producto: AvailabilityProduct,
  sede: AvailabilitySite,
): PublishedPrice | null {
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
    source: siteProvenance('Precio', sede.pharmacyName),
  };
}

function studyRow(
  centro: DiagnosticUnitDetail,
  estudio: DiagnosticStudy,
  vertical: 'ANALISIS' | 'IMAGENOLOGIA',
): ResultQuotation {
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
            source: siteProvenance('Tarifario', centro.name),
          },
    distanceKm: null,
    sinPrecio: 'El centro no publicó el precio de este estudio',
    sinDistancia: 'No disponible: el directorio de centros no trae su ubicación',
    // Lo que se quiere de un estudio es hacérselo: se pide un horario en la
    // agenda del centro, igual que una cita con un profesional.
    reserva: { centroId: centro.id, centro: centro.name, estudio: estudio.name },
  };
}

function benefitRow(prestacion: ProcedureNomenclatureItem): ResultQuotation {
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
            source: unidad === 'UMA' ? PROVENANCE_UMA : `Arancel de referencia, en ${unidad}`,
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
