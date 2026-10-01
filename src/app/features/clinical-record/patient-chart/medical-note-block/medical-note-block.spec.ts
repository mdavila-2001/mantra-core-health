import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import { MedicalNoteBlock } from './medical-note-block';

/**
 * La nota médica (C1): la tabla campo/valor que la médica escribe en cada
 * cita.
 *
 * Lo que fijan estas pruebas:
 *
 * 1. **Guardar sólo con algo que guardar.** Sin filas ni texto, o con una
 *    fila a medias, el botón está apagado; con una fila válida, encendido.
 * 2. **Lo que viaja es lo que se escribió.** Las filas recortadas, el
 *    encuentro, y sin `subjectiveText` cuando el texto libre está vacío.
 * 3. **Dos filas con el mismo campo no se guardan**, y se dice en la fila.
 * 4. **Firmada no ofrece «Firmar»**; borrador sí, y firmar va a la versión
 *    vigente.
 * 5. **Sin encuentro no hay nota**: aviso y guardar apagado.
 */

const NOTAS = {
  items: [
    {
      noteId: 'note-1111-aaaa',
      encounterId: 'e-1',
      lifecycleStatusConceptId: 'st-draft',
      currentVersionId: 'v-1',
      versionNumber: 1,
      authorProfileId: 'hp-1',
      entries: [
        { label: 'Presión arterial', value: '120/80' },
        { label: 'Dolor', value: 'Lumbar, 6/10' },
      ],
      subjectiveText: 'Refiere que empezó tras un viaje.',
      releasedToPatient: false,
      createdAt: '2026-09-25T10:00:00.000Z',
    },
    {
      noteId: 'note-2222-bbbb',
      encounterId: 'e-0',
      lifecycleStatusConceptId: 'st-completed',
      currentVersionId: 'v-2',
      versionNumber: 2,
      authorProfileId: 'hp-2',
      entries: [{ label: 'Peso', value: '68 kg' }],
      signedAt: '2026-08-10T09:00:00.000Z',
      releasedToPatient: true,
      createdAt: '2026-08-10T08:30:00.000Z',
    },
  ],
  count: 2,
  limit: 50,
  nextCursor: null,
};

