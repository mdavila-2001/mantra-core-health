import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ChatPreferences } from './chat-preferences';
import { ChatAutoReply, CONFIGURACION_POR_DEFECTO } from '../../../core/messaging/chat-auto-reply';
import { ChatStore } from '../../../core/messaging/chat.store';

/**
 * Lo que estas pruebas fijan.
 *
 * Que la pantalla **dice su límite** (dónde queda guardada y qué promete), que
 * arriba hay **una sola decisión** con tres respuestas que se excluyen, que
 * apagada no ofrece configurar lo que no tiene efecto, que la vista previa
 * muestra en vivo lo que va a recibir el paciente —con la etiqueta de IA
 * cuando corresponde—, que **nada se guarda hasta tocar «Guardar»** y que al
 * guardar se dice con palabras qué quedó. Con IA, que lo que la IA no hace
 * está a la vista y que el respaldo es obligatorio.
 */
describe('ChatPreferences', () => {
  let fixture: ComponentFixture<ChatPreferences>;
  let autoReply: ChatAutoReply;

  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const texto = (testid: string): string => consultar(testid)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  const montar = (iaDisponible = true): void => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [ChatPreferences] });
    autoReply = TestBed.inject(ChatAutoReply);
    vi.spyOn(autoReply, 'iaDisponible').mockReturnValue(iaDisponible);
    fixture = TestBed.createComponent(ChatPreferences);
    fixture.detectChanges();
  };

  const elegir = (modo: 'apagado' | 'fijo' | 'ia'): void => {
    (consultar(`chat-prefs-modo-${modo}`) as HTMLInputElement).click();
    fixture.detectChanges();
  };

  const escribir = async (valor: string): Promise<void> => {
    // `ngModel` escribe el valor inicial en una microtarea: se lo deja
    // terminar antes de tipear, o pisaría lo tipeado.
    await fixture.whenStable();
    const area = consultar('chat-prefs-texto') as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const guardar = (): void => {
    (consultar('chat-prefs-guardar') as HTMLElement).click();
    fixture.detectChanges();
  };

  /** El interruptor nativo que `app-switch` pone adentro. */
  const interruptor = (testid: string): HTMLInputElement => {
    const control = consultar(testid)?.querySelector('input[role="switch"]');
    if (control === null || control === undefined) {
      throw new Error(`«${testid}» no ofrece interruptor`);
    }
    return control as HTMLInputElement;
  };

  afterEach(() => localStorage.clear());

  it('dice que, sin perfil, sólo funciona con la aplicación abierta y en este navegador', () => {
    montar();
    const aviso = texto('chat-prefs-limite');

    expect(aviso).toContain('abierto');
    expect(aviso).toContain('otro dispositivo');
  });

  it('trae lo guardado en el servidor cuando el perfil termina de resolverse, y una sola vez', () => {
    montar();
    const cargar = vi.spyOn(autoReply, 'cargar').mockImplementation(() => undefined);
    const chat = TestBed.inject(ChatStore);

    chat.perfil.set('pp-1');
    chat.perfilPropio.set('pp-1');
    chat.perfilResuelto.set(true);
    fixture.detectChanges();
    TestBed.tick();
    chat.perfil.set('pp-1');
    TestBed.tick();

    expect(cargar).toHaveBeenCalledTimes(1);
    expect(cargar).toHaveBeenCalledWith('pp-1');
  });

  it('lo que llega del servidor se muestra, pero no pisa lo que la persona está eligiendo', () => {
    montar();
    // Sin tocar nada: la configuración que llega se ve.
    autoReply.configuracion.set({ ...CONFIGURACION_POR_DEFECTO, activa: true, conIa: true });
    fixture.detectChanges();
    expect((consultar('chat-prefs-modo-ia') as HTMLInputElement).checked).toBe(true);

    // Ya eligió otra cosa: lo que llega tarde no se la cambia, pero lo que no
    // tocó (la espera) sí se actualiza con lo del servidor.
    elegir('fijo');
    autoReply.configuracion.set({ ...CONFIGURACION_POR_DEFECTO, activa: false, minutosDeInactividad: 90 });
    fixture.detectChanges();
    expect((consultar('chat-prefs-modo-fijo') as HTMLInputElement).checked).toBe(true);
    expect((consultar('chat-prefs-minutos') as HTMLInputElement).value).toBe('90');
    expect(consultar('chat-prefs-sin-guardar')).not.toBeNull();
  });

  it('si el guardado no llega al servidor, no confirma: dice que falló', () => {
    montar();
    vi.spyOn(autoReply, 'guardar').mockImplementation((_cambios, _perfil, alTerminar) => alTerminar?.(false));
    elegir('fijo');
    guardar();

    expect(consultar('chat-prefs-guardado')).toBeNull();
    expect(texto('chat-prefs-error-guardar')).toBe(
      'No pudimos guardar los cambios en su cuenta. Revise su conexión e intente de nuevo.',
    );
    expect(consultar('chat-prefs-error-guardar')?.getAttribute('role')).toBe('alert');
  });

  it('la confirmación espera a que el servidor conteste, y mientras tanto no se vuelve a guardar', () => {
    montar();
    let terminar: ((llego: boolean) => void) | undefined;
    const subir = vi.spyOn(autoReply, 'guardar').mockImplementation((_cambios, _perfil, alTerminar) => {
      terminar = alTerminar;
    });
    elegir('fijo');
    guardar();

    expect(consultar('chat-prefs-guardado')).toBeNull();
    expect(consultar('chat-prefs-guardar')?.getAttribute('aria-disabled')).toBe('true');
    guardar();
    expect(subir).toHaveBeenCalledTimes(1);

    terminar?.(true);
    fixture.detectChanges();
    expect(texto('chat-prefs-guardado')).toContain('Cambios guardados');
  });

  it('mientras se lee lo guardado, «Guardar» espera', () => {
    montar();
    autoReply.sincronizando.set(true);
    fixture.detectChanges();

    expect(consultar('chat-prefs-guardar')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('si la lectura falla lo dice como un error, no como falta de perfil, y ofrece reintentar', () => {
    montar();
    const cargar = vi.spyOn(autoReply, 'cargar').mockImplementation(() => undefined);
    autoReply.errorDeLectura.set(true);
    fixture.detectChanges();

    expect(texto('chat-prefs-limite')).toContain('No pudimos leer la configuración guardada');
    expect(texto('chat-prefs-limite')).not.toContain('Cree su perfil');
    (consultar('chat-prefs-reintentar') as HTMLElement).click();
    expect(cargar).toHaveBeenCalled();
  });

  it('«Volver a los valores recomendados» toca sólo lo avanzado, no la decisión ni el mensaje', async () => {
    montar();
    elegir('fijo');
    await escribir('Mi mensaje propio.');
    (consultar('chat-prefs-espera-15') as HTMLElement).click();
    fixture.detectChanges();

    (consultar('chat-prefs-restablecer') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((consultar('chat-prefs-modo-fijo') as HTMLInputElement).checked).toBe(true);
    expect((consultar('chat-prefs-texto') as HTMLTextAreaElement).value).toBe('Mi mensaje propio.');
    expect((consultar('chat-prefs-minutos') as HTMLInputElement).value).toBe('30');
  });

  it('el error del mensaje se va al cambiar de opción', async () => {
    montar();
    elegir('ia');
    await escribir('   ');
    guardar();
    expect(consultar('chat-prefs-texto')?.getAttribute('aria-invalid')).toBe('true');

    elegir('fijo');
    expect(consultar('chat-prefs-texto')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('ofrece una sola decisión: tres opciones que se excluyen, cada una con lo que pasa', () => {
    montar();
    const radios = Array.from(
      fixture.nativeElement.querySelectorAll('input[type="radio"][name="chat-prefs-modo"]'),
    ) as HTMLInputElement[];

    expect(radios.map((radio) => radio.value)).toEqual(['apagado', 'fijo', 'ia']);
    expect(radios[0].checked).toBe(true);
    const textoDeLaPantalla = fixture.nativeElement.textContent as string;
    expect(textoDeLaPantalla).toContain('No responder automáticamente');
    expect(textoDeLaPantalla).toContain('Responder con un mensaje fijo');
    expect(textoDeLaPantalla).toContain('Responder con IA');
    // Nada de interruptores sueltos para encenderla.
    expect(consultar('chat-prefs-activa')).toBeNull();
  });

  it('apagada no ofrece configurar lo que no tiene efecto, y la vista previa lo dice', () => {
    montar();

    expect(consultar('chat-prefs-texto')).toBeNull();
    expect(consultar('chat-prefs-mas')).toBeNull();
    expect(texto('chat-prefs-previa-nada')).toContain('No se envía ninguna respuesta');
  });

  it('con mensaje fijo, la vista previa muestra en vivo lo que se escribe', async () => {
    montar();
    elegir('fijo');
    await escribir('Estoy en consulta, respondo más tarde.');

    expect(texto('chat-prefs-previa-texto')).toBe('Estoy en consulta, respondo más tarde.');
    expect(consultar('chat-prefs-previa-etiqueta')).toBeNull();
  });

  it('nada se guarda hasta tocar «Guardar»; al guardar lo confirma con palabras', async () => {
    montar();
    elegir('fijo');
    await escribir('Estoy en consulta, respondo más tarde.');
    (consultar('chat-prefs-espera-15') as HTMLElement).click();
    fixture.detectChanges();

    expect(autoReply.configuracion().activa).toBe(false);
    expect(consultar('chat-prefs-sin-guardar')).not.toBeNull();

    guardar();

    const config = autoReply.configuracion();
    expect(config.activa).toBe(true);
    expect(config.conIa).toBe(false);
    expect(config.texto).toBe('Estoy en consulta, respondo más tarde.');
    expect(config.minutosDeInactividad).toBe(15);
    expect(consultar('chat-prefs-espera-15')?.getAttribute('aria-pressed')).toBe('true');
    expect(texto('chat-prefs-guardado')).toBe('Cambios guardados. Cuando no esté, se enviará su mensaje fijo.');
    expect(consultar('chat-prefs-guardado')?.getAttribute('role')).toBe('status');
    expect(consultar('chat-prefs-sin-guardar')).toBeNull();
  });

  it('lo avanzado va plegado en «Más opciones», con valores de fábrica que ya sirven', () => {
    montar();
    elegir('fijo');
    const mas = consultar('chat-prefs-mas') as HTMLDetailsElement;

    expect(mas.tagName).toBe('DETAILS');
    expect(mas.open).toBe(false);
    expect(mas.querySelector('summary')?.textContent?.trim()).toBe('Más opciones');
    expect((consultar('chat-prefs-minutos') as HTMLInputElement).value).toBe('30');
    expect((consultar('chat-prefs-descanso') as HTMLInputElement).value).toBe('4');
  });

  it('con IA: dice lo que la IA no hace, trae el respaldo precargado y rotula la vista previa', async () => {
    montar();
    elegir('ia');
    // `ngModel` escribe el campo en una microtarea.
    await fixture.whenStable();

    expect(texto('chat-prefs-ia-limites')).toBe(
      'La IA no diagnostica, no indica medicamentos ni dosis, y ante signos de alarma le pide a la persona que acuda a Emergencia.',
    );
    expect(fixture.nativeElement.textContent).toContain('Si la IA no está disponible, se enviará este mensaje');
    expect((consultar('chat-prefs-texto') as HTMLTextAreaElement).value).toContain('Gracias por escribir');
    expect(texto('chat-prefs-previa-etiqueta')).toBe('Respuesta automática generada por IA');
  });

  it('con IA guarda el modo y confirma en nombre de quién responde', () => {
    montar();
    elegir('ia');
    guardar();

    expect(autoReply.configuracion().activa).toBe(true);
    expect(autoReply.configuracion().conIa).toBe(true);
    expect(texto('chat-prefs-guardado')).toBe(
      'Cambios guardados. Cuando no esté, la IA responderá en nombre de su consultorio.',
    );
  });

  it('con IA y sin mensaje de respaldo no guarda y dice por qué', async () => {
    montar();
    elegir('ia');
    await escribir('   ');
    guardar();

    expect(autoReply.configuracion().activa).toBe(false);
    const campo = consultar('chat-prefs-texto') as HTMLTextAreaElement;
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'es el que se envía si la IA no está disponible',
    );
  });

  it('donde la IA no está disponible, la opción se ve apagada con el motivo', () => {
    montar(false);
    const ia = consultar('chat-prefs-modo-ia') as HTMLInputElement;

    expect(ia.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Todavía no está disponible en AloVida');
    ia.click();
    fixture.detectChanges();
    expect(consultar('chat-prefs-ia-limites')).toBeNull();
  });

  it('para una organización cambia sólo el sujeto, no la estructura', () => {
    montar();
    fixture.componentRef.setInput('audiencia', 'organizacion');
    elegir('ia');
    guardar();

    expect(fixture.nativeElement.textContent).toContain('en nombre de su organización');
    expect(fixture.nativeElement.textContent).toContain('Así lo ve quien le escribe');
    expect(consultar('chat-prefs-modo-fijo')).not.toBeNull();
  });

  it('la franja horaria sólo aparece si se pide', () => {
    montar();
    elegir('fijo');
    expect(consultar('chat-prefs-desde')).toBeNull();

    interruptor('chat-prefs-horario').click();
    fixture.detectChanges();
    expect(consultar('chat-prefs-desde')).not.toBeNull();

    guardar();
    expect(autoReply.configuracion().soloFueraDeHorario).toBe(true);
  });

  it('las frases propias se agregan y se quitan', async () => {
    montar();
    const campo = consultar('chat-prefs-plantilla-nueva') as HTMLInputElement;
    campo.value = 'Traiga su carnet de la obra social.';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    (consultar('chat-prefs-plantilla-guardar') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Traiga su carnet de la obra social.');

    (consultar('chat-prefs-quitar-plantilla') as HTMLElement).click();
    fixture.detectChanges();

    expect(consultar('chat-prefs-quitar-plantilla')).toBeNull();
  });
});

/**
 * M-2. Escribiendo como la farmacia, la pantalla sigue configurando la
 * respuesta automática **personal**: lee y escribe la del perfil propio, nunca
 * la de la vitrina, y lo dice.
 */
describe('ChatPreferences · escribiendo como la farmacia', () => {
  const PROPIO = 'pp-propio';
  const FARMACIA = 'pp-farmacia';

  afterEach(() => {
    TestBed.inject(ChatStore).detener();
    localStorage.clear();
  });

  it('lee y guarda la respuesta automática del perfil propio, no la de la vitrina', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ChatPreferences],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(ChatStore);
    store.perfilResuelto.set(true);
    store.perfilPropio.set(PROPIO);
    store.vitrinasDeOrganizacion.set([{ profileId: FARMACIA, nombre: 'Farmacia Vida' }]);
    store.perfil.set(FARMACIA);

    const fixture = TestBed.createComponent(ChatPreferences);
    fixture.detectChanges();
    await Promise.resolve();

    http.expectNone(`/community/profiles/${FARMACIA}/auto-reply`);
    http.expectOne(`/community/profiles/${PROPIO}/auto-reply`).flush(null);

    const aviso = fixture.nativeElement.querySelector('[data-testid="chat-prefs-personal"]') as HTMLElement | null;
    expect(aviso?.textContent).toContain('personal');
    expect(aviso?.textContent).toContain('Farmacia Vida');

    const consultar = (testid: string): HTMLElement =>
      fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as HTMLElement;
    consultar('chat-prefs-modo-fijo').click();
    fixture.detectChanges();
    // `ngModel` escribe el valor inicial en una microtarea: se la deja
    // terminar antes de tipear, o pisaría lo tipeado.
    await fixture.whenStable();
    const area = consultar('chat-prefs-texto') as HTMLTextAreaElement;
    area.value = 'Estoy en consulta, respondo más tarde.';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    consultar('chat-prefs-guardar').click();
    fixture.detectChanges();

    http.expectNone((r) => r.method === 'PUT' && r.url === `/community/profiles/${FARMACIA}/auto-reply`);
    const subida = http.expectOne((r) => r.method === 'PUT' && r.url === `/community/profiles/${PROPIO}/auto-reply`);
    expect(subida.request.body.isActive).toBe(true);
    subida.flush({});
    http.match(() => true).forEach((r) => r.flush(null));
  });
});
