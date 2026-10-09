import {
  PRACTITIONER_PROFILE_SIMULATOR_EXTENSIONS,
  practitionerProfileExtensionsLabel,
} from '../../../../core/data-access/profiles/profiles.types';
import { droppedSimulatorExtensions } from '../../../../core/data-access/simulator-only';
import type { ToastService } from '../../../../shared/components/molecules/toast/toast.service';

/**
 * Avisa qué parte del guardado no llegó al servidor.
 *
 * El `PATCH` del perfil manda junto lo que la API recibe y lo que todavía no
 * (idiomas, frecuencia de facturación: informe B, C13). Contra la API real el
 * cliente quita esto último para que el resto se guarde; sin este aviso, la
 * recarga devolvería el valor viejo sin que nadie supiera por qué.
 */
export function avisarExtensionesSinGuardar(toasts: ToastService, cambios: object): void {
  const sinGuardar = droppedSimulatorExtensions(cambios, PRACTITIONER_PROFILE_SIMULATOR_EXTENSIONS);
  if (sinGuardar.length === 0) return;
  const verbo =
    sinGuardar.length === 1
      ? 'todavía no se guarda: el servidor aún no la recibe'
      : 'todavía no se guardan: el servidor aún no los recibe';
  toasts.warning(`${practitionerProfileExtensionsLabel(sinGuardar)} ${verbo}.`, 'Perfil');
}
