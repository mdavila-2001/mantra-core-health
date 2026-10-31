import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { ReplyTemplate, SupportConversation } from '../../../core/data-access/support-access/support-inbox.types';
import { ReplyComposer } from './reply-composer';

const PLANTILLAS: ReplyTemplate[] = [
  { id: 't-general', category: 'GENERAL', title: 'Recibimos su mensaje', bodyText: 'Hola {paciente}, recibimos su mensaje.' },
  { id: 't-citas', category: 'SCHEDULING', title: 'Proponer otro horario', bodyText: 'Hola {paciente}, {doctor} puede atenderle el jueves.' },
];

function conversacion(parcial: Partial<SupportConversation> = {}): SupportConversation {
  return {
    conversationId: 'c-1',
    organizationId: 't-1',
    organizationName: 'Hospital Piloto Mantra',
    practitionerProfileId: 'h-perez',
    doctorPublicProfileId: 'pub-perez',
    practitionerName: 'Dr. Andrés Pérez',
    practitionerSpecialty: 'Cardiología',
    patientLabel: 'Ana Lucía Pérez',
    status: 'NEW',
    assignedToMe: false,
    isClinical: false,
    replyDisclosure: 'SHOW',
    replyAllowed: true,
    assignableTo: [],
    messages: [],
    notes: [],
    patientContext: { clinicalAccess: 'NONE' },
    ...parcial,
  };
}

@Component({
  imports: [ReplyComposer],
  template: `<app-reply-composer [conversation]="c()" [templates]="plantillas" [busy]="ocupado()" [failure]="fallo()" (send)="enviados.push($event)" (sendWithEmail)="conCorreo.push($event)" (derive)="derivadas.push(1)" (note)="notas.push($event)" />`,
})
class Host {
  readonly c = signal<SupportConversation>(conversacion());
  readonly ocupado = signal(false);
  readonly fallo = signal<string | null>(null);
  readonly plantillas = PLANTILLAS;
  readonly enviados: string[] = [];
  readonly conCorreo: string[] = [];
  readonly derivadas: number[] = [];
  readonly notas: string[] = [];
  readonly compositor = viewChild(ReplyComposer);
}

