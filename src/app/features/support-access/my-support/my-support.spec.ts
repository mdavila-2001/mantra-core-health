import { Location } from '@angular/common';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type {
  MySupportEngagements,
  SupportEngagement,
} from '../../../core/data-access/support-access/support-access.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { MENSAJE_DE_CODIGO_INVALIDO, MySupport } from './my-support';

const enDias = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString();
const CODIGO = 'aB3_xY-9QzLmN0pRsTuVwXyZ1a2B3c4D';

function vinculo(
  id: string,
  status: SupportEngagement['status'],
  dias: number,
  extra: Partial<SupportEngagement> = {},
): SupportEngagement {
  return {
    id,
    tenantId: 't-1',
    organizationName: 'Hospital Piloto Mantra',
    ownerKind: 'ORGANIZATION',
    userId: 'u-ana',
    personName: 'Ana Gutiérrez',
    roleTemplate: 'SECRETARY',
    status,
    origin: 'REQUEST',
    validFrom: enDias(-60),
    recertifyEveryMonths: 12,
    nextRecertificationAt: enDias(dias),
    grants: [],
    ...extra,
  };
}

describe('MySupport', () => {
  let fixture: ComponentFixture<MySupport>;
  let confirmMyEngagement: ReturnType<typeof vi.fn>;
  let listMyEngagements: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let redeemInvitation: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  let replaceState: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const clic = async (el: Element | null): Promise<void> => {
    (el as HTMLElement).click();
    await refrescar();
  };

  async function abrir(
    engagements: readonly SupportEngagement[],
    ruta = '/my-support',
    consulta: Readonly<Record<string, string>> = {},
  ): Promise<void> {
    confirmMyEngagement = vi.fn(() => of({ ...vinculo('e-1', 'ACTIVE', 9), reactivated: false }));
    listMyEngagements = vi.fn(() => of({ engagements, requests: [] } as MySupportEngagements));
    toastSuccess = vi.fn();
    redeemInvitation = vi.fn(() => of({ outcome: 'SUPPORT_JOINED', organizationName: '' }));
    confirm = vi.fn(() => Promise.resolve(true));
    replaceState = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } } },
        // Las tarjetas del gobierno de accesos («¿Por qué no puedo?», mis pedidos de aprobación) piden por HTTP: se dejan sin respuesta.
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SupportAccessClient,
          useValue: {
            listMyEngagements,
            confirmMyEngagement,
            redeemInvitation,
            getMyCatalog: vi.fn(() => of(null)),
          },
        },
        { provide: ToastService, useValue: { success: toastSuccess, error: vi.fn() } },
        { provide: DialogService, useValue: { confirm } },
        { provide: Location, useValue: { path: () => ruta, replaceState } },
      ],
    });
    fixture = TestBed.createComponent(MySupport);
    fixture.detectChanges();
    await refrescar();
  }

  /**
   * F7 (revisión de seguridad del front): un enlace `?action=…&ask=1` no puede hacer que el navegador consulte, solo al
   * abrirse, el motivo de un acceso sobre un paciente cualquiera. La pregunta se precarga y espera un clic.
   */
  describe('un enlace con una pregunta lista', () => {
    it('la precarga pero NO dispara el POST de «¿Por qué no puedo?» al cargar', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], '/my-support', {
        action: 'agenda.appointment.view.reason',
        tenant: 't-1',
        patient: 'b0a1c5de-1111-4222-8333-444455556666',
        ask: '1',
      });
      TestBed.inject(HttpTestingController).expectNone('/me/support-access/explain');
      expect(byId('porque-lista')?.textContent).toContain('Pulse «Explicar»');
    });
  });

  describe('recertificación de la persona', () => {
    it('avisa antes de que se suspenda, con la fecha, y deja declarar que sigue trabajando aquí', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 9)]);
      const aviso = byId('recertificacion-aviso-e-1')!;
      expect(aviso.textContent).toContain('Confirme que sigue trabajando aquí');
      expect(aviso.textContent).toContain('la que renueva el vínculo es la organización');
      expect(aviso.textContent).toContain('se suspende');
      expect(byId('recertificacion-confirmar-e-1')!.textContent).toContain(
        'Confirmar que sigo trabajando aquí',
      );
    });

    it('no molesta a quien está al día', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)]);
      expect(byId('recertificacion-aviso-e-1')).toBeNull();
    });

    it('confirmar pide confirmación —y dice que no renueva el vínculo—, llama a la API, avisa y vuelve a leer', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 9)]);
      await clic(byId('recertificacion-confirmar-e-1'));
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirmar que sigo trabajando aquí',
          message: expect.stringMatching(
            /Hospital Piloto Mantra.*no renueva su vínculo: la que lo renueva es la organización/,
          ),
        }),
      );
      expect(confirmMyEngagement).toHaveBeenCalledWith('e-1');
      expect(listMyEngagements).toHaveBeenCalledTimes(2);
    });

    it('si cancela, no se confirma', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 9)]);
      confirm.mockResolvedValueOnce(false);
      await clic(byId('recertificacion-confirmar-e-1'));
      expect(confirmMyEngagement).not.toHaveBeenCalled();
    });

    it('vencido pero en plazo: avisa hasta cuándo y que lo renueva la organización', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', -6)]);
      const aviso = byId('recertificacion-aviso-e-1')!;
      expect(aviso.textContent).toContain('Su vínculo está vencido');
      expect(aviso.textContent).toContain('ese día se suspende');
      expect(aviso.textContent).toContain('la que renueva el vínculo es la organización');
    });

    it('suspendido: estado claro, sin botón, y manda a pedirlo a la organización', async () => {
      await abrir([vinculo('e-1', 'SUSPENDED', -22)]);
      const aviso = byId('recertificacion-aviso-e-1')!;
      expect(aviso.textContent).toContain('Suspendido: pida a su organización que lo renueve');
      expect(aviso.textContent).toContain('Solo la organización puede renovarlo');
      expect(byId('recertificacion-confirmar-e-1')).toBeNull();
      expect(host().textContent).not.toContain('Avisar a la organización');
      expect(confirmMyEngagement).not.toHaveBeenCalled();
    });

    it('un vínculo suspendido tampoco ofrece pedir más permisos', async () => {
      await abrir([vinculo('e-1', 'SUSPENDED', -22)]);
      expect(byId('pedir-mas-e-1')).toBeNull();
    });

    it('ya declaró en este ciclo: se lo dice y no vuelve a ofrecer el botón', async () => {
      await abrir([
        vinculo('e-1', 'ACTIVE', 9, { lastConfirmedBy: 'PERSON', lastConfirmedAt: enDias(-1) }),
      ]);
      const aviso = byId('recertificacion-declarado-e-1')!;
      expect(aviso.textContent).toContain('Ya avisó que sigue trabajando aquí');
      expect(aviso.textContent).toContain('Falta que su organización renueve el vínculo');
      expect(byId('recertificacion-confirmar-e-1')).toBeNull();
    });

    it('si la API responde que reactivó un vínculo suspendido, se dice la verdad de lo que quedó', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 9)]);
      confirmMyEngagement.mockReturnValueOnce(
        of({ ...vinculo('e-1', 'ACTIVE', 9), reactivated: true }),
      );
      await clic(byId('recertificacion-confirmar-e-1'));
      expect(toastSuccess).toHaveBeenCalledWith('Su vínculo volvió a estar activo.', undefined);
    });

    it('si no, dice que le avisó a la organización y que ella debe renovarlo', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 9)]);
      await clic(byId('recertificacion-confirmar-e-1'));
      expect(toastSuccess).toHaveBeenCalledWith(
        'Le avisamos a la organización que sigue trabajando aquí.',
        'Ella debe renovar el vínculo.',
      );
    });

    it('un vínculo terminado no muestra aviso', async () => {
      await abrir([vinculo('e-1', 'ENDED', -90)]);
      expect(byId('recertificacion-aviso-e-1')).toBeNull();
    });

    it('lleva a «Mi actividad»', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)]);
      expect(byId('mi-actividad-enlace')!.getAttribute('href')).toBe('/my-support/activity');
    });
  });

  describe('el código del QR', () => {
    it('se lee del fragmento, se pone en el campo y se borra de la dirección y del historial', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support#code=${CODIGO}`);
      expect((byId('canje-codigo')!.querySelector('input') as HTMLInputElement).value).toBe(CODIGO);
      expect(replaceState).toHaveBeenCalledWith('/my-support');
    });

    it('un QR impreso con la query de antes también se lee y se limpia', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support?code=${CODIGO}`);
      expect((byId('canje-codigo')!.querySelector('input') as HTMLInputElement).value).toBe(CODIGO);
      expect(replaceState).toHaveBeenCalledWith('/my-support');
    });

    it('sin código no toca la dirección', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)]);
      expect(replaceState).not.toHaveBeenCalled();
    });

    it('canjear manda el código sin cambiarle mayúsculas ni minúsculas', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support#code=${CODIGO}`);
      await clic(byId('canje-enviar'));
      expect(redeemInvitation).toHaveBeenCalledWith(CODIGO);
    });
  });

  describe('el resultado de un código de doctor', () => {
    const preconditionFailed = (reason: string): HttpErrorResponse =>
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 'PRECONDITION_FAILED',
          message: 'x',
          details: { reason },
          timestamp: '',
          path: '',
        },
      });

    it('un QR multiuso de doctores queda pendiente: se dice como pendiente y nunca como «afiliado»', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support#code=${CODIGO}`);
      redeemInvitation.mockReturnValueOnce(
        of({ outcome: 'PRACTITIONER_PENDING_APPROVAL', organizationName: 'Hospital Piloto' }),
      );
      await clic(byId('canje-enviar'));
      const texto = byId('canje-resultado')!.textContent!;
      expect(texto).toContain('quedó pendiente de aprobación de la organización');
      expect(texto).not.toContain('Quedó afiliado');
    });

    it('si ya era miembro activo, o el código iba dirigido a usted, queda afiliado', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support#code=${CODIGO}`);
      redeemInvitation.mockReturnValueOnce(
        of({ outcome: 'PRACTITIONER_AFFILIATED', organizationName: 'Hospital Piloto' }),
      );
      await clic(byId('canje-enviar'));
      expect(byId('canje-resultado')!.textContent).toContain(
        'Quedó afiliado a Hospital Piloto como doctor',
      );
    });

    it('sin perfil profesional (SUPPORT_PRACTITIONER_PROFILE_REQUIRED) ofrece completarlo y no lo toma por un código inválido', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support#code=${CODIGO}`);
      redeemInvitation.mockReturnValueOnce(
        throwError(() => preconditionFailed('SUPPORT_PRACTITIONER_PROFILE_REQUIRED')),
      );
      await clic(byId('canje-enviar'));
      const texto = byId('canje-resultado')!.textContent!;
      expect(texto).toContain('todavía no tiene un perfil profesional');
      expect(texto).not.toContain(MENSAJE_DE_CODIGO_INVALIDO);
      expect(byId('canje-enlace')!.textContent).toContain('Completar mi perfil profesional');
    });

    it('si la organización no tiene práctica activa (SUPPORT_AFFILIATION_PRACTICE_MISSING) dice qué pedirle', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support#code=${CODIGO}`);
      redeemInvitation.mockReturnValueOnce(
        throwError(() => preconditionFailed('SUPPORT_AFFILIATION_PRACTICE_MISSING')),
      );
      await clic(byId('canje-enviar'));
      expect(byId('canje-resultado')!.textContent).toContain(
        'todavía no tiene una práctica activa',
      );
      expect(byId('canje-enlace')).toBeNull();
    });
  });

  describe('un código que no sirve', () => {
    const fallo = (status: number): HttpErrorResponse =>
      new HttpErrorResponse({ status, error: { message: `mensaje distinto ${status}` } });

    it('inexistente, usado o vencido se dicen con el mismo mensaje, que no cita al servidor', async () => {
      const textos: string[] = [];
      for (const status of [404, 409, 422]) {
        TestBed.resetTestingModule();
        await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support#code=${CODIGO}`);
        redeemInvitation.mockReturnValueOnce(throwError(() => fallo(status)));
        await clic(byId('canje-enviar'));
        textos.push(byId('canje-resultado')!.textContent!.trim());
      }
      expect(new Set(textos).size).toBe(1);
      expect(textos[0]).toContain(MENSAJE_DE_CODIGO_INVALIDO);
      expect(textos[0]).not.toContain('mensaje distinto');
    });

    it('un corte de red no se hace pasar por un código inválido', async () => {
      await abrir([vinculo('e-1', 'ACTIVE', 200)], `/my-support#code=${CODIGO}`);
      redeemInvitation.mockReturnValueOnce(throwError(() => fallo(0)));
      await clic(byId('canje-enviar'));
      expect(byId('canje-resultado')!.textContent).toContain('No pudimos canjear el código');
      expect(byId('canje-resultado')!.textContent).not.toContain(MENSAJE_DE_CODIGO_INVALIDO);
    });
  });
});
