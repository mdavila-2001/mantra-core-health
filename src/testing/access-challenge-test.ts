import { TestBed } from '@angular/core/testing';
import { map, of } from 'rxjs';
import { vi } from 'vitest';

import type {
  AccessChallenge,
  ChallengeAnswer,
} from '../app/core/access-challenge/access-challenge';
import { conversationList, messageList } from '../app/core/mock/fixtures/community';
import { asignaciones, autorias, notasInternas } from '../app/core/mock/fixtures/support-hospital';
import { Coleccion } from '../app/core/mock/mock-store';
import { StepUpClient } from '../app/core/data-access/access-governance/step-up.client';
import { CODIGO_DE_PRUEBA } from '../app/core/mock/handlers/iam-mfa.store';
import { AccessChallengeService } from '../app/features/access-governance/access-challenge/access-challenge.service';

/* ============================================================================
    Resolver los desafíos de acceso en una prueba **sin abrir el diálogo**.

    Hace lo que haría la persona: el segundo paso lo verifica de verdad contra el simulador (`POST /iam/me/step-up` con el
    código de prueba), el motivo es el que se le diga y la aprobación, la que se le pase. Devuelve lo que se le preguntó, para
    afirmar el orden de los desafíos.
   ========================================================================== */

export interface RespuestasDeDesafio {
  readonly reasonText?: string;
  /** El id de la aprobación ya dada; se lee al resolver, por si la prueba la crea en el camino. */
  readonly approvalId?: string | (() => string | undefined);
  /** Si es `true`, la persona cierra el diálogo sin resolver. */
  readonly cancelar?: boolean;
}

export function resolverDesafiosEnPrueba(respuestas: RespuestasDeDesafio = {}): {
  readonly preguntados: AccessChallenge[];
  readonly opciones: unknown[];
} {
  const servicio = TestBed.inject(AccessChallengeService);
  const pasoExtra = TestBed.inject(StepUpClient);
  const preguntados: AccessChallenge[] = [];
  const opciones: unknown[] = [];
  vi.spyOn(servicio, 'resolve').mockImplementation((desafio, opcionesDelDialogo = {}) => {
    preguntados.push(desafio);
    opciones.push(opcionesDelDialogo);
    switch (desafio.kind) {
      case 'STEP_UP':
        return pasoExtra
          .verify(CODIGO_DE_PRUEBA)
          .pipe(map((): ChallengeAnswer => ({ stepUpVerified: true })));
      case 'REASON':
        return of<ChallengeAnswer>({
          reasonText: respuestas.reasonText ?? 'Motivo de prueba con la extensión suficiente',
        });
      case 'APPROVAL': {
        const id =
          typeof respuestas.approvalId === 'function'
            ? respuestas.approvalId()
            : respuestas.approvalId;
        return of<ChallengeAnswer>(id === undefined ? {} : { approvalId: id });
      }
      default:
        return of<ChallengeAnswer>({});
    }
  });
  return { preguntados, opciones };
}

/* ============================================================================
    Dejar el piloto como estaba al terminar un archivo.

    El corredor no aísla los módulos entre archivos de un mismo worker (`isolate: false`): lo que un archivo escribió en la bandeja
    (asignaciones, notas, autorías, mensajes) lo vería el siguiente, y esas tablas **no** las reinician `reiniciarElGobiernoDeAccesos` ni
    `reiniciarLaSesionDelSimulador` (reciben filas de otros módulos al cargarse, así que volver a «las del constructor» las vaciaría).
    `guardarLaBandeja()` toma la foto antes y devuelve la función que la restaura.
   ========================================================================== */

/** La foto de una tabla y la forma de volver a ella. */
function fotoDe<T extends { readonly id: string }>(tabla: Coleccion<T>): () => void {
  const filas = tabla.todos();
  return () => {
    tabla.reiniciar();
    for (const fila of filas) tabla.agregar(fila);
  };
}

export function guardarLaBandeja(): () => void {
  const restauraciones = [
    fotoDe(conversationList),
    fotoDe(messageList),
    fotoDe(asignaciones),
    fotoDe(notasInternas),
    fotoDe(autorias),
  ];
  return () => restauraciones.forEach((restaurar) => restaurar());
}
