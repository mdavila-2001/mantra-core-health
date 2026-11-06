/* ============================================================================
    The released report, read by the practitioner (API 8271ebc0, 06/11/2026).
    Same gate as the record: 403 without access; and a single 404, with the
    same body, for missing, another patient's, unreleased or a foreign file.
    ========================================================================== */

import { displayOf, STATUS } from '../fixtures/concepts';
import { valoresDelInforme } from '../fixtures/patient-network.data';
import { forbidden, notFound, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { uuid } from '../mock-store';
import { puedeLeer } from './clinical.handlers';
import { pdfMinimo } from './files.handlers';

/** What this route reads of a seeded report (`InformeSimulado`, `diagnostics.handlers.ts`). */
export interface InformeDelProfesional {
  readonly id: string;
  readonly patientProfileId: string;
  readonly released: boolean;
  readonly serviceRequestId?: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  readonly currentVersionId: string;
  readonly issuedAt?: string;
  readonly releasedAt?: string | null;
  readonly patientVisible: boolean;
  readonly conclusionText?: string;
}

export function registrarInformeDelProfesional(
  router: MockRouter,
  informePorId: (id: string) => InformeDelProfesional | undefined,
  rolContenido: string,
  formatoPdf: string,
): void {
  const noDisponible = (): MockReply => {
    const base = notFound('Recurso diagnóstico no disponible');
    return { ...base, body: { ...(base.body as object), reason: 'DIAGNOSTICS_RESOURCE_NOT_AVAILABLE' } };
  };
  const informeDelProfesional = (request: MockRequest): InformeDelProfesional | MockReply => {
    const pacienteId = request.params['id']!;
    if (!puedeLeer(request, pacienteId)) return forbidden('No tiene cita hoy ni vínculo vigente con esta persona');
    const r = informePorId(request.params['reportId']!);
    return r === undefined || r.patientProfileId !== pacienteId || !r.released ? noDisponible() : r;
  };
  const archivosDelInforme = (r: InformeDelProfesional) => [
    { id: uuid(`result-file-${r.id}`), fileId: uuid(`file-lab-${r.patientProfileId}`), name: `Informe de ${displayOf(r.codeConceptId)}.pdf`, contentRoleConceptId: rolContenido, presentationFormatConceptId: formatoPdf, ordinal: 1 },
  ];

  router.get('/diagnostics/patients/:id/reports/:reportId', (request) => {
    const r = informeDelProfesional(request);
    if ('status' in r) return r;
    return {
      reportId: r.id,
      patientProfileId: r.patientProfileId,
      serviceRequestId: r.serviceRequestId ?? null,
      codeConceptId: r.codeConceptId,
      codeDisplay: displayOf(r.codeConceptId),
      categoryConceptId: r.categoryConceptId ?? null,
      versionId: r.currentVersionId,
      versionNumber: 1,
      clinicalStatusConceptId: STATUS['ST-COMPLETED']!,
      issuedAt: r.issuedAt ?? null,
      releasedAt: r.releasedAt ?? r.issuedAt,
      patientVisible: r.patientVisible,
      conclusionText: r.conclusionText ?? null,
      values: valoresDelInforme(r.id).map((v, i) => ({
        observationId: uuid(`obs-result-${r.id}-${i + 1}`),
        codeConceptId: uuid(`concept-${v.code}`),
        name: v.name,
        value: v.value,
        valueKind: v.valueKind,
        valueConceptId: null,
        unitConceptId: null,
        unit: v.unit,
        referenceRange:
          v.low === null && v.high === null && v.rangeText === null
            ? null
            : { low: v.low, high: v.high, text: v.rangeText, unitConceptId: null, unit: v.unit },
        interpretationConceptId: v.interpretation === null ? null : uuid(`concept-interpretation-${v.interpretation.code}`),
        interpretationCode: v.interpretation?.code ?? null,
        interpretation: v.interpretation?.label ?? null,
        statusConceptId: STATUS['ST-COMPLETED']!,
        effectiveAt: r.issuedAt ?? null,
      })),
      files: archivosDelInforme(r),
    };
  });

  router.get('/diagnostics/patients/:id/reports/:reportId/files/:fileId/content', (request) => {
    const r = informeDelProfesional(request);
    if ('status' in r) return r;
    if (!archivosDelInforme(r).some((f) => f.fileId === request.params['fileId'])) return noDisponible();
    const nombre = `informe-${r.id.slice(0, 8)}.pdf`;
    return {
      body: new Blob([pdfMinimo(`Informe ${displayOf(r.codeConceptId)}`)], { type: 'application/pdf' }),
      headers: { 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}` },
    };
  });
}