describe('MedicalNoteBlock', () => {
  let fixture: ComponentFixture<MedicalNoteBlock>;
  let http: HttpTestingController;

  function interno<T>(clave: string): T {
    return (fixture.componentInstance as unknown as Record<string, T>)[clave] as T;
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function escribirFila(indice: number, rotulo: string, valor: string): void {
    const fila = interno<() => readonly { clave: number }[]>('filas')()[indice]!;
    interno<(clave: number, v: string) => void>('fijarRotulo').call(
      fixture.componentInstance,
      fila.clave,
      rotulo,
    );
    interno<(clave: number, v: string) => void>('fijarValor').call(
      fixture.componentInstance,
      fila.clave,
      valor,
    );
    fixture.detectChanges();
  }

  async function montar(encounterId: string | null = 'e-1'): Promise<void> {
    fixture = TestBed.createComponent(MedicalNoteBlock);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', encounterId);
    fixture.detectChanges();
    http.expectOne((r) => r.method === 'GET' && r.url === '/charts/notes').flush(NOTAS);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MedicalNoteBlock],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            activeTenantId: signal<string | null>('t-1'),
            practitionerProfileId: signal<string | null>('hp-1'),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('arranca con una fila vacía y guardar apagado; una fila válida lo enciende', async () => {
    await montar();

    expect(raiz().querySelectorAll('[data-testid="nota-medica-fila"]')).toHaveLength(1);
    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);

    escribirFila(0, 'Presión arterial', '');
    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);
    expect(interno<(c: number) => string>('problemaDe').call(fixture.componentInstance, 0)).toBe(
      'Falta el valor.',
    );

    escribirFila(0, 'Presión arterial', '120/80');
    expect(interno<() => boolean>('puedeGuardar')()).toBe(true);
    expect(raiz().querySelector('[data-testid="nota-medica-contador"]')?.textContent).toContain(
      '1 de 40',
    );
  });

  it('manda las filas recortadas contra el encuentro, sin texto libre vacío, y relee', async () => {
    await montar();
    escribirFila(0, '  Presión arterial ', ' 120/80 ');
    interno<() => void>('agregarFila').call(fixture.componentInstance);
    fixture.detectChanges();
    escribirFila(1, 'Dolor', 'Lumbar, 6/10');

    const guardada = vi.fn();
    fixture.componentInstance.guardada.subscribe(guardada);
    interno<() => void>('guardar').call(fixture.componentInstance);

    const alta = http.expectOne((r) => r.method === 'POST' && r.url === '/charts/notes');
    expect(alta.request.body).toEqual({
      patientProfileId: 'p-1',
      authorProfileId: 'hp-1',
      encounterId: 'e-1',
      entries: [
        { label: 'Presión arterial', value: '120/80' },
        { label: 'Dolor', value: 'Lumbar, 6/10' },
      ],
    });
    alta.flush(
      {
        noteId: 'n-9',
        versionId: 'v-9',
        versionNumber: 1,
        lifecycleStatusConceptId: 'st',
        versionStatusConceptId: 'st',
      },
      { status: 201, statusText: 'Created' },
    );
    http.expectOne((r) => r.method === 'GET' && r.url === '/charts/notes').flush(NOTAS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(guardada).toHaveBeenCalledTimes(1);
    // El formulario vuelve a una fila vacía: la nota ya está abajo.
    expect(interno<() => readonly unknown[]>('filasConContenido')()).toHaveLength(0);
    expect(raiz().querySelectorAll('[data-testid="nota-medica-fila"]')).toHaveLength(1);
  });

  it('no deja dos filas con el mismo campo, aunque cambien mayúsculas y tildes', async () => {
    await montar();
    escribirFila(0, 'Presión arterial', '120/80');
    interno<() => void>('agregarFila').call(fixture.componentInstance);
    fixture.detectChanges();
    escribirFila(1, 'presion ARTERIAL', '130/85');

    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);
    const segunda = interno<() => readonly { clave: number }[]>('filas')()[1]!;
    expect(
      interno<(c: number) => string>('problemaDe').call(fixture.componentInstance, segunda.clave),
    ).toBe('Ese campo ya está en otra fila.');
    expect(raiz().textContent).toContain('Ese campo ya está en otra fila.');
  });

  it('separa las notas de esta consulta de las anteriores y firma la vigente', async () => {
    await montar();

    const deEstaConsulta =
      interno<() => readonly { id: string; firmada: boolean }[]>('deEstaConsulta')();
    const anteriores = interno<() => readonly { id: string; firmada: boolean }[]>('anteriores')();
    expect(deEstaConsulta.map((n) => n.id)).toEqual(['note-1111-aaaa']);
    expect(anteriores.map((n) => n.id)).toEqual(['note-2222-bbbb']);
    expect(anteriores[0]!.firmada).toBe(true);

    // Las filas se leen como se escribieron, con su texto libre debajo.
    expect(raiz().textContent).toContain('Presión arterial');
    expect(raiz().textContent).toContain('Refiere que empezó tras un viaje.');

    const firmar = raiz().querySelectorAll<HTMLButtonElement>('[data-testid="nota-medica-firmar"]');
    // Sólo el borrador de esta consulta ofrece firmar; la firmada no.
    expect(firmar).toHaveLength(1);
    firmar[0]!.click();
    fixture.detectChanges();

    http
      .expectOne(
        (r) => r.method === 'POST' && r.url === '/charts/notes/note-1111-aaaa/versions/v-1/sign',
      )
      .flush({ ...NOTAS.items[0], signedAt: '2026-09-25T10:05:00.000Z' });
    http.expectOne((r) => r.method === 'GET' && r.url === '/charts/notes').flush(NOTAS);
    await fixture.whenStable();
  });

  it('sin encuentro avisa y no guarda, aunque haya una fila válida', async () => {
    await montar(null);
    escribirFila(0, 'Peso', '70 kg');

    expect(raiz().querySelector('[data-testid="nota-medica-sin-encuentro"]')).not.toBeNull();
    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);
    interno<() => void>('guardar').call(fixture.componentInstance);
    http.expectNone((r) => r.method === 'POST');
  });
});
