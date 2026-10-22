import { HttpEventType } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';

import { DIAGNOSIS_CODES } from '../app/features/auth/shared-registration/diagnostic-center-enrollment';

/**
 * Apoyo de las pruebas de las dos altas públicas de diagnóstico (laboratorio e
 * imagenología): responde los catálogos como los publica la API y atiende las
 * subidas de PDF y el alta, en el orden en que salen.
 *
 * Es el **doble del contrato en sus tres niveles** cuando no hay API: lo que se
 * acepta (catálogo completo y subida confirmada), el límite (un código que falta
 * en el catálogo) y lo inválido (una subida sin `fileId`).
 */

/** Los códigos que cada catálogo publica, por su campo destino. */
export const CATALOGOS_PUBLICADOS: Readonly<Record<string, readonly string[]>> = {
  'diagnostic_units.diagnostic_units.diagnostic_unit_type_concept_id': [
    DIAGNOSIS_CODES.laboratorio,
    DIAGNOSIS_CODES.imagenes,
  ],
  'diagnostic_units.diagnostic_study_offerings.modality_concept_id': Object.values(
    DIAGNOSIS_CODES.modalidades,
  ),
  'directory.tenants.country_concept_id': [DIAGNOSIS_CODES.pais],
  'profiles.jurisdiction_authorizations.jurisdiction_concept_id': [
    DIAGNOSIS_CODES.jurisdiccionNacional,
    'JURISDICTION_SEDES_SANTA_CRUZ',
  ],
};

/** El id que el simulador le da a un código. */
export function idDeConcepto(codigo: string): string {
  return `id-${codigo}`;
}

/**
 * Responde las cuatro lecturas del catálogo.
 *
 * @param omitir - Códigos que el catálogo **no** publica (el caso límite).
 */
export function responderCatalogos(http: HttpTestingController, omitir: readonly string[] = []): void {
  const pedidas = http.match(
    (peticion) => peticion.url.endsWith('/system-context/dynamic-enums'),
  );
  expect(pedidas.map((p) => p.request.params.get('target')).sort()).toEqual(
    Object.keys(CATALOGOS_PUBLICADOS).sort(),
  );
  for (const peticion of pedidas) {
    const codigos = CATALOGOS_PUBLICADOS[peticion.request.params.get('target') ?? ''] ?? [];
    peticion.flush({
      code: 'simulada',
      name: 'Simulada',
      definitionId: 'def',
      valueSetId: 'vs',
      allowCustomValue: false,
      options: codigos
        .filter((codigo) => !omitir.includes(codigo))
        .map((codigo, ordinal) => ({
          conceptId: idDeConcepto(codigo),
          code: codigo,
          display: codigo,
          ordinal,
          isDefault: false,
        })),
    });
  }
}

/**
 * Atiende la próxima subida de PDF: confirma con un `fileId` derivado del nombre
 * del archivo, o responde sin `fileId` si `sinConfirmar`.
 *
 * @returns El nombre del archivo que se subió.
 */
export function atenderSubida(http: HttpTestingController, sinConfirmar = false): string {
  const peticion = http.expectOne((p) => p.url.endsWith('/iam/auth/upload-registration-document'));
  const archivo = (peticion.request.body as FormData).get('file') as File;
  peticion.event({ type: HttpEventType.Sent });
  // `flush` entrega la respuesta y **completa** el flujo: sin eso la próxima
  // subida en serie nunca arranca.
  peticion.flush(
    sinConfirmar
      ? {}
      : { fileId: `file-${archivo.name}`, originalName: archivo.name, sizeBytes: 1, mimeType: 'application/pdf' },
    { status: 201, statusText: 'Created' },
  );
  return archivo.name;
}

/** El alta pendiente de respuesta, para inspeccionar su cuerpo. */
export function altaPendiente(http: HttpTestingController) {
  return http.expectOne((p) => p.url.endsWith('/iam/auth/register-organization'));
}
