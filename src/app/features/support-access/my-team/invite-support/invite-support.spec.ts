import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import type { DoctorTeamMember } from '../../../../core/data-access/support-access/support-access.types';
import type { SupportInvitationCreated } from '../../../../core/data-access/support-access/support-invite.types';
import { InviteSupport } from './invite-support';

function vinculacion(id: string, extra: Partial<MyRoleAssignment> = {}): MyRoleAssignment {
  return {
    id,
    practiceId: 'p-1',
    practiceName: 'Hospital Piloto Mantra',
    roleConceptId: 'rol-medico',
    status: 'concepto-activo',
    statusCode: 'ROLE_ASG_ACTIVE',
    isPrimary: false,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    avatarUrl: null,
    tenantId: 't-1',
    ...extra,
  };
}

const CREADA: SupportInvitationCreated = {
  id: 'link-1',
  tenantId: 't-1',
  items: [
    {
      id: 'link-1',
      kind: 'PRACTITIONER',
      targetKind: 'PRACTITIONER',
      tenantId: 't-1',
      organizationName: 'Hospital Piloto Mantra',
      userId: 'u-lucia',
      personName: 'Lucía Paz',
      status: 'PENDING',
      initiatedBy: 'PRACTITIONER',
      awaiting: 'SUPPORT_STAFF',
      practiceSiteId: null,
      clinicalUnitId: null,
      careSpaceId: null,
      practitionerRoleAssignmentId: 'ra-1',
      practitionerProfileId: null,
      targetName: 'Dr. Andrés Pérez',
      createdAt: '2026-10-31T10:00:00.000Z',
    },
  ],
};

function rechazo(status: number, cuerpo: unknown): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: cuerpo, statusText: 'x' }));
}

