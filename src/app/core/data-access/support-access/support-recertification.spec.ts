import { classifyReview, needsAttention, personNotice, reviewHeadline, sortByUrgency, GRACE_DAYS, NOTICE_DAYS } from './support-recertification';

const AHORA = new Date('2026-10-30T12:00:00Z');
const enDias = (n: number): string => new Date(AHORA.getTime() + n * 86_400_000).toISOString();

describe('classifyReview', () => {
  it('falta más de un mes: al día', () => {
    expect(classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(NOTICE_DAYS + 5) }, AHORA).status).toBe('OK');
  });

  it('vence dentro del mes: por vencer, con los días que faltan', () => {
    const info = classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(9) }, AHORA);
    expect(info.status).toBe('DUE_SOON');
    expect(info.daysToDue).toBe(9);
    expect(info.daysToSuspension).toBe(9 + GRACE_DAYS);
  });

  it('venció pero sigue en plazo: vencido, y dice en cuántos días se suspende', () => {
    const info = classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(-6) }, AHORA);
    expect(info.status).toBe('OVERDUE');
    expect(info.daysToSuspension).toBe(GRACE_DAYS - 6);
  });

  it('el último día del plazo todavía no está suspendido', () => {
    expect(classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(-GRACE_DAYS + 1) }, AHORA).daysToSuspension).toBe(1);
  });

  it('suspendido es suspendido, tenga o no fecha', () => {
    expect(classifyReview({ status: 'SUSPENDED', nextRecertificationAt: enDias(-22) }, AHORA).status).toBe('SUSPENDED');
    expect(classifyReview({ status: 'SUSPENDED' }, AHORA).status).toBe('SUSPENDED');
  });

  it('un vínculo terminado o todavía pendiente no entra en la revisión', () => {
    expect(classifyReview({ status: 'ENDED', nextRecertificationAt: enDias(-1) }, AHORA).status).toBe('NOT_APPLICABLE');
    expect(classifyReview({ status: 'PENDING', nextRecertificationAt: enDias(1) }, AHORA).status).toBe('NOT_APPLICABLE');
    expect(classifyReview({ status: 'ACTIVE' }, AHORA).status).toBe('NOT_APPLICABLE');
  });

  it('solo pide atención lo que vence, venció o se suspendió', () => {
    const de = (dias: number) => needsAttention(classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(dias) }, AHORA));
    expect([de(100), de(10), de(-3)]).toEqual([false, true, true]);
  });
});

describe('lo que se le dice a cada quien', () => {
  it('a la organización: cuándo vence y qué pasa si no se confirma', () => {
    expect(reviewHeadline(classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(9) }, AHORA))).toContain('vence en 9 días');
    expect(reviewHeadline(classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(-6) }, AHORA))).toContain('se suspende en 9 días');
    expect(reviewHeadline(classifyReview({ status: 'SUSPENDED', nextRecertificationAt: enDias(-22) }, AHORA))).toContain('Suspendido desde el');
  });

  it('a la persona: avisa antes de que se suspenda, deja declarar que sigue y dice que renueva la organización', () => {
    const aviso = personNotice(classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(9) }, AHORA))!;
    expect(aviso.canConfirm).toBe(true);
    expect(aviso.declared).toBe(false);
    expect(aviso.title).toBe('Confirme que sigue trabajando aquí');
    expect(aviso.text).toContain('la que renueva el vínculo es la organización');
    expect(aviso.text).toContain('se suspende');
    expect(personNotice(classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(200) }, AHORA))).toBeNull();
  });

  it('un vínculo vencido en plazo de gracia también deja declarar, y dice hasta cuándo', () => {
    const aviso = personNotice(classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(-6) }, AHORA))!;
    expect(aviso).toMatchObject({ tone: 'warning', canConfirm: true });
    expect(aviso.text).toContain('la que renueva el vínculo es la organización');
  });

  it('a la persona suspendida: ningún botón y un estado claro que manda a la organización', () => {
    const info = classifyReview({ status: 'SUSPENDED', nextRecertificationAt: enDias(-22) }, AHORA);
    const aviso = personNotice(info)!;
    expect(aviso).toMatchObject({ tone: 'error', canConfirm: false, declared: false });
    expect(aviso.title).toBe('Suspendido: pida a su organización que lo renueve');
    expect(aviso.text).toContain('Solo la organización puede renovarlo');
    // Aunque la persona haya declarado antes, suspendido sigue sin ofrecer nada.
    expect(personNotice(info, { lastConfirmedBy: 'PERSON', lastConfirmedAt: enDias(-1) })!.canConfirm).toBe(false);
  });

  it('si ya declaró en este ciclo, se lo dice y no se lo vuelve a pedir; si la organización renovó, el aviso vuelve a ser normal', () => {
    const info = classifyReview({ status: 'ACTIVE', nextRecertificationAt: enDias(9) }, AHORA);
    const declarado = personNotice(info, { lastConfirmedBy: 'PERSON', lastConfirmedAt: enDias(-1) })!;
    expect(declarado).toMatchObject({ canConfirm: false, declared: true, title: 'Ya avisó que sigue trabajando aquí' });
    expect(declarado.text).toContain('Falta que su organización renueve el vínculo');
    expect(personNotice(info, { lastConfirmedBy: 'ORGANIZATION', lastConfirmedAt: enDias(-1) })).toMatchObject({ canConfirm: true, declared: false });
    // Una declaración de hace un año es de otro ciclo.
    expect(personNotice(info, { lastConfirmedBy: 'PERSON', lastConfirmedAt: enDias(-365) })).toMatchObject({ canConfirm: true });
  });

  it('ordena primero lo más urgente', () => {
    const fila = (status: 'ACTIVE' | 'SUSPENDED', dias: number) => ({ info: classifyReview({ status, nextRecertificationAt: enDias(dias) }, AHORA), dias });
    const ordenado = sortByUrgency([fila('ACTIVE', 12), fila('SUSPENDED', -22), fila('ACTIVE', -6), fila('ACTIVE', 3)]);
    expect(ordenado.map((f) => f.info.status)).toEqual(['SUSPENDED', 'OVERDUE', 'DUE_SOON', 'DUE_SOON']);
    expect(ordenado.map((f) => f.dias)).toEqual([-22, -6, 3, 12]);
  });
});
