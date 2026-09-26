import { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  concatMap,
  filter,
  forkJoin,
  from,
  map,
  of,
  throwIfEmpty,
  toArray,
  type Observable,
} from 'rxjs';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type { UploadedRegistrationDocument } from '../../../core/data-access/iam/iam.types';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';

/**
 * Lo que el alta pública de un laboratorio o de un centro de imagenología
 * necesita saber de la terminología, y cómo lo lee.
 *
 * El alta es anónima y el contrato pide **conceptos** (tipo de unidad,
 * modalidades, país, jurisdicción), no códigos. Sus ids no se escriben acá: se
 * leen por los mismos `dynamic-enums` públicos que ya pueblan los selectores del
 * alta de profesional, y se resuelven **por código**, que es la identidad
 * estable del concepto. Sin el catálogo no se puede armar un cuerpo válido: el
 * envío se frena y lo dice, en vez de mandar un alta que la API rechaza.
 */
const DESTINOS = {
  tipoDeUnidad: 'diagnostic_units.diagnostic_units.diagnostic_unit_type_concept_id',
  modalidad: 'diagnostic_units.diagnostic_study_offerings.modality_concept_id',
  pais: 'directory.tenants.country_concept_id',
  jurisdiccion: 'profiles.jurisdiction_authorizations.jurisdiction_concept_id',
} as const;

/** Los códigos de concepto que el alta usa, tal como los declara la API. */
export const CODIGOS_DE_DIAGNOSTICO = {
  laboratorio: 'DU_TYPE_LAB',
  imagenes: 'DU_TYPE_IMAGING',
  pais: 'BO',
  jurisdiccionNacional: 'JURISDICTION_NATIONAL',
  modalidades: {
    laboratorio: 'DU_MODALITY_LAB',
    rayosX: 'DU_MODALITY_XRAY',
    ecografia: 'DU_MODALITY_ULTRASOUND',
    tomografia: 'DU_MODALITY_CT',
    resonancia: 'DU_MODALITY_MRI',
    mamografia: 'DU_MODALITY_MAMMOGRAPHY',
    densitometria: 'DU_MODALITY_BONE_DENSITOMETRY',
  },
} as const;

/** Código de concepto → id, por cada catálogo que el alta usa. */
export interface CatalogosDeDiagnostico {
  readonly tipoDeUnidad: ReadonlyMap<string, string>;
  readonly modalidad: ReadonlyMap<string, string>;
  readonly pais: ReadonlyMap<string, string>;
  readonly jurisdiccion: ReadonlyMap<string, string>;
}

/** El catálogo no trajo un código que el alta necesita. */
export class CatalogoIncompleto extends Error {
  constructor(readonly codigo: string) {
    super(`El catálogo no incluye ${codigo}`);
    this.name = 'CatalogoIncompleto';
  }
}

/** Lo que dice la pantalla cuando el catálogo no sirve. Un solo texto para las dos altas. */
export const AVISO_CATALOGO_DE_DIAGNOSTICO =
  'No pudimos cargar los catálogos del alta. Revisá tu conexión y volvé a enviar.';

/** Lo que dice la pantalla cuando una subida no pudo confirmarse. */
export const AVISO_SUBIDA_SIN_CONFIRMAR = 'No pudimos confirmar la carga del PDF. Volvé a intentarlo.';

/**
 * Los pasos comunes de las dos altas públicas de diagnóstico: leer el catálogo y
 * subir los PDF antes del alta.
 *
 * ## Subidas
 *
 * En serie y **antes** del alta. El `fileId` de cada archivo ya subido se
 * recuerda por el propio `File`: si una subida posterior falla y la persona
 * reintenta, las que ya salieron no se repiten —el alta reclama cada `fileId`
 * dentro de su transacción y un archivo que ya tiene dueño respondería 422—.
 */
@Injectable({ providedIn: 'root' })
export class AltaDeCentroDiagnostico {
  private readonly iam = inject(IamClient);
  private readonly contexto = inject(SystemContextClient);

  /** El `fileId` de cada archivo ya subido. Sobrevive a un reintento del envío. */
  private readonly subidos = new WeakMap<File, string>();

  /** Lee los cuatro catálogos. Un fallo de cualquiera corta con su error. */
  catalogos(): Observable<CatalogosDeDiagnostico> {
    const porCodigo = (destino: string) =>
      this.contexto
        .dynamicEnum(destino)
        .pipe(
          map(
            (enumeracion) =>
              new Map(enumeracion.options.map((opcion) => [opcion.code, opcion.conceptId])),
          ),
        );
    return forkJoin({
      tipoDeUnidad: porCodigo(DESTINOS.tipoDeUnidad),
      modalidad: porCodigo(DESTINOS.modalidad),
      pais: porCodigo(DESTINOS.pais),
      jurisdiccion: porCodigo(DESTINOS.jurisdiccion),
    });
  }

  /**
   * El id del concepto con ese código, o `CatalogoIncompleto`.
   *
   * @param catalogo - Uno de los mapas de {@link CatalogosDeDiagnostico}.
   * @param codigo - El código estable del concepto.
   */
  static concepto(catalogo: ReadonlyMap<string, string>, codigo: string): string {
    const id = catalogo.get(codigo);
    if (id === undefined) {
      throw new CatalogoIncompleto(codigo);
    }
    return id;
  }

  /**
   * Sube los archivos en orden y devuelve el `fileId` de cada uno, por clave.
   *
   * Las claves sin archivo se omiten del resultado.
   */
  subirDocumentos<K extends string>(
    archivos: Readonly<Partial<Record<K, File | undefined>>>,
  ): Observable<Partial<Record<K, string>>> {
    const pendientes = (Object.entries(archivos) as [K, File | undefined][]).filter(
      (par): par is [K, File] => par[1] !== undefined,
    );
    return from(pendientes).pipe(
      concatMap(([clave, archivo]) => {
        const yaSubido = this.subidos.get(archivo);
        if (yaSubido !== undefined) {
          return of([clave, yaSubido] as const);
        }
        return this.iam.uploadRegistrationDocument(archivo).pipe(
          filter(
            (evento): evento is HttpResponse<UploadedRegistrationDocument> =>
              evento instanceof HttpResponse,
          ),
          map((respuesta) => {
            const fileId = respuesta.body?.fileId?.trim();
            if (fileId === undefined || fileId === '') {
              throw new Error(AVISO_SUBIDA_SIN_CONFIRMAR);
            }
            this.subidos.set(archivo, fileId);
            return [clave, fileId] as const;
          }),
          throwIfEmpty(() => new Error(AVISO_SUBIDA_SIN_CONFIRMAR)),
        );
      }),
      toArray(),
      map((pares) => Object.fromEntries(pares) as Partial<Record<K, string>>),
    );
  }
}
