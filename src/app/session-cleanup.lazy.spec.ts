import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatAutoReply } from './core/messaging/chat-auto-reply';
import { MessageTemplates } from './core/messaging/message-templates';
import { RememberedPriceLists } from './features/admin/medical-laboratory/remembered-price-lists';
import { ReportAssistantData } from './features/reporting/assistant/assistant-data';
import { guardarHistorial, leerHistorial } from './features/reporting/assistant/assistant-history';
import { ReportPrefsStore } from './features/reporting/pages/report-grid/report-prefs.store';
import { ReportContextStore } from './features/reporting/state/report-context.store';
import { olvidarLoSensibleDelNavegador } from './session-cleanup.lazy';

describe('olvidarLoSensibleDelNavegador (cerrar sesión)', () => {
  const olvidarPlantillas = vi.fn();
  const olvidarRespuesta = vi.fn();
  const olvidarTarifarios = vi.fn();

  // En `afterEach` y no al final de un test: si uno falla a medias, lo que dejó en el storage no contamina al siguiente.
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  beforeEach(() => {
    olvidarPlantillas.mockClear();
    olvidarRespuesta.mockClear();
    olvidarTarifarios.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: MessageTemplates, useValue: { olvidar: olvidarPlantillas } },
        { provide: ChatAutoReply, useValue: { olvidar: olvidarRespuesta } },
        { provide: RememberedPriceLists, useValue: { forget: olvidarTarifarios } },
      ],
    });
  });

  it('sigue olvidando lo que ya olvidaba', () => {
    olvidarLoSensibleDelNavegador(TestBed.inject(Injector));
    expect(olvidarPlantillas).toHaveBeenCalledTimes(1);
    expect(olvidarRespuesta).toHaveBeenCalledTimes(1);
    expect(olvidarTarifarios).toHaveBeenCalledTimes(1);
  });

  it('el portal de reportería no deja nada de la persona anterior: historial, filtros, moneda, alcance y favoritos', () => {
    guardarHistorial('u1', ['¿Cuál es el MRR?']);
    const contexto = TestBed.inject(ReportContextStore);
    contexto.moneda.set('USD');
    contexto.alcance.set('organizacion');
    contexto.alternarFiltro({ dimension: 'plan', valor: 'Pro' });
    const prefs = TestBed.inject(ReportPrefsStore);
    prefs.toggleFavorite('rep-cobros');

    olvidarLoSensibleDelNavegador(TestBed.inject(Injector));

    expect(leerHistorial('u1')).toEqual([]);
    expect(contexto.moneda()).toBe('BOB');
    expect(contexto.alcance()).toBe('plataforma');
    expect(contexto.filtros()).toEqual([]);
    expect(prefs.favorites()).toEqual([]);
    expect(prefs.recents()).toEqual([]);
  });

  it('vaciar la memoria no borra lo que la persona guardó: sus favoritos vuelven al entrar de nuevo', () => {
    const prefs = TestBed.inject(ReportPrefsStore);
    prefs.toggleFavorite('rep-cobros');
    olvidarLoSensibleDelNavegador(TestBed.inject(Injector));
    prefs.load();
    expect(prefs.favorites()).toEqual(['rep-cobros']);
  });

  it('inyecta el asistente solo para limpiarlo (el dato que trajo no sobrevive)', () => {
    const datos = TestBed.inject(ReportAssistantData);
    const limpiar = vi.spyOn(datos, 'limpiar');
    olvidarLoSensibleDelNavegador(TestBed.inject(Injector));
    expect(limpiar).toHaveBeenCalledTimes(1);
  });
});
