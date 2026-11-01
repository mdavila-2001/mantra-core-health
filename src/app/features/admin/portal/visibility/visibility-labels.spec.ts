import { HttpErrorResponse } from '@angular/common/http';

import type { UiElement, UiPreviewEntry } from '../../../../core/data-access/ui-visibility/ui-visibility.types';
import {
  dayToIso,
  effectLabel,
  isVersionMismatch,
  isoToDay,
  kindLabel,
  pathOf,
  pathText,
  previewReason,
  ruleState,
  validityText,
  visibilityCode,
  visibilityFailure,
  visibilityFieldErrors,
} from './visibility-labels';

const el = (key: string, parentKey: string | null, label = key): UiElement => ({
  id: key,
  key,
  kind: 'SCREEN',
  moduleCode: key.split('.')[0]!,
  parentKey,
  label,
  description: null,
  defaultVisible: true,
  source: 'CODE',
  status: 'ACTIVE',
  activeRuleCount: 0,
});

const fail = (status: number, body: unknown) => new HttpErrorResponse({ status, error: body });

describe('rótulos de visibilidad', () => {
  const now = new Date('2026-10-31T12:00:00.000Z');

  it('el efecto y el tipo se dicen en palabras; un código desconocido se muestra tal cual, en neutro', () => {
    expect(effectLabel('HIDE').label).toBe('Oculta');
    expect(effectLabel('SHOW').label).toBe('Muestra');
    expect(kindLabel('ACTION').label).toBe('Acción');
    expect(kindLabel('RARO')).toEqual({ label: 'RARO', tone: 'secondary' });
    expect(kindLabel(null)).toEqual({ label: 'Sin dato', tone: 'secondary' });
  });

  it('estado de una regla: vigente, programada, terminada, y el fin exacto ya no rige', () => {
    expect(ruleState({ validFrom: null, validTo: null }, now).code).toBe('active');
    expect(ruleState({ validFrom: '2026-10-01T00:00:00.000Z', validTo: '2026-11-01T00:00:00.000Z' }, now).code).toBe('active');
    expect(ruleState({ validFrom: '2026-11-01T00:00:00.000Z', validTo: null }, now).code).toBe('scheduled');
    expect(ruleState({ validFrom: null, validTo: '2026-10-31T11:00:00.000Z' }, now).code).toBe('ended');
    expect(ruleState({ validFrom: null, validTo: '2026-10-31T12:00:00.000Z' }, now).code).toBe('ended');
  });

  it('la vigencia sin fecha de fin lo dice, en vez de dejar un renglón vacío', () => {
    expect(validityText({ validFrom: null, validTo: null })).toBe('Sin fecha de fin');
    expect(validityText({ validFrom: '2026-10-01T12:00:00.000Z', validTo: null })).toContain('sin fecha de fin');
    expect(validityText({ validFrom: null, validTo: '2026-12-01T12:00:00.000Z' })).toContain('Hasta el');
    expect(validityText({ validFrom: '2026-10-01T12:00:00.000Z', validTo: '2026-12-01T12:00:00.000Z' })).toContain(' al ');
  });

  it('un día de formulario viaja como instante al comienzo o al final del día y vuelve al mismo día', () => {
    const start = dayToIso('2026-10-31', 'start')!;
    const end = dayToIso('2026-10-31', 'end')!;
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe((24 * 3600 - 1) * 1000);
    expect(isoToDay(start)).toBe('2026-10-31');
    expect(isoToDay(end)).toBe('2026-10-31');
    expect(isoToDay(null)).toBe('');
    expect(isoToDay('basura')).toBe('');
  });

  it('inválido: un día mal escrito no es una fecha', () => {
    for (const mal of ['', '31/10/2026', '2026-1-1', 'ayer', '2026-13-45x', '2026-02-31']) expect(dayToIso(mal, 'start')).toBeNull();
  });

  it('la ruta de un elemento va de la raíz hacia él, y un ciclo de padres no la cuelga', () => {
    const list = [el('a', null, 'Farmacia'), el('a.b', 'a', 'Pedidos'), el('a.b.c', 'a.b', 'Exportar')];
    const byKey = new Map(list.map((e) => [e.key, e]));
    expect(pathText('a.b.c', byKey)).toBe('Farmacia › Pedidos › Exportar');
    expect(pathText('no.esta', byKey)).toBe('no.esta');
    const ciclo = new Map([el('x', 'y'), el('y', 'x')].map((e) => [e.key, e]));
    expect(pathOf('x', ciclo).map((e) => e.key)).toEqual(['y', 'x']);
  });

  it('cada motivo de «ver como» se explica; la cascada nombra al elemento superior', () => {
    const base: UiPreviewEntry = { elementKey: 'a.b', hidden: true, winningRuleId: 'r1', reason: 'RULE', ancestorKey: null };
    expect(previewReason(base, (k) => k)).toBe('Lo oculta una regla');
    expect(previewReason({ ...base, hidden: false }, (k) => k)).toBe('Una regla lo muestra');
    expect(previewReason({ ...base, reason: 'DEFAULT', winningRuleId: null }, (k) => k)).toContain('por omisión');
    expect(previewReason({ ...base, reason: 'ANCESTOR_HIDDEN', winningRuleId: null, ancestorKey: 'a' }, () => 'Farmacia')).toContain(
      '«Farmacia» está oculto',
    );
    expect(previewReason({ ...base, reason: 'ANCESTOR_HIDDEN', ancestorKey: null }, (k) => k)).toContain('cascada');
  });
});

