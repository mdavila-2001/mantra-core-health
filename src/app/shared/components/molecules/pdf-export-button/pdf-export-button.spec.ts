import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PdfExportButton } from './pdf-export-button';
import { PdfExportService } from './pdf-export.service';


/**
 * Lo que estas pruebas fijan.
 *
 * No comprueban que el PDF salga bien —eso es de `pdf-export.spec.ts`— sino
 * **qué elemento se exporta**. Es la decisión que este componente toma solo, y
 * la que produce el defecto caro: exportar la pantalla entera con el menú
 * lateral adentro, o exportar la tabla equivocada de las dos que hay.
 */
@Component({
  imports: [PdfExportButton],
  template: `
    <aside>Menú lateral que NO debe salir en el PDF</aside>
    <section>
      <h2>Ficha del paciente</h2>
      <p>Contenido de la ficha</p>
      <app-pdf-export-button
        [filename]="nombre()"
        title="Ficha"
        [target]="objetivo()"
      />
    </section>
  `,
})
class Anfitrion {
  readonly nombre = signal('ficha-quiroz');
  readonly objetivo = signal<HTMLElement | null>(null);
}

/** Doble del servicio: registra qué se le pidió exportar, sin tocar jsPDF. */
class PdfFalso {
  element: HTMLElement | null = null;
  filename = '';
  title = '';
  fallar = false;

  export(
    element: HTMLElement,
    filename: string,
    options: { title?: string } = {},
  ): Promise<void> {
    if (this.fallar) {
      return Promise.reject(new Error('sin memoria'));
    }
    this.element = element;
    this.filename = filename;
    this.title = options.title ?? '';
    return Promise.resolve();
  }
}

describe('PdfExportButton', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let pdf: PdfFalso;

  beforeEach(async () => {
    pdf = new PdfFalso();

    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [{ provide: PdfExportService, useValue: pdf }],
    }).compileComponents();

    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  const pulsar = (): void => {
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  /**
   * Sin `target`, exporta **su contenedor** — nunca el `body`. Exportar la
   * aplicación entera metería el menú lateral en el documento.
   */
  it('sin objetivo exporta la sección que lo contiene, no la página', () => {
    pulsar();

    expect(pdf.element).not.toBeNull();
    expect(pdf.element!.tagName).toBe('SECTION');
    expect(pdf.element!.textContent).toContain('Ficha del paciente');
    expect(pdf.element!.textContent).not.toContain('Menú lateral');
  });

  it('con objetivo explícito exporta ese elemento', () => {
    const otro = document.createElement('article');
    otro.textContent = 'Otra cosa';
    fixture.componentInstance.objetivo.set(otro);
    fixture.detectChanges();

    pulsar();

    expect(pdf.element).toBe(otro);
  });

  it('pasa el nombre y el título tal como se los declaró', () => {
    pulsar();

    expect(pdf.filename).toBe('ficha-quiroz');
    expect(pdf.title).toBe('Ficha');
  });

  /**
   * Si la exportación revienta, se dice. Un botón que no hace nada se lee como
   * «la aplicación está rota» y termina en un reporte que nadie puede
   * reproducir.
   */
  it('si la exportación falla lo dice en pantalla', async () => {
    pdf.fallar = true;

    pulsar();
    // El motor se carga al usarlo, así que el fallo llega en un microtask.
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos generar el PDF');
  });
});