describe('ReplyComposer', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => raiz().querySelector(`[data-testid="${id}"]`);
  const campo = (): HTMLTextAreaElement => raiz().querySelector('textarea')!;
  const boton = (id: string): HTMLButtonElement => byId(id) as HTMLButtonElement;
  /** `app-button` se deshabilita con `aria-disabled`: sigue enfocable y el lector anuncia su estado. */
  const inactivo = (id: string): boolean => byId(id)!.getAttribute('aria-disabled') === 'true';
  const clic = (el: Element | null): void => {
    (el as HTMLElement).click();
    fixture.detectChanges();
  };
  const escribir = (texto: string): void => {
    campo().value = texto;
    campo().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('el aviso permanente', () => {
    it('dice en nombre de quién se responde, qué ve el paciente y que la autora queda registrada', () => {
      const aviso = byId('aviso-en-nombre')!;
      expect(aviso.getAttribute('role')).toBe('note');
      expect(aviso.textContent).toContain('Está respondiendo como Dr. Andrés Pérez.');
      expect(aviso.textContent).toContain('El paciente verá «respondido por su equipo».');
      expect(aviso.textContent).toContain('Su nombre queda registrado como autora.');
    });

    it('cuando el doctor apagó el aviso, lo dice', () => {
      host.c.set(conversacion({ replyDisclosure: 'HIDE' }));
      fixture.detectChanges();
      expect(byId('aviso-en-nombre')!.textContent).toContain('El paciente no verá que respondió su equipo');
    });

    it('sigue ahí en modo nota interna', () => {
      clic(raiz().querySelector('[data-value="NOTE"]'));
      expect(byId('aviso-en-nombre')).not.toBeNull();
    });
  });

  describe('responder', () => {
    it('el botón principal dice «Enviar como Dr. X» y envía lo escrito, sin espacios de más', () => {
      expect(boton('enviar-respuesta').textContent!.trim()).toBe('Enviar como Dr. Andrés Pérez');
      expect(inactivo('enviar-respuesta')).toBe(true);
      escribir('  Le confirmamos el jueves.  ');
      expect(inactivo('enviar-respuesta')).toBe(false);
      clic(byId('enviar-respuesta'));
      expect(host.enviados).toEqual(['Le confirmamos el jueves.']);
      expect(host.derivadas).toEqual([]);
    });

    it('con «Mandar también por correo» avisa y emite por la salida del correo, una sola vez', () => {
      const interruptor = (): HTMLInputElement => byId('correo-interruptor')!.querySelector('input')!;
      expect(byId('correo-aviso')).toBeNull();
      interruptor().click();
      fixture.detectChanges();
      expect(byId('correo-aviso')!.textContent).toContain('a nombre de Dr. Andrés Pérez');
      escribir('Le confirmamos el jueves.');
      clic(byId('enviar-respuesta'));
      expect(host.conCorreo).toEqual(['Le confirmamos el jueves.']);
      expect(host.enviados).toEqual([]);
      // Al terminar bien, el que llama limpia: la decisión no queda marcada para la siguiente respuesta.
      host.compositor()!.clear();
      fixture.detectChanges();
      expect(interruptor().checked).toBe(false);
    });

    it('no envía un texto vacío ni mientras hay una petición en vuelo', () => {
      escribir('Hola');
      host.ocupado.set(true);
      fixture.detectChanges();
      expect(inactivo('enviar-respuesta')).toBe(true);
      expect(campo().disabled).toBe(true);
    });

    it('muestra el motivo si la API rechazó el envío y conserva el borrador', () => {
      escribir('Hola, buen día.');
      host.fallo.set('Mariela Soliz ya tiene esta conversación.');
      fixture.detectChanges();
      expect(byId('compositor-error')!.textContent).toContain('Mariela Soliz ya tiene esta conversación.');
      expect(campo().value).toBe('Hola, buen día.');
    });

    it('«clear» vacía el borrador cuando el envío salió bien', () => {
      escribir('Hola');
      host.compositor()!.clear();
      fixture.detectChanges();
      expect(campo().value).toBe('');
    });

    it('cambiar de conversación empieza con el borrador limpio', () => {
      escribir('Algo a medias');
      host.c.set(conversacion({ conversationId: 'c-2' }));
      fixture.detectChanges();
      expect(campo().value).toBe('');
    });
  });

  describe('mensaje clínico', () => {
    beforeEach(() => {
      host.c.set(conversacion({ isClinical: true }));
      fixture.detectChanges();
    });

    it('advierte que el equipo no responde contenido clínico', () => {
      const aviso = byId('aviso-bloqueo')!;
      expect(aviso.textContent).toContain('Mensaje clínico');
      expect(aviso.textContent).toContain('Solo el doctor puede responder su contenido');
    });

    it('«Derivar al doctor» pasa a ser el botón principal y enviar no está disponible', () => {
      expect(boton('derivar-principal').textContent!.trim()).toBe('Derivar al doctor');
      expect(inactivo('enviar-respuesta')).toBe(true);
      expect(boton('enviar-respuesta').classList.contains('btn--primary')).toBe(false);
      expect(boton('derivar-principal').classList.contains('btn--primary')).toBe(true);
    });

    it('derivar avisa a quien lo ejecuta', () => {
      clic(byId('derivar-principal'));
      expect(host.derivadas).toHaveLength(1);
    });

    it('no se puede escribir la respuesta, pero sí una nota interna', () => {
      expect(campo().disabled).toBe(true);
      expect(boton('plantillas-abrir').disabled).toBe(true);
      clic(raiz().querySelector('[data-value="NOTE"]'));
      expect(campo().disabled).toBe(false);
      escribir('Pasarle los últimos resultados al doctor.');
      clic(byId('guardar-nota'));
      expect(host.notas).toEqual(['Pasarle los últimos resultados al doctor.']);
      expect(host.enviados).toEqual([]);
    });

    it('ya derivado, enviar vuelve a estar disponible y es el principal', () => {
      host.c.set(conversacion({ isClinical: true, status: 'WAITING_DOCTOR', assignedToMe: true }));
      fixture.detectChanges();
      expect(byId('derivar-principal')).toBeNull();
      expect(byId('aviso-bloqueo')).toBeNull();
      escribir('Su consulta ya está con el doctor.');
      clic(byId('enviar-respuesta'));
      expect(host.enviados).toEqual(['Su consulta ya está con el doctor.']);
    });
  });

  describe('cuando no se puede responder ahora', () => {
    it('cuando la tiene otra persona, dice quién', () => {
      host.c.set(conversacion({ status: 'TAKEN', assignedToName: 'Mariela Soliz' }));
      fixture.detectChanges();
      expect(byId('aviso-bloqueo')!.textContent).toContain('Mariela Soliz tiene esta conversación');
      expect(campo().disabled).toBe(true);
    });
  });

  describe('plantillas', () => {
    it('se agrupan por categoría y se abren a pedido', () => {
      expect(byId('plantillas-lista')).toBeNull();
      expect(boton('plantillas-abrir').getAttribute('aria-expanded')).toBe('false');
      clic(byId('plantillas-abrir'));
      expect(boton('plantillas-abrir').getAttribute('aria-expanded')).toBe('true');
      const titulos = [...raiz().querySelectorAll('.grupo__titulo')].map((t) => t.textContent!.trim());
      expect(titulos).toEqual(['General', 'Citas']);
    });

    it('insertar una completa el nombre del paciente y del doctor, y deja editar antes de enviar', () => {
      clic(byId('plantillas-abrir'));
      clic(byId('plantilla-t-citas'));
      expect(campo().value).toBe('Hola Ana, Dr. Andrés Pérez puede atenderle el jueves.');
      expect(byId('plantillas-lista')).toBeNull();
      escribir(`${campo().value} ¿Le sirve?`);
      clic(byId('enviar-respuesta'));
      expect(host.enviados).toEqual(['Hola Ana, Dr. Andrés Pérez puede atenderle el jueves. ¿Le sirve?']);
    });

    it('una segunda plantilla se suma en una línea aparte', () => {
      clic(byId('plantillas-abrir'));
      clic(byId('plantilla-t-general'));
      clic(byId('plantillas-abrir'));
      clic(byId('plantilla-t-citas'));
      expect(campo().value).toBe('Hola Ana, recibimos su mensaje.\nHola Ana, Dr. Andrés Pérez puede atenderle el jueves.');
    });
  });

  describe('nota interna', () => {
    it('no sale al paciente: avisa que solo el equipo la ve, y guarda sin espacios de más', () => {
      clic(raiz().querySelector('[data-value="NOTE"]'));
      expect(byId('aviso-nota')!.textContent).toContain('El paciente nunca la ve');
      expect(byId('enviar-respuesta')).toBeNull();
      expect(byId('plantillas-abrir')).toBeNull();
      escribir(' Llamar a caja. ');
      clic(byId('guardar-nota'));
      expect(host.notas).toEqual(['Llamar a caja.']);
      expect(host.enviados).toEqual([]);
    });
  });
});
