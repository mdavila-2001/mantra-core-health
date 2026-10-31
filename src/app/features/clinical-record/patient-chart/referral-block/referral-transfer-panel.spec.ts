import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { transferIssues } from '../../../../core/data-access/referrals/referral-transfer.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { ReferralTransferForm } from './referral-transfer-form';
import { ReferralTransferPanel } from './referral-transfer-panel';
import {
  draftFromTransfer,
  emptyTransferDraft,
  parseVital,
  transferFromDraft,
  vitalsLine,
  type TransferDraft,
} from './referral-transfer.model';

const BASE: Referral = {
  id: 'r-1',
  patientProfileId: 'p-1',
  statusConceptId: 'st',
  status: 'PENDING',
  createdAt: new Date('2026-10-30T10:00:00Z'),
  referralType: 'HOSPITALIZATION',
  targetProfileId: 'hp-destino',
  transfer: {
    required: true,
    transportMode: 'AMBULANCE_ADVANCED',
    transportDetail: 'Unidad 12',
    departureCondition: 'CRITICAL',
    escortProfessionalName: 'Dr. Vaca',
    escortProfessionalRole: 'Médico',
    vitals: { systolicBp: 90, diastolicBp: 50, heartRate: 120, temperatureC: 38.5 },
    receiverContacted: true,
    receiverContactName: 'Guardia',
    departedAt: new Date('2026-10-30T10:15:00Z'),
  },
};

const ROW = { id: 'r-1', patientProfileId: 'p-1', statusConceptId: 'st', status: 'PENDING', createdAt: '2026-10-30T10:00:00Z' };

describe('referral-transfer.model', () => {
  it('parseVital acepta coma decimal; lo que no es número da NaN para que la regla lo marque', () => {
    expect(parseVital('')).toBeUndefined();
    expect(parseVital('37,5')).toBe(37.5);
    expect(parseVital('12a')).toBeNaN();
  });

  it('sin traslado físico sólo viaja required: false', () => {
    expect(transferFromDraft({ ...emptyTransferDraft(), companionName: 'x' })).toEqual({ required: false });
  });

  it('el borrador de un traslado guardado vuelve al mismo cuerpo', () => {
    const body = transferFromDraft(draftFromTransfer(BASE.transfer));
    expect(body).toMatchObject({
      required: true,
      transportMode: 'AMBULANCE_ADVANCED',
      departureCondition: 'CRITICAL',
      vitals: { systolicBp: 90, diastolicBp: 50, heartRate: 120, temperatureC: 38.5 },
      receiverContacted: true,
      receiverContactName: 'Guardia',
    });
    expect(transferIssues(body)).toEqual([]);
  });

  it('los signos en una línea, con unidades', () => {
    expect(vitalsLine(BASE.transfer?.vitals)).toBe('PA 90/50 mmHg · FC 120 lpm · T 38,5 °C');
  });
});

describe('ReferralTransferForm', () => {
  let fixture: ComponentFixture<ReferralTransferForm>;
  const el = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  function create(draft: TransferDraft, showAll = false): void {
    fixture = TestBed.createComponent(ReferralTransferForm);
    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('issues', transferIssues(transferFromDraft(draft)));
    fixture.componentRef.setInput('showAll', showAll);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [ReferralTransferForm] }));

  it('sin traslado no pide medio ni signos, y lo dice', () => {
    create(emptyTransferDraft());
    expect(el('transfer-not-required')).not.toBeNull();
    expect(el('transfer-mode')).toBeNull();
  });

  it('con crítico explica por qué se exige ambulancia y personal de salud, y los marca al intentar', () => {
    create({ ...emptyTransferDraft(), required: true, departureCondition: 'CRITICAL', transportMode: 'PRIVATE_VEHICLE' }, true);
    const why = el('transfer-unstable-why')?.textContent ?? '';
    expect(why).toContain('crítico');
    expect(why).toContain('ambulancia');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Un paciente inestable o crítico viaja en ambulancia');
    expect(text).toContain('acompañado por personal de salud');
    expect(text).toContain('avise al establecimiento receptor');
  });

  it('los signos van en una grilla con unidad y rango, con teclado numérico', () => {
    create({ ...emptyTransferDraft(), required: true });
    const grid = el('transfer-vitals');
    expect(grid?.textContent).toContain('PA sistólica (mmHg)');
    expect(grid?.textContent).toContain('40–300');
    const temp = grid?.querySelector('[data-testid="transfer-vital-temperatureC"]') as HTMLInputElement | null;
    expect(temp?.getAttribute('inputmode')).toBe('decimal');
    const glasgow = grid?.querySelector('[data-testid="transfer-vital-glasgow"]') as HTMLInputElement | null;
    expect(glasgow?.getAttribute('inputmode')).toBe('numeric');
  });
});