describe('InviteSupport', () => {
  let fixture: ComponentFixture<InviteSupport>;
  let listMyRoleAssignments: ReturnType<typeof vi.fn>;
  let inviteSupportStaff: ReturnType<typeof vi.fn>;
  let avisos: SupportInvitationCreated[];

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const documento = (): HTMLInputElement => host().querySelector('input[data-testid="invitar-documento"]')!;
  const estaBloqueado = (el: HTMLElement | null): boolean => el?.getAttribute('aria-disabled') === 'true';
  const refrescar = (): void => fixture.detectChanges();

  function escribir(valor: string): void {
    const campo = documento();
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    refrescar();
  }
  function enviarFormulario(): void {
    byId('invitar-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    refrescar();
  }
  function abrir(): void {
    byId('invitar-abrir')!.click();
    refrescar();
  }

  function montar(
    vinculaciones: Observable<readonly MyRoleAssignment[]> = of([vinculacion('ra-1')]),
    sent: readonly DoctorTeamMember[] = [],
  ): void {
    listMyRoleAssignments = vi.fn(() => vinculaciones);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PracticeSitesClient, useValue: { listMyRoleAssignments } },
        { provide: SupportAccessClient, useValue: { inviteSupportStaff } },
      ],
    });
    fixture = TestBed.createComponent(InviteSupport);
    fixture.componentRef.setInput('sent', sent);
    fixture.componentInstance.invited.subscribe((creada) => avisos.push(creada));
    refrescar();
  }

  beforeEach(() => {
    inviteSupportStaff = vi.fn(() => of(CREADA));
    avisos = [];
  });

  it('cerrado solo ofrece «Invitar a una secretaria» y no pide nada a la API', () => {
    montar();
    expect(byId('invitar-abrir')!.textContent).toContain('Invitar a una secretaria');
    expect(byId('invitar-form')).toBeNull();
    expect(listMyRoleAssignments).not.toHaveBeenCalled();
  });

  it('al abrir lee sus vinculaciones, deja elegida la única que tiene y avisa que ella decide después', () => {
    montar();
    abrir();
    expect(listMyRoleAssignments).toHaveBeenCalledTimes(1);
    expect(byId('invitar-form')).not.toBeNull();
    expect(byId('invitar-vinculacion')!.textContent).toContain('Hospital Piloto Mantra');
    expect(byId('invitar-secretaria')!.textContent).toContain('ella decide si acepta');
  });

  it('el documento abre un teclado de texto y no sugiere nada del navegador; las etiquetas están a la vista', () => {
    montar();
    abrir();
    expect(documento().getAttribute('inputmode')).toBe('text');
    expect(documento().getAttribute('autocomplete')).toBe('off');
    expect(host().querySelector('label')!.textContent).toContain('Documento de identidad de la secretaria');
    expect(byId('invitar-form')!.textContent).toContain('Vinculación donde la va a necesitar');
  });

  it('un documento inválido se marca junto al campo y no envía nada', () => {
    montar();
    abrir();
    escribir('12 3');
    enviarFormulario();
    const error = host().querySelector('.form-field-error')!;
    expect(error.textContent).toContain('solo admite letras, dígitos, punto y guion');
    expect(documento().getAttribute('aria-invalid')).toBe('true');
    expect(inviteSupportStaff).not.toHaveBeenCalled();
  });

  it('un documento vacío al enviar pide escribirlo', () => {
    montar();
    abrir();
    enviarFormulario();
    expect(host().querySelector('.form-field-error')!.textContent).toContain('Escriba el documento');
    expect(inviteSupportStaff).not.toHaveBeenCalled();
  });

  it('con varias vinculaciones no elige por la persona: sin elegir, lo dice junto al campo', () => {
    montar(of([vinculacion('ra-1'), vinculacion('ra-2', { practiceName: 'Clínica Norte' })]));
    abrir();
    expect(byId('invitar-vinculacion')!.textContent).toContain('Elija la vinculación');
    escribir('7005002');
    enviarFormulario();
    expect(host().textContent).toContain('Elija en qué vinculación la va a invitar.');
    expect(inviteSupportStaff).not.toHaveBeenCalled();
  });

  it('manda solo el documento sin espacios y la vinculación elegida', () => {
    montar(of([vinculacion('ra-1'), vinculacion('ra-2', { practiceName: 'Clínica Norte' })]));
    abrir();
    (byId('invitar-vinculacion')!.querySelector('button.select-trigger') as HTMLElement).click();
    refrescar();
    (host().ownerDocument.querySelectorAll('[role="option"]')[1] as HTMLElement).click();
    refrescar();
    escribir('  7005002 ');
    enviarFormulario();
    expect(inviteSupportStaff).toHaveBeenCalledTimes(1);
    expect(inviteSupportStaff).toHaveBeenCalledWith({ nationalId: '7005002', practitionerRoleAssignmentId: 'ra-2' });
  });

  it('mientras envía deshabilita el envío y el campo, y un segundo envío no repite la petición', () => {
    const respuesta = new Subject<SupportInvitationCreated>();
    inviteSupportStaff = vi.fn(() => respuesta);
    montar();
    abrir();
    escribir('7005002');
    enviarFormulario();

    expect(estaBloqueado(byId('invitar-enviar'))).toBe(true);
    expect(byId('invitar-enviar')!.getAttribute('aria-busy')).toBe('true');
    expect(documento().disabled).toBe(true);
    enviarFormulario();
    expect(inviteSupportStaff).toHaveBeenCalledTimes(1);

    respuesta.next(CREADA);
    respuesta.complete();
    refrescar();
    expect(byId('invitar-exito')).not.toBeNull();
  });

  it('con éxito dice a quién se envió, que queda pendiente, y avisa para refrescar el equipo', () => {
    montar();
    abrir();
    escribir('7005002');
    enviarFormulario();

    const exito = byId('invitar-exito')!;
    expect(exito.textContent).toContain('Lucía Paz');
    expect(exito.textContent).toContain('pendiente');
    expect(avisos).toEqual([CREADA]);
    // El formulario ya no está: no se puede reenviar la misma invitación por accidente.
    expect(byId('invitar-form')).toBeNull();
  });

  it('«Invitar a otra secretaria» vuelve al formulario con el documento vacío', () => {
    montar();
    abrir();
    escribir('7005002');
    enviarFormulario();
    byId('invitar-otra')!.click();
    refrescar();
    expect(byId('invitar-exito')).toBeNull();
    expect(documento().value).toBe('');
    expect(host().querySelector('.form-field-error')).toBeNull();
  });

  it('si la API no encuentra a la secretaria, lo dice junto al documento y no da por enviado nada', () => {
    inviteSupportStaff = vi.fn(() =>
      rechazo(404, { code: 'NOT_FOUND', reason: 'SUPPORT_STAFF_NOT_FOUND', message: 'No hay una secretaria registrada con ese documento' }),
    );
    montar();
    abrir();
    escribir('9999999');
    enviarFormulario();

    expect(host().querySelector('.form-field-error')!.textContent).toContain('No hay una secretaria registrada con ese documento');
    expect(byId('invitar-exito')).toBeNull();
    expect(avisos).toEqual([]);
    expect(estaBloqueado(byId('invitar-enviar'))).toBe(false);
  });

  it('al corregir el documento se va el error que había devuelto la API', () => {
    inviteSupportStaff = vi.fn(() =>
      rechazo(404, { code: 'NOT_FOUND', reason: 'SUPPORT_STAFF_NOT_FOUND', message: 'No hay una secretaria registrada con ese documento' }),
    );
    montar();
    abrir();
    escribir('9999999');
    enviarFormulario();
    escribir('7005002');
    expect(host().querySelector('.form-field-error')).toBeNull();
  });

  it('un vínculo repetido (409) se explica junto al documento', () => {
    inviteSupportStaff = vi.fn(() =>
      rechazo(409, { code: 'CONFLICT', reason: 'SUPPORT_LINK_DUPLICATE', message: 'Ya hay un vínculo vivo con ese mismo objetivo' }),
    );
    montar();
    abrir();
    escribir('7005001');
    enviarFormulario();
    expect(host().querySelector('.form-field-error')!.textContent).toContain('Ya hay un vínculo con esta secretaria');
  });

  it('un error del servidor se muestra con su código de soporte y ofrece reintentar, que repite el envío', () => {
    inviteSupportStaff = vi
      .fn()
      .mockReturnValueOnce(rechazo(500, { code: 'INTERNAL', message: 'Falló algo', correlationId: 'req-77' }))
      .mockReturnValueOnce(of(CREADA));
    montar();
    abrir();
    escribir('7005002');
    enviarFormulario();

    const aviso = byId('invitar-error')!;
    expect(aviso.textContent).toContain('req-77');
    expect(byId('invitar-exito')).toBeNull();

    byId('invitar-reintentar')!.click();
    refrescar();
    expect(inviteSupportStaff).toHaveBeenCalledTimes(2);
    expect(byId('invitar-exito')).not.toBeNull();
  });

  it('sin vinculación activa con un hospital no hay formulario que enviar: se dice qué hacer', () => {
    montar(of([vinculacion('ra-1', { statusCode: 'ROLE_ASG_PENDING' })]));
    abrir();
    expect(host().textContent).toContain('Todavía no tiene una vinculación activa con un hospital');
    expect(host().querySelector('a[href="/my-account/my-procedures"]')).not.toBeNull();
    expect(byId('invitar-enviar')).toBeNull();
    expect(host().querySelector('input[data-testid="invitar-documento"]')).toBeNull();
  });

  it('si no se pueden leer las vinculaciones, ofrece reintentar y no deja enviar', () => {
    montar(throwError(() => new HttpErrorResponse({ status: 0, statusText: 'x' })));
    abrir();
    expect(host().textContent).toContain('Sin conexión');
    expect(byId('invitar-enviar')).toBeNull();
    expect(byId('invitar-cancelar-sin-datos')).not.toBeNull();
  });

  it('cancelar cierra el formulario sin enviar nada', () => {
    montar();
    abrir();
    escribir('7005002');
    byId('invitar-cancelar')!.click();
    refrescar();
    expect(byId('invitar-form')).toBeNull();
    expect(inviteSupportStaff).not.toHaveBeenCalled();
  });

  it('lista las invitaciones enviadas como pendientes de la secretaria', () => {
    const enviada = {
      delegateId: 'inv-1',
      personName: 'Lucía Paz',
      organizationName: 'Hospital Piloto Mantra',
      status: 'PENDING_ACCEPTANCE',
      initiatedBy: 'PRACTITIONER',
      awaiting: 'SUPPORT_STAFF',
      createdAt: '2026-10-31T10:00:00.000Z',
    } as unknown as DoctorTeamMember;
    montar(of([vinculacion('ra-1')]), [enviada]);
    const fila = byId('invitacion-enviada-inv-1')!;
    expect(fila.textContent).toContain('Lucía Paz');
    expect(fila.textContent).toContain('Hospital Piloto Mantra');
    expect(byId('invitacion-estado-inv-1')!.textContent).toContain('Espera su respuesta');
    // Esperar a la secretaria no ofrece aceptar ni retirar: no es del doctor decidirlo.
    expect(fila.querySelector('button')).toBeNull();
  });

  it('con la forma real de la API (id, sin delegateId) cada invitación tiene su clave y su testid propios', () => {
    const delaApi = (id: string, nombre: string | null): DoctorTeamMember =>
      ({
        id,
        status: 'PENDING',
        personName: nombre,
        organizationName: 'Hospital Piloto Mantra',
        initiatedBy: 'PRACTITIONER',
        awaiting: 'SUPPORT_STAFF',
        createdAt: '2026-10-31T10:00:00.000Z',
      }) as unknown as DoctorTeamMember;
    montar(of([vinculacion('ra-1')]), [delaApi('link-1', 'Lucía Paz'), delaApi('link-2', null)]);

    expect(byId('invitacion-enviada-link-1')!.textContent).toContain('Lucía Paz');
    // Un nombre ausente (la API lo manda `null`) no deja un hueco ni dice «null».
    expect(byId('invitacion-enviada-link-2')!.textContent).toContain('Una secretaria');
    expect(byId('invitacion-estado-link-2')!.textContent).toContain('Espera su respuesta');
    expect(host().querySelectorAll('[data-testid^="invitacion-enviada-"]')).toHaveLength(2);
    expect(host().innerHTML).not.toContain('invitacion-enviada-undefined');
  });

  it('sin invitaciones enviadas no dibuja la sección', () => {
    montar();
    expect(byId('invitaciones-enviadas')).toBeNull();
  });

  describe('foco', () => {
    const activo = (): Element | null => host().ownerDocument.activeElement;

    it('al abrir el formulario el foco va al documento', () => {
      montar();
      abrir();
      expect(activo()).toBe(documento());
    });

    it('al pasar al éxito el foco va al aviso de éxito, que es enfocable', () => {
      montar();
      abrir();
      escribir('7005002');
      enviarFormulario();
      const exito = byId('invitar-exito')!;
      expect(exito.getAttribute('tabindex')).toBe('-1');
      expect(activo()).toBe(exito);
    });

    it('al cerrar vuelve al botón que lo abrió', () => {
      montar();
      abrir();
      byId('invitar-cancelar')!.click();
      refrescar();
      expect(activo()).toBe(byId('invitar-abrir'));
    });

    it('«Invitar a otra secretaria» lleva el foco otra vez al documento', () => {
      montar();
      abrir();
      escribir('7005002');
      enviarFormulario();
      byId('invitar-otra')!.click();
      refrescar();
      expect(activo()).toBe(documento());
    });
  });

  describe('fallos que se explican', () => {
    afterEach(() => vi.useRealTimers());

    it('sin conexión dice que puede que no se haya enviado y manda a mirar «Invitaciones enviadas»', () => {
      inviteSupportStaff = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 0, statusText: 'x' })));
      montar();
      abrir();
      escribir('7005002');
      enviarFormulario();
      const aviso = byId('invitar-error')!.textContent!;
      expect(aviso).toContain('Puede que la invitación no se haya enviado');
      expect(aviso).toContain('Invitaciones enviadas');
    });

    it('un 404 sin reason no ofrece «Reintentar»', () => {
      inviteSupportStaff = vi.fn(() => rechazo(404, { code: 'NOT_FOUND', message: 'No encontrado' }));
      montar();
      abrir();
      escribir('7005002');
      enviarFormulario();
      expect(byId('invitar-error')).not.toBeNull();
      expect(byId('invitar-reintentar')).toBeNull();
    });

    it('un 429 sin Retry-After se puede reintentar, pero después de una espera', () => {
      vi.useFakeTimers();
      inviteSupportStaff = vi
        .fn()
        .mockReturnValueOnce(rechazo(429, { code: 'RATE_LIMITED', message: 'Demasiadas' }))
        .mockReturnValueOnce(of(CREADA));
      montar();
      abrir();
      escribir('7005002');
      enviarFormulario();

      expect(estaBloqueado(byId('invitar-reintentar'))).toBe(true);
      expect(byId('invitar-espera')).not.toBeNull();
      vi.advanceTimersByTime(29_000);
      refrescar();
      expect(estaBloqueado(byId('invitar-reintentar'))).toBe(true);
      vi.advanceTimersByTime(2_000);
      refrescar();
      expect(estaBloqueado(byId('invitar-reintentar'))).toBe(false);
      expect(byId('invitar-espera')).toBeNull();

      byId('invitar-reintentar')!.click();
      refrescar();
      expect(inviteSupportStaff).toHaveBeenCalledTimes(2);
      expect(byId('invitar-exito')).not.toBeNull();
    });
  });
});
