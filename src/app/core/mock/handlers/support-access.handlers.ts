import type { MockRouter } from '../mock-router';
import { registrarApoyoAcciones } from './support-access.actions.handlers';
import { registrarApoyoAgenda } from './support-access.agenda.handlers';
import { registrarApoyoChat } from './support-access.chat.handlers';
import { registrarApoyoDoctor } from './support-access.doctor.handlers';
import { registrarApoyoInvitacionesDelDoctor } from './support-access.doctor-invitations.handlers';
import { registrarApoyoPacientes } from './support-access.patients.handlers';
import { registrarApoyoOrganizacion } from './support-access.org.handlers';
import { registrarApoyoPersona } from './support-access.persona.handlers';
import { registrarApoyoGobierno } from './support-access.governance.handlers';
import { registrarApoyoSesion } from './support-access.session.handlers';

/* ============================================================================
    El backend simulado del **personal de apoyo** (secretaria y otros roles).

    Reproduce, con estado que sobrevive a F5, lo que la API hará con las rutas
    del contrato. Cada lado tiene su archivo:

    - `support-access.persona.handlers.ts`  la persona de apoyo;
    - `support-access.org.handlers.ts`      la organización;
    - `support-access.doctor.handlers.ts`   el doctor y el chat;
    - `support-access.doctor-invitations.handlers.ts` las invitaciones del doctor a una secretaria;
    - `support-access.agenda.handlers.ts`   las reservas del hospital y la búsqueda exacta;
    - `support-access.session.handlers.ts`  controles de sesión, dispositivo nuevo y política en el login;
    - `support-access.actions.handlers.ts`  cancelar, reprogramar, confirmar, atender sin cita y espera;
    - `support-access.patients.handlers.ts` búsqueda exacta y alta rápida de pacientes;
    - `support-access.chat.handlers.ts`     la bandeja de chat, la asignación, las notas y responder en nombre del doctor;
    - `support-access.governance.*.ts`      el gobierno de accesos: reglas, SoD, cuatro ojos, campañas, informes, ciclo de vida, equipo y explicar;
    - `support-access.core.ts`              lo que comparten.

    Va al final de `crearRouterSimulado`: envuelve rutas que ya tienen dueño.
    ========================================================================== */

export function registrarApoyo(router: MockRouter): void {
  registrarApoyoPersona(router);
  registrarApoyoOrganizacion(router);
  registrarApoyoDoctor(router);
  // Envuelve `GET /me/practitioner/support-team`, que el doctor ya registró arriba.
  registrarApoyoInvitacionesDelDoctor(router);
  registrarApoyoAgenda(router);
  registrarApoyoSesion(router);
  registrarApoyoAcciones(router);
  registrarApoyoPacientes(router);
  registrarApoyoChat(router);
  // El gobierno de accesos (fase 5) envuelve rutas que ya tienen dueño, así que va al final.
  registrarApoyoGobierno(router);
  // Los desafíos de la caja envuelven una ruta de facturación que ya tiene dueño: van después de todo lo demás.
}