describe('ReferralTransferPanel', () => {
  let fixture: ComponentFixture<ReferralTransferPanel>;
  let http: HttpTestingController;
  let changed: Referral[];
  const el = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  const click = (id: string): void => {
    (el(id) as HTMLElement).click();
    fixture.detectChanges();
  };

  function create(referral: Referral, who: { issuedByMe?: boolean; externalOnly?: boolean } = {}): void {
    fixture = TestBed.createComponent(ReferralTransferPanel);
    fixture.componentRef.setInput('referral', referral);
    fixture.componentRef.setInput('issuedByMe', who.issuedByMe ?? false);
    fixture.componentRef.setInput('externalOnly', who.externalOnly ?? false);
    changed = [];
    fixture.componentInstance.changed.subscribe((r) => changed.push(r));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReferralTransferPanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('muestra lo registrado: estado, medio, personal, signos y aviso', () => {
    create(BASE);
    const text = el('referral-transfer-data')?.textContent ?? '';
    expect(text).toContain('Crítico');
    expect(text).toContain('Ambulancia avanzada');
    expect(text).toContain('Unidad 12');
    expect(text).toContain('Dr. Vaca (Médico)');
    expect(text).toContain('PA 90/50 mmHg');
    expect(text).toContain('Sí, a Guardia');
  });

  it('sin traslado: S3 con la próxima acción para quien la emitió', () => {
    create({ ...BASE, transfer: undefined }, { issuedByMe: true });
    expect(el('referral-transfer-empty')?.textContent).toContain('Completar traslado');
  });

  it('a quien la emitió le ofrece completar el traslado, no la llegada', () => {
    create(BASE, { issuedByMe: true });
    expect(el('referral-transfer-complete')).not.toBeNull();
    expect(el('referral-arrival-start')).toBeNull();
  });

  it('al destino le ofrece la llegada, no completar la salida; con llegada ya registrada, nada', () => {
    create(BASE);
    expect(el('referral-arrival-start')).not.toBeNull();
    expect(el('referral-transfer-complete')).toBeNull();
    create({ ...BASE, transfer: { ...BASE.transfer, arrivedAt: new Date() } });
    expect(el('referral-arrival-start')).toBeNull();
  });

  it('completar el traslado valida antes de mandar y manda PATCH …/transfer', () => {
    create({ ...BASE, transfer: { ...BASE.transfer, escortProfessionalName: undefined } }, { issuedByMe: true });
    click('referral-transfer-complete');
    click('referral-transfer-save');
    http.expectNone('/referrals/r-1/transfer');
    expect(el('referral-transfer-issues')?.textContent).toContain('personal de salud');

    const draft = (fixture.componentInstance as unknown as { draft: { update(fn: (d: TransferDraft) => TransferDraft): void } })
      .draft;
    draft.update((d) => ({ ...d, escortProfessionalName: 'Lic. Suárez' }));
    fixture.detectChanges();
    click('referral-transfer-save');
    const req = http.expectOne('/referrals/r-1/transfer');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({ escortProfessionalName: 'Lic. Suárez', departureCondition: 'CRITICAL' });
    req.flush({ ...ROW, transfer: { required: true } });
    expect(changed).toHaveLength(1);
  });

  it('registrar la llegada exige el estado; el 404 de quien no es destino se dice en palabras', () => {
    create(BASE);
    click('referral-arrival-start');
    click('referral-arrival-save');
    http.expectNone('/referrals/r-1/arrival');
    expect(el('referral-arrival-form')?.textContent).toContain('Indique en qué estado llegó');

    (fixture.componentInstance as unknown as { arrivalCondition: { set(v: string): void } }).arrivalCondition.set(
      'STABLE',
    );
    fixture.detectChanges();
    click('referral-arrival-save');
    const req = http.expectOne('/referrals/r-1/arrival');
    expect(req.request.body.arrivalCondition).toBe('STABLE');
    req.flush(
      { statusCode: 404, code: 'NOT_FOUND', reason: 'REFERRAL_NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();
    expect(el('referral-transfer-error')?.textContent).toContain('No encontramos esta derivación');
    expect(changed).toHaveLength(0);
  });
});
