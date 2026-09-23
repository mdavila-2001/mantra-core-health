import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ChatPreferences } from './chat-preferences';
import { ChatAutoReply } from '../../../core/messaging/chat-auto-reply';

/**
 * Lo que estas pruebas fijan.
 *
 * Que la pantalla **dice su límite** —la respuesta automática sólo sale con la
 * aplicación abierta y sólo vive en este navegador—, que no ofrece configurar
 * lo que no tiene efecto mientras está apagada, y que lo que se elige queda
 * guardado. La primera es la que importa: prometer un contestador que funciona
 * con la pestaña cerrada sería mentirle a quien lo configura.
 */
describe('ChatPreferences', () => {
  let fixture: ComponentFixture<ChatPreferences>;
  let autoReply: ChatAutoReply;

  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [ChatPreferences] });
    autoReply = TestBed.inject(ChatAutoReply);
    fixture = TestBed.createComponent(ChatPreferences);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  /**
   * El interruptor nativo que `app-switch` pone adentro: el `data-testid` va en
   * el host del átomo, y lo que se acciona es su `input[role="switch"]`.
   */
  const interruptor = (testid: string): HTMLInputElement => {
    const control = consultar(testid)?.querySelector('input[role="switch"]');
    if (control === null || control === undefined) {
      throw new Error(`«${testid}» no ofrece interruptor`);
    }
    return control as HTMLInputElement;
  };

  const encender = (): void => {
    interruptor('chat-prefs-activa').click();
    fixture.detectChanges();
  };

  it('dice que sólo funciona con la aplicación abierta y en este navegador', () => {
    const aviso = consultar('chat-prefs-limite')?.textContent ?? '';

    expect(aviso).toContain('abierto');
    expect(aviso).toContain('otro dispositivo');
  });

  it('el encendido es un interruptor y se anuncia por su nombre', () => {
    const control = interruptor('chat-prefs-activa');

    expect(control.getAttribute('role')).toBe('switch');
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.getAttribute('aria-label')).toBe('Contestar sola cuando no estoy');
  });

  it('apagada no ofrece configurar lo que no tiene efecto', () => {
    expect(consultar('chat-prefs-texto')).toBeNull();
    expect(consultar('chat-prefs-descanso')).toBeNull();
  });

  it('encenderla la guarda y despliega sus opciones', () => {
    encender();

    expect(autoReply.configuracion().activa).toBe(true);
    expect(consultar('chat-prefs-texto')).not.toBeNull();
    expect(consultar('chat-prefs-descanso')).not.toBeNull();
  });

  it('elegir una espera la guarda', () => {
    encender();

    (consultar('chat-prefs-espera-15') as HTMLElement).click();
    fixture.detectChanges();

    expect(autoReply.configuracion().minutosDeInactividad).toBe(15);
    expect(consultar('chat-prefs-espera-15')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('guardar el texto lo persiste', async () => {
    encender();

    const area = consultar('chat-prefs-texto') as HTMLTextAreaElement;
    area.value = 'Estoy en consulta, respondo más tarde.';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    (consultar('chat-prefs-guardar') as HTMLElement).click();
    fixture.detectChanges();

    expect(autoReply.configuracion().texto).toBe(
      'Estoy en consulta, respondo más tarde.',
    );
    expect(consultar('chat-prefs-guardado')).not.toBeNull();
  });

  it('la franja horaria sólo aparece si se pide', () => {
    encender();
    expect(consultar('chat-prefs-desde')).toBeNull();

    interruptor('chat-prefs-horario').click();
    fixture.detectChanges();

    expect(consultar('chat-prefs-desde')).not.toBeNull();
    expect(autoReply.configuracion().soloFueraDeHorario).toBe(true);
  });

  it('las frases propias se agregan y se quitan', async () => {
    const campo = consultar('chat-prefs-plantilla-nueva') as HTMLInputElement;
    campo.value = 'Traé tu carnet de la obra social.';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    (consultar('chat-prefs-plantilla-guardar') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Traé tu carnet de la obra social.',
    );

    (consultar('chat-prefs-quitar-plantilla') as HTMLElement).click();
    fixture.detectChanges();

    expect(consultar('chat-prefs-quitar-plantilla')).toBeNull();
  });
});
