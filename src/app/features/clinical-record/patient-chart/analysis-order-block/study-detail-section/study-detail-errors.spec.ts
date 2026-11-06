import { HttpErrorResponse } from '@angular/common/http';

import { studyDetailErrorOf } from './study-detail-errors';

function error422(reason: string | null, field?: string, status = 422): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code: 'PRECONDITION_FAILED',
      message: 'x',
      timestamp: 't',
      path: '/clinical/service-requests',
      ...(reason === null ? {} : { reason, details: { reason, ...(field === undefined ? {} : { field }) } }),
    },
  });
}

describe('un 422 de la orden se ubica en el campo de su sección', () => {
  it('la muestra fuera del catálogo va al campo Muestra, con qué hacer', () => {
    const found = studyDetailErrorOf(error422('SPECIMEN_TYPE_NOT_IN_CATALOG', 'specimenTypeConceptId'));
    expect(found?.field).toBe('specimen');
    expect(found?.message).toContain('Elija una de la lista');
  });

  it('muestra e imagen a la vez: se explica en el campo de la muestra', () => {
    expect(studyDetailErrorOf(error422('SPECIMEN_AND_IMAGING_FIELDS_EXCLUSIVE', 'specimenTypeConceptId'))?.field).toBe('specimen');
  });

  it('el `details.field` anidado (`imaging.bodySiteConceptId`) ubica el campo', () => {
    expect(studyDetailErrorOf(error422('BODY_SITE_REQUIRED', 'imaging.bodySiteConceptId'))?.field).toBe('bodySite');
    expect(studyDetailErrorOf(error422('BONE_TYPE_NOT_IN_CATALOG', 'imaging.boneTypeConceptId'))?.field).toBe('boneType');
    expect(studyDetailErrorOf(error422('BODY_STRUCTURE_FORMAT_INVALID', 'imaging.bodyStructureUberon'))?.field).toBe('structure');
  });

  it('la región exigida para el lado (BODY_SITE_REQUIRED sobre el lado) se dice en el campo Lado, con qué hacer', () => {
    const found = studyDetailErrorOf(error422('BODY_SITE_REQUIRED', 'imaging.lateralityConceptId'));
    expect(found?.field).toBe('laterality');
    expect(found?.message).toContain('primero elija la región');
  });

  it('un dato de imagen repetido con valores distintos se ubica en la región', () => {
    expect(studyDetailErrorOf(error422('IMAGING_FIELD_CONFLICT', 'bodySiteConceptId'))?.field).toBe('bodySite');
  });

  it('sin `field` manda el motivo', () => {
    expect(studyDetailErrorOf(error422('LATERALITY_NOT_APPLICABLE'))?.field).toBe('laterality');
  });

  it('inválido: lo que no es de esta sección (otro motivo, otro estado, sin cuerpo) queda como error general', () => {
    expect(studyDetailErrorOf(error422('DUPLICATE_STUDY_DETECTED'))).toBeNull();
    expect(studyDetailErrorOf(error422(null))).toBeNull();
    expect(studyDetailErrorOf(error422('BODY_SITE_REQUIRED', undefined, 400))).toBeNull();
    expect(studyDetailErrorOf(new Error('x'))).toBeNull();
  });
});
