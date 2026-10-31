import { Component, input, model, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { loading, ready, unexpectedError } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Select } from '../../../../../shared/components/atoms/select/select';
import { SegmentedControl } from '../../../../../shared/components/molecules/segmented-control/segmented-control';
import { BodyRegionPicker } from '../../../../../shared/components/organisms/body-region-picker/body-region-picker';
import type { BodyRegionValue } from '../../../../../shared/components/organisms/body-region-picker/body-region-picker.logic';
import type { BodyRegionCatalogEntry } from '../../../../../core/data-access/anatomy-atlas/body-regions.types';
import {
  bigStudies,
  CONTRAST,
  LATERALITY_CONCEPTS,
  MODALITIES,
  REGION_CONCEPTS,
  REGIONS,
  STUDIES,
} from './imaging-study-picker.fixtures';
import { ImagingStudyPicker } from './imaging-study-picker';
import type {
  ContrastOption,
  ImagingModalityOption,
  ImagingSelection,
  ImagingStudyOption,
} from './imaging-study-picker.logic';

/*
 * GUION DE CAPTURA (lo ejecuta el orquestador; un solo navegador, en serie)
 * 1. Ficha de paciente con consulta abierta > «Pedir estudio» > tipo Imagenología.
 * 2. 1440 px, tema claro: elegir modalidad «Radiografía simple»; buscar «mano»;
 *    elegir «Radiografía de mano»: la región «Mano» queda elegida, el 3D la resalta,
 *    aparece el aviso «Falta indicar el lado» hasta tocar Izquierda/Derecha/Bilateral.
 * 3. Elegir «TC de cráneo sin y con contraste IV»: nota de preparación, contraste
 *    «Sin y con contraste» elegido y las otras dos opciones inhabilitadas.
 * 4. Repetir a 768 y 390 px (sin scroll horizontal) y en tema oscuro.
 * 5. Teclado: Tab por modalidad, buscador, estudio (Enter abre el diálogo), región, lado, contraste.
 * 6. Medir con el navegador: holgura izquierda/derecha del selector respecto de .app-main__inner (≤ 2 px).
 */

/** Las 14 del catálogo real: las tres de las pruebas y 11 más. */
function fourteen(): readonly ImagingModalityOption[] {
  return [...MODALITIES, ...Array.from({ length: 11 }, (_, i) => ({ codigo: `M${i}`, nombre: `Modalidad ${i}`, conceptId: `mx${i}` }))];
}

/** Doble del selector de región: lo que importa acá es el contrato de entradas/valor. */
@Component({
  selector: 'app-body-region-picker',
  template: `<p data-testid="stub-region">{{ value().region }}|{{ value().laterality }}|{{ allowed().join(',') }}|{{ modality() }}</p>`,
})
class StubRegionPicker {
  readonly regions = input.required<readonly BodyRegionCatalogEntry[]>();
  readonly allowed = input<readonly string[]>([]);
  readonly modality = input<string | null>(null);
  readonly disabled = input(false);
  readonly value = model<BodyRegionValue>({ region: null, laterality: null });
}

@Component({
  imports: [ImagingStudyPicker],
  template: `
    <app-imaging-study-picker
      [modalities]="modalities()"
      [studies]="studies()"
      [regions]="regions()"
      [contrastOptions]="contrast()"
      [regionConceptIds]="regionIds"
      [lateralityConceptIds]="lateralityIds"
      [state]="state()"
      [disabled]="disabled()"
      [(selection)]="selection"
      (retry)="retries = retries + 1"
    />
  `,
})
class HostComponent {
  readonly modalities = signal<readonly ImagingModalityOption[]>(fourteen());
  readonly studies = signal<readonly ImagingStudyOption[]>(STUDIES);
  readonly contrast = signal<readonly ContrastOption[]>(CONTRAST);
  readonly state = signal<ViewState<null>>(ready(null));
  readonly disabled = signal(false);
  readonly selection = signal<ImagingSelection | null>(null);
  readonly regions = signal<readonly BodyRegionCatalogEntry[]>(REGIONS);
  readonly regionIds = REGION_CONCEPTS;
  readonly lateralityIds = LATERALITY_CONCEPTS;
  retries = 0;
}

