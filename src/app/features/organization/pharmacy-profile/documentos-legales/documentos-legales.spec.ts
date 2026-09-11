import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DOCUMENTOS_DE_EJEMPLO } from '../pharmacy-profile.fixtures';
import { DocumentosLegales } from './documentos-legales';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { DocumentoLegal } from '../pharmacy-profile.types';
import type { ViewState } from '../../../../core/view-state/view-state.types';

describe('DocumentosLegales', () => {
  let fixture: ComponentFixture<DocumentosLegales>;
  let toasts: ToastService;

  /** La carpeta vacía, tal como la declara la ficha. */
  const CARPETA_VACIA = empty(
    { label: 'Cargar el primer documento' },
    'Todavía no hay ningún papel en la carpeta legal de tu farmacia.',
  );

  function montar(state: ViewState<readonly DocumentoLegal[]>): HTMLElement {
    fixture = TestBed.createComponent(DocumentosLegales);
    toasts = TestBed.inject(ToastService);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function pulsar(root: HTMLElement, testId: string): void {
    const boton = root.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    expect(boton, testId).not.toBeNull();
    boton?.click();
    fixture.detectChanges();
  }

  /**
   * Elige un archivo por el camino real: el `<input type="file">` que está en
   * pantalla. jsdom no deja asignar `files`, así que se define la propiedad y
   * se dispara el mismo evento que dispara el navegador.
   */
  function elegirArchivo(root: HTMLElement, nombre: string, tipo = 'application/pdf'): void {
    const campo = root.querySelector<HTMLInputElement>('input[type="file"]');
    expect(campo).not.toBeNull();
    Object.defineProperty(campo, 'files', {
      value: [new File(['x'], nombre, { type: tipo })],
      configurable: true,
    });
    campo?.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  afterEach(() => fixture.destroy());

  it('pinta los seis papeles que el registro pide, en su orden', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    const nombres = Array.from(root.querySelectorAll('h3')).map((titulo) =>
      titulo.textContent?.trim(),
    );
    expect(nombres).toEqual([
      'Constitución de la empresa',
      'NIT',
      'SEPREC',
      'Licencia de funcionamiento',
      'Certificado SEDES',
      'Poder del representante legal',
    ]);
  });

  it('cada fila trae su archivo y su fecha de emisión, no sólo el vencimiento', () => {
    const texto = montar(ready(DOCUMENTOS_DE_EJEMPLO)).textContent ?? '';

    expect(texto).toContain('certificado-sedes-2025.pdf');
    expect(texto).toContain('Emitido el');
  });

  it('el plazo se dice en palabras, con el mismo criterio que el resto del sistema', () => {
    const texto = montar(ready(DOCUMENTOS_DE_EJEMPLO)).textContent ?? '';

    expect(texto).toContain('vencido hace 12 días');
    expect(texto).toContain('vence en 18 días');
  });

  it('la severidad del plazo la lleva el distintivo, no sólo el texto', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    const vencido = Array.from(root.querySelectorAll('app-badge')).find((badge) =>
      badge.textContent?.includes('vencido hace 12 días'),
    );
    expect(vencido?.className).toContain('badge--error');
  });

  it('un papel vencido y verificado dice las dos cosas, cada una en su distintivo', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    const fila = Array.from(root.querySelectorAll('li')).find((renglon) =>
      renglon.textContent?.includes('Certificado SEDES'),
    );
    const distintivos = Array.from(fila?.querySelectorAll('app-badge') ?? []);

    expect(distintivos.map((badge) => badge.textContent?.trim())).toEqual([
      'vencido hace 12 días',
      'Verificado',
    ]);
    // Y con severidades distintas: el plazo alarma, la revisión está en orden.
    expect(distintivos[0].className).toContain('badge--error');
    expect(distintivos[1].className).toContain('badge--success');
  });

  it('declara en pantalla que los estados de revisión son provisionales, y que el plazo va aparte', () => {
    const nota = montar(ready(DOCUMENTOS_DE_EJEMPLO)).querySelector(
      '[data-testid="ficha-nota-verificacion"]',
    );

    expect(nota?.textContent ?? '').toContain('provisionales');
    expect(nota?.textContent ?? '').toContain('El plazo es otra cosa');
  });

  it('los botones repetidos dicen de qué documento son', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    expect(
      root.querySelector('[data-testid="ficha-descargar-seprec"]')?.getAttribute('aria-label'),
    ).toBe('Descargar SEPREC');
    expect(
      root.querySelector('[data-testid="ficha-reemplazar-seprec"]')?.getAttribute('aria-label'),
    ).toBe('Reemplazar SEPREC');
  });

  it('la descarga no baja un archivo vacío: avisa qué falta para que exista', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    pulsar(root, 'ficha-descargar-seprec');

    const aviso = toasts.toasts().at(-1);
    expect(aviso?.title).toBe('Documento de ejemplo');
    expect(aviso?.message).toContain('seprec-matricula-comercio.pdf');
  });

  it('el selector de archivo se abre en la fila que se pidió, y en una sola', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    pulsar(root, 'ficha-reemplazar-nit');

    expect(root.querySelectorAll('app-file-input')).toHaveLength(1);
  });

  it('el archivo elegido se ve rotulado: se muestra, pero todavía no está subido', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    pulsar(root, 'ficha-reemplazar-nit');
    elegirArchivo(root, 'nit-actualizado.pdf');

    const texto = root.textContent ?? '';
    expect(texto).toContain('nit-actualizado.pdf');
    expect(texto).toContain('Sin subir');
    // Y el selector se cierra: ya se eligió.
    expect(root.querySelector('app-file-input')).toBeNull();
  });

  it('lo que el control descarta se dice en voz alta, con el motivo', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    pulsar(root, 'ficha-reemplazar-nit');
    // Un documento de texto donde va un PDF: el control lo descarta en
    // silencio, y lo que se prueba es que la pantalla lo cuente.
    elegirArchivo(
      root,
      'nit-actualizado.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    const aviso = toasts.toasts().at(-1);
    expect(aviso?.title).toBe('Archivo no aceptado');
    expect(aviso?.message).toContain('«nit-actualizado.docx»');
    expect(aviso?.message).toContain('el registro pide el documento en PDF');
    // Y no entra a la fila: lo rechazado no se muestra como si estuviera.
    //
    // Se mide contra la LISTA de documentos y no contra el componente entero
    // (integración de `mockup`, 11/09/2026). `app-file-input` gana ahí una
    // región `role="alert"` que nombra lo descartado con su motivo —«Formato no
    // permitido. Sólo PDF»—, así que el nombre sí aparece, y debe aparecer: es
    // el aviso pegado al control, para quien no ve pasar el toast. Lo que la
    // prueba prohíbe sigue siendo lo mismo que prohibía: que el archivo se
    // cuele en la fila como un papel cargado.
    const lista = root.querySelector('[data-testid="ficha-documentos"]')?.cloneNode(true);
    // El selector vive DENTRO de la fila del NIT, así que su aviso cuenta como
    // texto de la lista: se lo quita antes de mirar. Lo que queda es la fila
    // propiamente dicha, que es donde el archivo no tiene que estar.
    if (lista instanceof Element) {
      lista.querySelectorAll('app-file-input').forEach((selector) => selector.remove());
    }
    expect((lista as Element | undefined)?.textContent ?? '').not.toContain(
      'nit-actualizado.docx',
    );
  });

  it('mientras carga muestra el esqueleto y ningún papel', () => {
    const root = montar(loading());

    expect(root.querySelector('app-skeleton')).not.toBeNull();
    expect(root.textContent ?? '').not.toContain('Certificado SEDES');
  });

  describe('la carpeta vacía', () => {
    it('ofrece su próxima acción y no una lista en blanco', () => {
      const root = montar(CARPETA_VACIA);

      expect(root.querySelector('[data-testid="ficha-documentos"]')).toBeNull();
      expect(
        root.querySelector('[data-testid="ficha-cargar-primer-documento"]')?.textContent?.trim(),
      ).toBe('Cargar el primer documento');
    });

    it('su próxima acción abre el alta ahí mismo, sin llevar a ninguna parte', () => {
      const root = montar(CARPETA_VACIA);

      pulsar(root, 'ficha-cargar-primer-documento');

      expect(root.querySelectorAll('[data-testid="ficha-alta-documento"]')).toHaveLength(1);
    });

    it('cargar el primer papel saca a la carpeta del vacío', () => {
      const root = montar(CARPETA_VACIA);

      pulsar(root, 'ficha-cargar-primer-documento');
      elegirArchivo(root, 'constitucion-escaneada.pdf');

      expect(root.querySelector('[data-testid="ficha-documentos"]')).not.toBeNull();
      expect(root.querySelectorAll('[data-testid="ficha-documentos"] li')).toHaveLength(1);
      expect(root.querySelector('[data-testid="ficha-cargar-primer-documento"]')).toBeNull();
    });

    it('el papel recién cargado entra sin fechas, pendiente de revisión y sin subir', () => {
      const root = montar(CARPETA_VACIA);

      pulsar(root, 'ficha-cargar-primer-documento');
      elegirArchivo(root, 'constitucion-escaneada.pdf');

      const texto = root.querySelector('[data-testid="ficha-documentos"]')?.textContent ?? '';
      expect(texto).toContain('Constitución de la empresa');
      expect(texto).toContain('constitucion-escaneada.pdf');
      expect(texto).toContain('Sin subir');
      expect(texto).toContain('Sin declarar');
      expect(texto).toContain('sin vencimiento declarado');
      expect(texto).toContain('Pendiente de verificación');
    });
  });

  describe('agregar un papel que falta', () => {
    it('sólo ofrece los papeles del registro que la carpeta no tiene', () => {
      const root = montar(ready(DOCUMENTOS_DE_EJEMPLO.slice(0, 4)));

      pulsar(root, 'ficha-agregar-documento');

      const opciones = Array.from(root.querySelectorAll('option'))
        .map((opcion) => opcion.textContent?.trim())
        .filter((texto) => texto !== 'Elegí el documento');
      expect(opciones).toEqual(['Certificado SEDES', 'Poder del representante legal']);
    });

    it('con los seis cargados no se ofrece agregar nada', () => {
      const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

      expect(root.querySelector('[data-testid="ficha-agregar-documento"]')).toBeNull();
    });

    it('el papel agregado se suma a la carpeta y deja de ofrecerse', () => {
      const root = montar(ready(DOCUMENTOS_DE_EJEMPLO.slice(0, 5)));

      pulsar(root, 'ficha-agregar-documento');
      elegirArchivo(root, 'poder-escaneado.pdf');

      expect(root.querySelectorAll('[data-testid="ficha-documentos"] li')).toHaveLength(6);
      expect(root.querySelector('[data-testid="ficha-agregar-documento"]')).toBeNull();
      expect(root.querySelector('[data-testid="ficha-alta-documento"]')).toBeNull();
    });

    it('un papel agregado también se puede reemplazar, y la fila muestra el último archivo', () => {
      const root = montar(ready(DOCUMENTOS_DE_EJEMPLO.slice(0, 5)));

      pulsar(root, 'ficha-agregar-documento');
      elegirArchivo(root, 'poder-escaneado.pdf');
      expect(root.textContent ?? '').toContain('poder-escaneado.pdf');

      pulsar(root, 'ficha-reemplazar-poder-del-representante');
      elegirArchivo(root, 'poder-corregido.pdf');

      const texto = root.textContent ?? '';
      expect(texto).toContain('poder-corregido.pdf');
      expect(texto).not.toContain('poder-escaneado.pdf');
      expect(texto).toContain('Sin subir');
    });

    it('cargar un papel avisa que el archivo todavía no se sube', () => {
      const root = montar(ready(DOCUMENTOS_DE_EJEMPLO.slice(0, 5)));

      pulsar(root, 'ficha-agregar-documento');
      elegirArchivo(root, 'poder-escaneado.pdf');

      const aviso = toasts.toasts().at(-1);
      expect(aviso?.title).toBe('Archivo de ejemplo');
      expect(aviso?.message).toContain('poder-escaneado.pdf');
    });

    it('se puede cerrar el alta sin cargar nada', () => {
      const root = montar(ready(DOCUMENTOS_DE_EJEMPLO.slice(0, 5)));

      pulsar(root, 'ficha-agregar-documento');
      pulsar(root, 'ficha-cancelar-alta');

      expect(root.querySelector('[data-testid="ficha-alta-documento"]')).toBeNull();
      expect(root.querySelectorAll('[data-testid="ficha-documentos"] li')).toHaveLength(5);
    });
  });
});