describe('errores del servidor de visibilidad', () => {
  it('el código estable se lee de `reason`, de `details.reason` o, si la API lo manda como `code`, de ahí', () => {
    expect(visibilityCode(fail(409, { code: 'CONFLICT', reason: 'UI_RULE_DUPLICATE', message: 'x' }))).toBe('UI_RULE_DUPLICATE');
    expect(visibilityCode(fail(409, { code: 'CONFLICT', message: 'x', details: { reason: 'UI_RULE_VERSION_MISMATCH' } }))).toBe(
      'UI_RULE_VERSION_MISMATCH',
    );
    expect(visibilityCode(fail(409, { code: 'UI_ELEMENT_RETIRED', message: 'x' }))).toBe('UI_ELEMENT_RETIRED');
    expect(visibilityCode(fail(500, { code: 'INTERNAL', message: 'x' }))).toBeNull();
    expect(visibilityCode(new Error('x'))).toBeNull();
    expect(isVersionMismatch(fail(409, { code: 'CONFLICT', reason: 'UI_RULE_VERSION_MISMATCH' }))).toBe(true);
    expect(isVersionMismatch(fail(409, { code: 'CONFLICT', reason: 'UI_RULE_DUPLICATE' }))).toBe(false);
  });

  it('el mensaje usa las palabras del código estable y agrega el código de soporte', () => {
    const e = fail(409, { code: 'CONFLICT', reason: 'UI_RULE_DUPLICATE', message: 'crudo', correlationId: 'req-9' });
    const text = visibilityFailure(e, 'No se pudo');
    expect(text).toContain('Ya hay una regla vigente');
    expect(text).toContain('req-9');
    expect(text).not.toContain('crudo');
  });

  it('un fallo sin código estable cae al texto de la pantalla, sin el cuerpo crudo', () => {
    expect(visibilityFailure(fail(500, { code: 'INTERNAL', message: 'SELECT * FROM x' }), 'No se pudo guardar.')).toBe('No se pudo guardar.');
    expect(visibilityFailure(fail(0, null), 'No se pudo')).toContain('conexión');
  });

  it('los errores por campo vienen de details.fields; sin ellos, el código señala el campo', () => {
    expect(
      visibilityFieldErrors(fail(400, { code: 'VALIDATION_FAILED', message: 'x', details: { fields: [{ field: 'reason', messages: ['Muy corto'] }] } })),
    ).toEqual({ reason: 'Muy corto' });
    expect(visibilityFieldErrors(fail(409, { code: 'CONFLICT', reason: 'UI_RULE_DUPLICATE' }))['subjectId']).toContain('regla vigente');
    expect(visibilityFieldErrors(fail(404, { code: 'NOT_FOUND', reason: 'UI_ELEMENT_NOT_FOUND' }))['elementKey']).toContain('catálogo');
    expect(visibilityFieldErrors(fail(500, { code: 'INTERNAL' }))).toEqual({});
  });

  /*
   * Los 16 sub-códigos de error de `UiVisibilityErrorReason` (API, `ui-visibility.error-reasons.ts`). Un código sin
   * palabras caía al mensaje genérico de la pantalla y la persona no sabía qué corregir.
   */
  it.each([
    'UI_ELEMENT_NOT_FOUND',
    'UI_ELEMENT_RETIRED',
    'UI_RULE_VERSION_MISMATCH',
    'UI_RULE_DUPLICATE',
    'UI_RULE_INVALID_SUBJECT',
    'UI_RULE_NOT_FOUND',
    'UI_RULE_ENDED',
    'UI_RULE_IF_MATCH_REQUIRED',
    'UI_RULE_INVALID_VALIDITY',
    'UI_RULE_EMPTY_UPDATE',
    'UI_ELEMENT_KEY_EXISTS',
    'UI_ELEMENT_PARENT_NOT_FOUND',
    'UI_ELEMENT_HIERARCHY_CYCLE',
    'UI_ELEMENT_SYNC_INVALID',
    'UI_PREVIEW_SUBJECT_NOT_FOUND',
    'UI_PREVIEW_SUBJECT_REQUIRED',
    'UI_RULE_PROTECTED_ELEMENT',
  ])('%s tiene palabras propias, no el mensaje genérico de la pantalla', (reason) => {
    const e = fail(422, { code: 'X', reason, message: 'crudo' });
    expect(visibilityCode(e)).toBe(reason);
    const text = visibilityFailure(e, 'GENERICO');
    expect(text).not.toBe('GENERICO');
    expect(text).not.toContain('crudo');
  });

  it('ocultar la pantalla de gobierno a los administradores se marca en el sujeto; la vigencia incoherente, en el fin', () => {
    expect(visibilityFieldErrors(fail(422, { code: 'X', reason: 'UI_RULE_PROTECTED_ELEMENT' }))['subjectId']).toContain('administradores');
    expect(visibilityFieldErrors(fail(422, { code: 'X', reason: 'UI_RULE_INVALID_VALIDITY' }))['validTo']).toContain('posterior');
    expect(visibilityFieldErrors(fail(409, { code: 'X', reason: 'UI_ELEMENT_KEY_EXISTS' }))['key']).toContain('esa clave');
    expect(visibilityFieldErrors(fail(422, { code: 'X', reason: 'UI_ELEMENT_HIERARCHY_CYCLE' }))['parentKey']).toContain('ciclo');
  });
});