describe('ImagingStudyPicker', () => {
  let fixture: ComponentFixture<HostComponent>;
  let root: HTMLElement;
  let host: HostComponent;

  async function mount(real = false): Promise<void> {
    if (!real) {
      TestBed.overrideComponent(ImagingStudyPicker, {
        remove: { imports: [BodyRegionPicker] },
        add: { imports: [StubRegionPicker] },
      });
    }
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await settle();
  }

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const one = (id: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!el) throw new Error(`falta ${id}`);
    return el;
  };
  const text = (id: string): string => one(id).textContent!.replace(/\s+/g, ' ').trim();
  const studySelect = (): Select<string> => fixture.debugElement.query(By.css('[data-testid="imaging-picker-study"]')).componentInstance as Select<string>;
  const modalitySelect = (): Select<string> => fixture.debugElement.query(By.css('[data-testid="imaging-picker-modality"]')).componentInstance as Select<string>;
  const contrastControl = (): SegmentedControl => fixture.debugElement.query(By.css('[data-testid="imaging-picker-contrast"]')).componentInstance as SegmentedControl;
  const stub = (): StubRegionPicker => fixture.debugElement.query(By.directive(StubRegionPicker)).componentInstance as StubRegionPicker;

  async function pickStudy(id: string): Promise<void> {
    studySelect().value.set(id);
    await settle();
  }
  async function search(value: string): Promise<void> {
    const input = root.querySelector<HTMLInputElement>('app-search-field input')!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
  }
  const studyLabels = (): string[] => studySelect().options().map((o) => o.label);

  afterEach(() => TestBed.resetTestingModule());

  it('se renderiza con modalidad, buscador, estudio y el resumen vacío', async () => {
    await mount();
    expect(one('imaging-picker')).toBeTruthy();
    expect(modalitySelect()).toBeTruthy();
    expect(root.querySelector('app-search-field')).toBeTruthy();
    expect(studySelect().options()).toHaveLength(STUDIES.length);
    expect(text('imaging-picker-counter')).toBe('Todavía no eligió ningún estudio');
    expect(root.querySelector('app-body-region-picker')).toBeNull();
    expect(text('imaging-picker-results')).toBe('5 estudios encontrados');
  });

  it('con 14 modalidades usa un select con «todas» y el número de estudios de cada una', async () => {
    await mount();
    const options = modalitySelect().options();
    expect(options).toHaveLength(15);
    expect(options.slice(0, 4).map((o) => o.value)).toEqual(['*', 'RX', 'TC', 'RM']);
    expect(options[1]!.description).toBe('RX · 3 estudios');
    expect(root.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('no muestra el prefijo de sistema de la modalidad en las descripciones (`SC_MOD_RX` se lee «RX»)', async () => {
    // Defecto de la corrida con navegador (31/10/2026): el desplegable decía «SC_MOD_RF · Rodilla».
    await mount();
    host.modalities.set(fourteen().map((m, i) => (i === 0 ? { ...m, codigo: 'SC_MOD_RX' } : m)));
    host.studies.set(STUDIES.map((s) => (s.modalidad === 'RX' ? { ...s, modalidad: 'SC_MOD_RX' } : s)));
    await settle();
    expect(modalitySelect().options()[1]!.description).toBe('RX · 3 estudios');
    const descriptions = studySelect().options().map((o) => o.description ?? '');
    expect(descriptions.some((d) => d.includes('SC_MOD_'))).toBe(false);
    expect(descriptions.some((d) => d.startsWith('RX · '))).toBe(true);
  });

  it('con pocas modalidades las muestra en un radiogroup con nombre', async () => {
    await mount();
    host.modalities.set(MODALITIES);
    await settle();
    expect(root.querySelector('[data-testid="imaging-picker-modality"]')).toBeNull();
    const group = one('imaging-picker').querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Modalidad del estudio');
    expect(group?.querySelectorAll('[role="radio"]')).toHaveLength(3);
    (group!.querySelectorAll<HTMLElement>('[role="radio"]')[1]!).click();
    await settle();
    expect(studyLabels()).toEqual(['TC de cráneo sin y con contraste IV']);
  });

  it('filtrar por modalidad acota los estudios', async () => {
    await mount();
    modalitySelect().value.set('RX');
    await settle();
    expect(studyLabels()).toEqual(['Radiografía de tórax PA y lateral', 'Radiografía de mano', 'Estudio guiado de toracocentesis']);
    modalitySelect().value.set('*');
    await settle();
    expect(studySelect().options()).toHaveLength(STUDIES.length);
  });

  it('la búsqueda ignora tildes y mira sinónimos y proyecciones, y anuncia cuántos hay', async () => {
    await mount();
    await search('torax');
    expect(studyLabels()).toContain('Radiografía de tórax PA y lateral');
    await search('tac');
    expect(studyLabels()).toEqual(['TC de cráneo sin y con contraste IV']);
    expect(text('imaging-picker-results')).toBe('1 estudio encontrado');
    await search('oblicua');
    expect(studyLabels()).toEqual(['Radiografía de mano']);
    await search('zzzz');
    expect(one('imaging-picker-no-results')).toBeTruthy();
  });

  it('elegir un estudio fija modalidad, región por defecto, permitidas y contraste del catálogo', async () => {
    await mount();
    await pickStudy('s-tc-craneo');
    expect(host.selection()).toEqual({
      studyConceptId: 's-tc-craneo',
      modalityCode: 'TC',
      region: 'CRANEO',
      laterality: null,
      contrastConceptId: 'c-ambos',
    });
    expect(text('stub-region')).toBe('CRANEO||CRANEO|TC');
    expect(text('imaging-picker-counter')).toBe('TC de cráneo sin y con contraste IV: TC · Cráneo · sin y con contraste');
  });

  it('pasa al selector de región la región del estudio y sus hijas como permitidas', async () => {
    await mount();
    await pickStudy('s-rx-torax');
    expect(stub().allowed()).toEqual(['TORAX', 'PULMONES', 'COSTILLAS']);
    expect(stub().modality()).toBe('RX');
  });

  it('la región es editable dentro de las permitidas y se ignora fuera de ellas', async () => {
    await mount();
    await pickStudy('s-rx-torax');
    stub().value.set({ region: 'COSTILLAS', laterality: 'DER' });
    await settle();
    expect(host.selection()).toMatchObject({ region: 'COSTILLAS', laterality: 'DER' });
    stub().value.set({ region: 'CRANEO', laterality: null });
    await settle();
    expect(host.selection()).toMatchObject({ region: 'COSTILLAS' });
  });

  it('el estudio con lado obligatorio avisa y no es válido hasta indicar el lado', async () => {
    await mount();
    await pickStudy('s-rx-mano');
    expect(one('imaging-picker-issues').textContent).toContain('Falta indicar el lado');
    const picker = fixture.debugElement.query(By.directive(ImagingStudyPicker)).componentInstance as ImagingStudyPicker;
    expect(picker.valid()).toBe(false);
    expect(picker.request()).toBeNull();
    stub().value.set({ region: 'MANO', laterality: 'IZQ' });
    await settle();
    expect(root.querySelector('[data-testid="imaging-picker-issues"]')).toBeNull();
    expect(picker.valid()).toBe(true);
    expect(picker.request()).toEqual({
      studyConceptId: 's-rx-mano',
      imaging: { modalityConceptId: 'm-rx', bodySiteConceptId: 'r-mano', lateralityConceptId: 'l-izq', contrastConceptId: 'c-sin' },
    });
    expect(text('imaging-picker-counter')).toBe('Radiografía de mano: RX · Mano · Izquierda · sin contraste');
  });

  it('si el estudio exige lado y la región no lo ofrece, muestra su propio control de lado', async () => {
    await mount();
    await pickStudy('s-rx-mano');
    expect(root.querySelector('[data-testid="imaging-picker-own-laterality"]')).toBeNull();
    await pickStudy('s-eco-toraco');
    const own = one('imaging-picker-own-laterality');
    expect(own.querySelectorAll('[role="radio"]')).toHaveLength(3);
    (own.querySelector('[role="radio"]:nth-of-type(2)') as HTMLElement).click();
    await settle();
    expect(host.selection()?.laterality).toBe('DER');
    expect(root.querySelector('[data-testid="imaging-picker-issues"]')).toBeNull();
  });

  it('muestra proyecciones como chips y la preparación como nota informativa', async () => {
    await mount();
    await pickStudy('s-rx-torax');
    expect(one('imaging-picker-projections').querySelectorAll('li')).toHaveLength(2);
    expect(root.querySelector('[data-testid="imaging-picker-preparation"]')).toBeNull();
    await pickStudy('s-tc-craneo');
    expect(text('imaging-picker-preparation')).toContain('Ayuno de 4 h');
    expect(root.querySelector('[data-testid="imaging-picker-projections"]')).toBeNull();
  });

  it('el contraste fijo del estudio deja inhabilitadas las otras opciones', async () => {
    await mount();
    await pickStudy('s-tc-craneo');
    const radios = [...one('imaging-picker-contrast').querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    expect(radios.map((r) => r.hasAttribute('disabled') || r.getAttribute('aria-disabled') === 'true')).toEqual([true, true, false]);
    expect(text('imaging-picker-contrast-note')).toContain('lo define el estudio');
    expect(text('imaging-picker-contrast-note')).toContain('Vía: IV');
  });

  it('el estudio con contraste opcional deja elegir, con el default del catálogo', async () => {
    await mount();
    await pickStudy('s-rm-torax');
    expect(host.selection()?.contrastConceptId).toBe('c-sin');
    contrastControl().valueChange.emit('con');
    await settle();
    expect(host.selection()?.contrastConceptId).toBe('c-con');
    expect(text('imaging-picker-counter')).toContain('con contraste');
  });

  it('cambiar de estudio reinicia la elección con los valores del nuevo', async () => {
    await mount();
    await pickStudy('s-rm-torax');
    contrastControl().valueChange.emit('con');
    await pickStudy('s-rx-mano');
    expect(host.selection()).toMatchObject({ studyConceptId: 's-rx-mano', modalityCode: 'RX', region: 'MANO', contrastConceptId: 'c-sin' });
    // elegir el mismo estudio de nuevo no pierde lo ya editado
    stub().value.set({ region: 'MANO', laterality: 'DER' });
    await settle();
    await pickStudy('s-rx-mano');
    expect(host.selection()?.laterality).toBe('DER');
  });

  it('el estudio elegido sigue en la lista aunque la búsqueda lo excluya', async () => {
    await mount();
    await pickStudy('s-rx-mano');
    await search('torax');
    expect(studyLabels()).toEqual(['Radiografía de mano', 'Radiografía de tórax PA y lateral']);
    await search('zzzz');
    expect(studyLabels()).toEqual(['Radiografía de mano']);
    expect(studySelect().value()).toBe('s-rx-mano');
  });

  it('cambiar la modalidad a otra descarta un estudio de la anterior', async () => {
    await mount();
    await pickStudy('s-rx-mano');
    modalitySelect().value.set('TC');
    await settle();
    expect(host.selection()).toBeNull();
    expect(studyLabels()).toEqual(['TC de cráneo sin y con contraste IV']);
  });

  it('elegir un estudio con la modalidad en «todas» alinea el filtro con la del estudio', async () => {
    await mount();
    await pickStudy('s-tc-craneo');
    expect(modalitySelect().value()).toBe('TC');
  });

  it('estados del catálogo: cargando, error con reintento y vacío', async () => {
    await mount();
    host.state.set(loading());
    await settle();
    expect(root.querySelector('[data-testid="imaging-picker"]')).toBeNull();
    host.state.set(unexpectedError('REQ-1'));
    await settle();
    const retry = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => /reintentar/i.test(b.textContent ?? ''));
    expect(retry).toBeTruthy();
    retry!.click();
    await settle();
    expect(host.retries).toBe(1);
    host.state.set(ready(null));
    host.studies.set([]);
    await settle();
    expect(one('imaging-picker-catalog-empty')).toBeTruthy();
  });

  it('inhabilitado, bloquea sus controles', async () => {
    await mount();
    host.disabled.set(true);
    await settle();
    expect(studySelect().disabled()).toBe(true);
    expect(root.querySelector<HTMLInputElement>('app-search-field input')!.disabled).toBe(true);
  });

  it('con el catálogo completo de 475 estudios sigue respondiendo', async () => {
    await mount();
    host.studies.set(bigStudies());
    await settle();
    expect(studySelect().options()).toHaveLength(475);
    await search('numero 47');
    // 47, 147, 247, 347, 447 y 470 a 474
    expect(studySelect().options().length).toBe(10);
  });

  it('una selección externa (p. ej. un borrador) se refleja en los campos', async () => {
    await mount();
    host.selection.set({ studyConceptId: 's-rx-mano', modalityCode: 'RX', region: 'MANO', laterality: 'IZQ', contrastConceptId: 'c-sin' });
    await settle();
    expect(studySelect().value()).toBe('s-rx-mano');
    expect(text('stub-region')).toBe('MANO|IZQ|MANO|RX');
    expect(text('imaging-picker-counter')).toContain('Izquierda');
  });

  it('accesibilidad: regiones vivas, rótulos y sin ids duplicados', async () => {
    await mount();
    await pickStudy('s-rx-mano');
    for (const id of ['imaging-picker-results', 'imaging-picker-counter', 'imaging-picker-issues']) {
      expect(one(id).getAttribute('aria-live')).toBe('polite');
    }
    expect(root.querySelector('section[aria-labelledby="img-region-titulo"] h4')?.id).toBe('img-region-titulo');
    expect(root.querySelector('[aria-label="Contraste del estudio"]')).not.toBeNull();
    const ids = [...root.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
