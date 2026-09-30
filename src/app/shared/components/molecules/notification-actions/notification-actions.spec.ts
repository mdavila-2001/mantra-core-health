import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, Subject, throwError, type Observable } from 'rxjs';

import type { NotificationAction } from '../../../../core/data-access/notifications/notifications.types';
import {
  provideNotificationActionHandlers,
  type NotificationActionOutcome,
} from '../../../../core/notifications/notification-actions';
import { ToastService } from '../toast/toast.service';
import { NotificationActions } from './notification-actions';

/**
 * Los botones de una notificación.
 *
 * Lo que fija: sólo se dibujan las acciones que tienen manejador; ejecutar
 * cuenta el resultado en un aviso y avisa a la pantalla; un fallo se dice sin
 * avisar que terminó; los botones se bloquean mientras corre uno; y el clic no
 * burbujea hasta la fila que navega.
 */
describe('NotificationActions', () => {
  const ACCIONES: readonly NotificationAction[] = [
    { key: 'OK', label: 'Aceptar', tone: 'primary' },
    { key: 'NO', label: 'Rechazar', tone: 'danger' },
    { key: 'SIN_MANEJADOR', label: 'Fantasma' },
  ];

  let fixture: ComponentFixture<NotificationActions>;
  let toast: ToastService;
  let respuesta: () => Observable<NotificationActionOutcome>;
  const destinos: string[] = [];

  beforeEach(() => {
    destinos.length = 0;
    respuesta = () => of({ message: 'Listo.' });
    TestBed.configureTestingModule({
      providers: [
        provideNotificationActionHandlers(() => [
          {
            destinationType: 'X',
            key: 'OK',
            run: (destino) => {
              destinos.push(destino.id);
              return respuesta();
            },
          },
          { destinationType: 'X', key: 'NO', run: () => throwError(() => new Error('boom')) },
        ]),
      ],
    });
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(NotificationActions);
    fixture.componentRef.setInput('actions', ACCIONES);
    fixture.componentRef.setInput('destination', { type: 'X', id: 'sol-9' });
    fixture.detectChanges();
  });

  const botones = (): HTMLButtonElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

  it('sólo dibuja las acciones que tienen manejador', () => {
    expect(botones().map((b) => b.textContent!.trim())).toEqual(['Aceptar', 'Rechazar']);
  });

  it('sin acciones vigentes no dibuja ni el contenedor', () => {
    fixture.componentRef.setInput('actions', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.notificacion-acciones')).toBeNull();
  });

  it('ejecuta con el id del destino, cuenta el resultado y avisa a la pantalla', () => {
    const terminadas: string[] = [];
    fixture.componentInstance.executed.subscribe((key) => terminadas.push(key));

    botones()[0]!.click();
    fixture.detectChanges();

    expect(destinos).toEqual(['sol-9']);
    expect(toast.toasts().map((t) => [t.type, t.message])).toEqual([['success', 'Listo.']]);
    expect(terminadas).toEqual(['OK']);
  });

  it('si la acción falla lo dice y NO avisa que terminó', () => {
    const terminadas: string[] = [];
    fixture.componentInstance.executed.subscribe((key) => terminadas.push(key));

    botones()[1]!.click();
    fixture.detectChanges();

    expect(toast.toasts()[0]!.type).toBe('error');
    expect(toast.toasts()[0]!.message).toContain('Rechazar');
    expect(terminadas).toEqual([]);
    // Y se puede volver a intentar.
    expect(botones().every((b) => b.getAttribute('aria-disabled') !== 'true')).toBe(true);
  });

  it('mientras corre una acción bloquea todas, para no decidir dos veces', () => {
    const pendiente = new Subject<NotificationActionOutcome>();
    respuesta = () => pendiente;

    botones()[0]!.click();
    fixture.detectChanges();
    expect(botones().every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);

    botones()[0]!.click();
    expect(destinos).toEqual(['sol-9']);

    pendiente.next({ message: 'Listo.' });
    pendiente.complete();
    fixture.detectChanges();
    expect(botones().every((b) => b.getAttribute('aria-disabled') !== 'true')).toBe(true);
  });

  it('el clic no burbujea hasta la fila que navega', () => {
    const contenedor = fixture.nativeElement as HTMLElement;
    const burbuja = vi.fn();
    contenedor.addEventListener('click', burbuja);

    botones()[0]!.click();

    expect(burbuja).not.toHaveBeenCalled();
  });
});
