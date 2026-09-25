import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { NavIcon } from '../../../../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../../../../shared/components/molecules/card/card';
import { StatusSeal } from '../../../../../../shared/components/organisms/status-seal/status-seal';
import type {
  EspecialidadVisible,
  FormacionVisible,
  IdiomaVisible,
  MatriculaVisible,
} from '../practitioner-profile-view.types';
import {
  CREDENTIAL_ICONS,
  CREDENTIAL_KIND_LABELS,
  type CredencialEnTarjeta,
  type CredentialFilter,
} from './credentials-panel.types';

/**
 * **Credenciales**, en una rejilla de tarjetas con ícono por clase.
 *
 * ## Qué reemplaza
 *
 * Cinco listas apiladas —habilitación, especialidades, idiomas, «Verificado
 * (n)» y «Declarado (n)»— de renglones idénticos, donde **cada credencial
 * aparecía dos veces**: una en la lista de su clase y otra en la agrupación
 * por estado. El cliente lo llamó «un layout diarreico» el 19/09/2026 y pidió
 * un ícono que identifique cada credencial, en rejilla.
 *
 * Ahora cada credencial es **una** tarjeta, con el ícono de su clase, su sello
 * y su fuente; lo declarado y lo verificado se separan con un filtro arriba en
 * vez de repitiendo la lista entera. Ninguna información se perdió: lo que
 * antes decía el título de la sección ahora lo dice el sello de la tarjeta.
 *
 * ## El aviso de para qué sirve la pestaña no vive acá
 *
 * Era un `app-tab-help-block`: una caja de cinco renglones arriba de todo que
 * empujaba el contenido real fuera de la primera pantalla cada vez, hasta que
 * alguien la cerraba. El pedido del 19/09/2026 lo mandó a un toast, y ése lo
 * lanza la ficha —no este panel— porque **el contenido proyectado de una
 * pestaña se instancia aunque la pestaña esté cerrada**: `@if` dentro de
 * `<ng-content>` decide si se INSERTA en el DOM, no si se construye. Lanzado
 * desde acá, el aviso de «Credenciales» saltaba al abrir la ficha, estando en
 * «Datos personales». Quien sabe qué pestaña se está mirando es la ficha.
 */
@Component({
  selector: 'app-credentials-panel',
  imports: [Card, NavIcon, StatusSeal],
  templateUrl: './credentials-panel.html',
  styleUrl: './credentials-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialsPanel {
  readonly matriculas = input.required<readonly MatriculaVisible[]>();
  /**
   * Opcional y no `required` (2026-09-24): las especialidades se mudaron a
   * «Datos personales» (pedido del propietario) y esta pestaña ya no las
   * recibe. El panel conserva la capacidad de dibujar la clase `specialty`
   * por si alguna otra pantalla vuelve a necesitarla; hoy nadie la alimenta.
   */
  readonly especialidades = input<readonly EspecialidadVisible[]>([]);
  readonly formacion = input.required<readonly FormacionVisible[]>();
  readonly idiomas = input.required<readonly IdiomaVisible[]>();

  protected readonly filtro = signal<CredentialFilter>('all');
  protected readonly ICONOS = CREDENTIAL_ICONS;
  protected readonly ROTULOS = CREDENTIAL_KIND_LABELS;

  /** Todas las credenciales, de las cuatro clases, en una sola lista. */
  protected readonly todas = computed<readonly CredencialEnTarjeta[]>(() => [
    ...this.matriculas().map((matricula): CredencialEnTarjeta => ({
      id: matricula.id,
      clase: 'license',
      titulo: matricula.jurisdiccion,
      detalles: [
        `Matrícula N.º ${matricula.numero}`,
        matricula.autoridad,
        matricula.hasta === null ? '' : `Vigente hasta ${fecha(matricula.hasta)}`,
      ].filter((linea) => linea !== ''),
      sello: { variant: matricula.sello, label: matricula.estado },
      fuente: null,
      verificada: matricula.sello === 'approved',
    })),
    ...this.especialidades().map((especialidad): CredencialEnTarjeta => ({
      id: especialidad.id,
      clase: 'specialty',
      titulo: especialidad.nombre,
      detalles: [
        especialidad.principal ? 'Principal' : '',
        especialidad.certificada ? 'Certificada por el consejo' : '',
        periodo(especialidad.desde, especialidad.hasta),
      ].filter((linea) => linea !== ''),
      sello: { variant: especialidad.sello, label: especialidad.estado },
      fuente: null,
      verificada: especialidad.sello === 'approved',
    })),
    ...this.formacion().map((estudio): CredencialEnTarjeta => ({
      id: estudio.id,
      clase: 'education',
      titulo: estudio.tipo,
      detalles: [
        estudio.institucion,
        `N.º ${estudio.numero}`,
        periodo(estudio.desde, estudio.hasta),
      ].filter((linea) => linea !== ''),
      sello: { variant: estudio.sello, label: estudio.estado },
      fuente: estudio.fuenteVerificacion ?? null,
      // La fuente es la señal más directa: el backend la exige sólo al
      // verificar. Es el mismo criterio que usaba la agrupación anterior.
      verificada: estudio.fuenteVerificacion !== undefined,
    })),
    ...this.idiomas().map((idioma): CredencialEnTarjeta => ({
      id: idioma.id,
      clase: 'language',
      titulo: idioma.nombre,
      detalles: [idioma.nivel, idioma.interpreta ? 'Interpreta en consulta' : ''].filter(
        (linea) => linea !== '',
      ),
      // Un idioma no tramita nada: no hay sello que poner, y poner uno
      // neutro le inventaría un estado que nadie resuelve.
      sello: null,
      fuente: null,
      verificada: false,
    })),
  ]);

  protected readonly verificadas = computed(() => this.todas().filter((c) => c.verificada));
  protected readonly declaradas = computed(() => this.todas().filter((c) => !c.verificada));

  protected readonly visibles = computed<readonly CredencialEnTarjeta[]>(() => {
    switch (this.filtro()) {
      case 'verified':
        return this.verificadas();
      case 'declared':
        return this.declaradas();
      default:
        return this.todas();
    }
  });

  /** Qué decir cuando el corte elegido no tiene nada. */
  protected readonly vacio = computed(() => {
    switch (this.filtro()) {
      case 'verified':
        return 'Todavía no hay nada verificado. Un administrador las comprueba contra la fuente que las emitió.';
      case 'declared':
        return 'No hay nada pendiente de verificación.';
      default:
        return 'Todavía no cargaste credenciales. Son las que habilitan a ejercer: sin ninguna verificada el perfil queda pendiente.';
    }
  });

  protected elegirFiltro(filtro: CredentialFilter): void {
    this.filtro.set(filtro);
  }
}

/** Una fecha corta, en el formato que ya usa el resto de la ficha. */
function fecha(valor: Date): string {
  return valor.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** «Desde mar 2019», «mar 2019 — dic 2022», o vacío si no hay fechas. */
function periodo(desde: Date | null, hasta: Date | null): string {
  if (desde === null && hasta === null) {
    return '';
  }
  const mes = (valor: Date) =>
    valor.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' });
  if (desde !== null && hasta !== null) {
    return `${mes(desde)} — ${mes(hasta)}`;
  }
  return desde === null ? `Hasta ${mes(hasta!)}` : `Desde ${mes(desde)}`;
}
