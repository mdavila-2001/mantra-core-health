import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportInboxItem } from '../../../core/data-access/support-access/support-inbox.types';
import { banderasDePacientes } from '../../../core/mock/fixtures/support-hospital-governance';
import { pacienteDeConversacion } from '../../../core/mock/fixtures/support-hospital-inbox';
import {
  reiniciarElGobiernoDeAccesos,
  reiniciarLaSesionDelSimulador,
} from '../../../core/mock/handlers/mock-reset';
import { TENANT_HOSPITAL_PILOTO } from '../../../core/mock/mock-session';
import { iso, uuid } from '../../../core/mock/mock-store';
import { AccessChallengeService } from '../../access-governance/access-challenge/access-challenge.service';
import {
  guardarLaBandeja,
  resolverDesafiosEnPrueba,
} from '../../../../testing/access-challenge-test';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { SupportConversationView } from './support-conversation';

/**
 * Responder en nombre del doctor a un paciente reservado **resuelve el segundo paso** y reintenta la misma respuesta; si la persona
 * cierra el diálogo, lo escrito sigue ahí (`isolate: false`: cada prueba parte del piloto de fábrica).
 */
describe('SupportConversationView: desafíos de acceso', () => {
  let fixture: ComponentFixture<SupportConversationView>;
  let item: SupportInboxItem;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  const escribir = async (texto: string): Promise<void> => {
    const campo = byId('compositor-texto')!.querySelector('textarea')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const enviar = async (): Promise<void> => {
    (byId('enviar-respuesta') as HTMLElement).click();
    await settle();
  };
  const hechas = (): string[] =>
    peticiones.map((p) => `${p.method} ${p.path.replace(/[0-9a-f-]{36}/g, ':id')} ${p.status}`);

  async function montar(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock('ana', { desafios: true })],
    });
    const bandeja = await firstValueFrom(
      TestBed.inject(SupportAccessClient).getSupportInbox({ org: TENANT_HOSPITAL_PILOTO }),
    );
    item = bandeja.items.find(
      (i) => !i.isClinical && pacienteDeConversacion(i.conversationId) !== undefined,
    )!;
    expect(
      item,
      'el piloto trae una conversación administrativa que Ana puede responder',
    ).toBeDefined();
    fixture = TestBed.createComponent(SupportConversationView);
    fixture.componentRef.setInput('conversationId', item.conversationId);
    fixture.componentRef.setInput('org', TENANT_HOSPITAL_PILOTO);
    await settle();
  }
  const reservarPaciente = (): void => {
    const paciente = pacienteDeConversacion(item.conversationId)!;
    banderasDePacientes.agregar({
      id: uuid(`spec-bandera-${paciente.id}`),
      patientProfileId: paciente.id,
      flag: 'CONFIDENTIAL',
      reason: 'Pedido del paciente',
      validFrom: iso(-1),
    });
  };

  let restaurarLaBandeja: () => void;
  beforeEach(() => {
    restaurarLaBandeja = guardarLaBandeja();
    reiniciarLaSesionDelSimulador();
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    restaurarLaBandeja();
    reiniciarElGobiernoDeAccesos();
  });

  it('un paciente sin bandera se responde en un solo paso', async () => {
    await montar();
    const desafios = resolverDesafiosEnPrueba();
    await escribir('Le confirmamos su cita, quedamos atentos.');
    olvidarPeticiones();

    await enviar();

    expect(hechas()[0]).toBe('POST /community/conversations/:id/messages 201');
    expect(desafios.preguntados).toEqual([]);
  });

  it('un paciente reservado: la API pide el segundo paso, se resuelve y la misma respuesta se repite y sale', async () => {
    await montar();
    reservarPaciente();
    const desafios = resolverDesafiosEnPrueba();
    await escribir('Le confirmamos su cita, quedamos atentos.');
    olvidarPeticiones();

    await enviar();

    expect(hechas().slice(0, 3)).toEqual([
      'POST /community/conversations/:id/messages 403',
      'POST /iam/me/step-up 200',
      'POST /community/conversations/:id/messages 201',
    ]);
    expect(peticiones[2]!.body).toEqual(peticiones[0]!.body);
    expect(desafios.preguntados.map((d) => d.kind)).toEqual(['STEP_UP']);
    expect(desafios.opciones[0]).toMatchObject({
      approval: { tenantId: TENANT_HOSPITAL_PILOTO, atom: 'messages.conversation.reply_on_behalf' },
    });
    expect(host().textContent).toContain('Le confirmamos su cita, quedamos atentos.');
    expect(byId('compositor-texto')!.querySelector('textarea')!.value).toBe('');
  });

  it('si la persona cierra el diálogo, no se envía nada, se dice y lo escrito sigue ahí', async () => {
    await montar();
    reservarPaciente();
    resolverDesafiosEnPrueba();
    vi.spyOn(TestBed.inject(AccessChallengeService), 'resolve').mockReturnValue(
      throwError(() => new AccessChallengeCancelledError()),
    );
    await escribir('Le confirmamos su cita, quedamos atentos.');
    olvidarPeticiones();

    await enviar();

    expect(hechas()[0]).toBe('POST /community/conversations/:id/messages 403');
    expect(host().textContent).toContain(
      'No se envió la respuesta: usted canceló el paso adicional que se pedía. Lo escrito sigue acá.',
    );
    expect(byId('compositor-texto')!.querySelector('textarea')!.value).toBe(
      'Le confirmamos su cita, quedamos atentos.',
    );
  });
});
