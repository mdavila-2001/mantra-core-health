import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { PerformerSelector, NO_OWN_SITE_REASON } from './performer-selector';
import {
  DEFAULT_PERFORMER_CHOICE,
  type PerformerChoice,
  type PerformerSite,
} from './performer-selector.rules';

const sede = (id: string, name: string, addressText: string | null = null): PerformerSite => ({
  practiceSiteId: id,
  name,
  addressText,
});

const PROPIAS = [sede('s-1', 'Centro Norte', 'Av. 1')];
const CENTER_SITES = [sede('s-3', 'Centro Sur'), sede('s-1', 'Centro Norte', 'Av. 1'), sede('s-2', 'Centro Este')];

describe('PerformerSelector', () => {
  let fixture: ComponentFixture<PerformerSelector>;
  let host: HTMLElement;

  async function montar(entradas: Partial<Record<string, unknown>> = {}): Promise<void> {
    fixture = TestBed.createComponent(PerformerSelector);
    fixture.componentRef.setInput('procedureConceptId', 'p-1');
    fixture.componentRef.setInput('ownSites', PROPIAS);
    fixture.componentRef.setInput('centerSites', CENTER_SITES);
    for (const [clave, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(clave, valor);
    }
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const byTestId = (testid: string): HTMLElement | null => host.querySelector(`[data-testid="${testid}"]`);
  const radio = (testid: string): HTMLInputElement =>
    byTestId(testid)!.querySelector('input[type="radio"]') as HTMLInputElement;
  const elegir = async (testid: string): Promise<void> => {
    radio(testid).click();
    await fixture.whenStable();
  };
  const eleccion = (): PerformerChoice => fixture.componentInstance.choice();

  it('al montar marca «Que elija el paciente»', async () => {
    await montar();

    expect(radio('performer-option-patient-choice').checked).toBe(true);
    expect(radio('performer-option-self').checked).toBe(false);
    expect(radio('performer-option-organization').checked).toBe(false);
    expect(eleccion()).toEqual(DEFAULT_PERFORMER_CHOICE);
    expect(byTestId('performer-option-self')!.textContent).toContain('Lo hago yo');
    expect(byTestId('performer-option-organization')!.textContent).toContain('En este centro');
    expect(byTestId('performer-sites')).toBeNull();
  });

  it('«Lo hago yo» deshabilitada con el motivo visible si no hay sedes propias', async () => {
    await montar({ ownSites: [] });

    expect(radio('performer-option-self').disabled).toBe(true);
    expect(byTestId('performer-self-reason')!.textContent).toContain(NO_OWN_SITE_REASON);
    expect(NO_OWN_SITE_REASON).toBe('No tiene una sede activa que publique este procedimiento con precio');
    expect(radio('performer-option-organization').disabled).toBe(false);
  });

  it('con sedes propias «Lo hago yo» está disponible y no muestra motivo', async () => {
    await montar();

    expect(radio('performer-option-self').disabled).toBe(false);
    expect(byTestId('performer-self-reason')).toBeNull();
  });

  it('el texto de recomendación está presente en los tres modos', async () => {
    await montar();
    const texto = 'Es una recomendación. Su paciente puede elegir otro lugar.';

    expect(byTestId('performer-recommendation')!.textContent).toContain(texto);
    await elegir('performer-option-self');
    expect(byTestId('performer-recommendation')!.textContent).toContain(texto);
    await elegir('performer-option-organization');
    expect(byTestId('performer-recommendation')!.textContent).toContain(texto);
  });

  it('«En este centro» muestra las sedes en el orden recibido', async () => {
    await montar();
    await elegir('performer-option-organization');

    const nombres = Array.from(host.querySelectorAll('[data-testid="performer-site"]')).map((n) =>
      (n.textContent ?? '').trim(),
    );
    expect(nombres).toEqual(['Centro Sur', 'Centro Norte · Av. 1', 'Centro Este']);
    expect(eleccion()).toEqual({ mode: 'ORGANIZATION', siteId: null });
  });

  it('elegir una sede la guarda en la elección', async () => {
    await montar();
    await elegir('performer-option-self');
    host.querySelector<HTMLInputElement>('[data-testid="performer-site"] input')!.click();
    await fixture.whenStable();

    expect(eleccion()).toEqual({ mode: 'SELF', siteId: 's-1' });
  });

  it('cambiar de modo descarta la sede del modo anterior', async () => {
    await montar();
    await elegir('performer-option-organization');
    host.querySelectorAll<HTMLInputElement>('[data-testid="performer-site"] input')[2]!.click();
    await fixture.whenStable();
    expect(eleccion()).toEqual({ mode: 'ORGANIZATION', siteId: 's-2' });

    await elegir('performer-option-self');
    expect(eleccion()).toEqual({ mode: 'SELF', siteId: null });
  });

  it('vuelve a «Que elija el paciente» si las sedes del modo elegido desaparecen', async () => {
    await montar();
    await elegir('performer-option-self');

    fixture.componentRef.setInput('ownSites', []);
    await fixture.whenStable();

    expect(eleccion()).toEqual(DEFAULT_PERFORMER_CHOICE);
    expect(radio('performer-option-patient-choice').checked).toBe(true);
  });

  it('sin procedimiento elegido las dos opciones de sede están deshabilitadas y lo dicen', async () => {
    await montar({ procedureConceptId: null });

    expect(radio('performer-option-self').disabled).toBe(true);
    expect(radio('performer-option-organization').disabled).toBe(true);
    expect(byTestId('performer-self-reason')!.textContent).toContain('Elija primero el procedimiento');
  });

  it('con error de lectura no inventa sedes: deshabilita y muestra el motivo', async () => {
    await montar({ sitesError: 'No pudimos leer las sedes.' });

    expect(radio('performer-option-self').disabled).toBe(true);
    expect(radio('performer-option-organization').disabled).toBe(true);
    expect(byTestId('performer-organization-reason')!.textContent).toContain('No pudimos leer las sedes.');
  });

  it('mientras lee las sedes las deshabilita con «Buscando sedes…»', async () => {
    await montar({ sitesLoading: true });

    expect(radio('performer-option-self').disabled).toBe(true);
    expect(byTestId('performer-self-reason')!.textContent).toContain('Buscando sedes…');
  });

  it('usa data-testid en inglés', async () => {
    await montar();
    await elegir('performer-option-organization');

    for (const id of [
      'performer-selector',
      'performer-option-self',
      'performer-option-organization',
      'performer-option-patient-choice',
      'performer-site',
    ]) {
      expect(byTestId(id), id).not.toBeNull();
    }
  });
});
