import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';

import { ready } from '../../../../../../core/view-state/view-state';
import { AppButton } from '../../../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../../../../shared/components/molecules/card/card';
import { Pagination } from '../../../../../../shared/components/molecules/pagination/pagination';
import { DataTable } from '../../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar } from '../../../../../../shared/components/organisms/filter-bar/filter-bar';
import { StatusSeal } from '../../../../../../shared/components/organisms/status-seal/status-seal';
import type {
  EspecialidadVisible,
  FormacionVisible,
  IdiomaVisible,
  MatriculaVisible,
  RespaldoCredencial,
} from '../practitioner-profile-view.types';
import {
  CREDENTIAL_GROUP_LABELS,
  CREDENTIAL_ICONS,
  CREDENTIAL_KINDS,
  type CredencialEnTarjeta,
  type CredentialFilter,
  type CredentialKind,
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
 * Ahora cada credencial es **una** tarjeta, con su sello y su fuente; lo
 * declarado y lo verificado se separan con un filtro arriba en vez de
 * repitiendo la lista entera. Y desde el 24/09/2026 las tarjetas van en un
 * bloque por clase —matrículas, especialidades, títulos, idiomas— en vez de
 * una sola rejilla entreverada, que el propietario encontró inentendible. Ninguna información se perdió: lo que
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
  imports: [AppButton, Card, NavIcon, StatusSeal, NgTemplateOutlet, DataTable, FilterBar, Pagination],
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
  readonly idiomas = input<readonly IdiomaVisible[]>([]);
  /** Los títulos que se pueden retirar. Quién puede y cuándo lo decide la ficha. */
  readonly retirables = input<ReadonlySet<string>>(new Set());
  readonly permiteDescarga = input(false);
  readonly descargando = input<string | null>(null);

  /** «Quiero retirar este título». Confirmarlo y retirarlo es de quien escucha. */
  readonly retirar = output<FormacionVisible>();
  readonly descargar = output<RespaldoCredencial>();

  protected readonly filtro = signal<CredentialFilter>('all');
  private readonly busquedas = signal<Readonly<Partial<Record<CredentialKind, string>>>>({});
  private readonly paginas = signal<Readonly<Partial<Record<CredentialKind, number>>>>({});
  private readonly tamanos = signal<Readonly<Partial<Record<CredentialKind, number>>>>({});
  protected readonly ICONOS = CREDENTIAL_ICONS;
  protected readonly GRUPOS = CREDENTIAL_GROUP_LABELS;

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
      ...(matricula.fileId === undefined ? {} : { fileId: matricula.fileId }),
    })),
    ...this.especialidades().map((especialidad): CredencialEnTarjeta => ({
      id: especialidad.id,
      clase: 'specialty',
      titulo: especialidad.nombre,
      detalles: [
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
      // La aprobación sobrevive al vencimiento; la fuente también existe en rechazos.
      verificada: estudio.approved ?? estudio.sello === 'approved',
      ...(estudio.fileId === undefined ? {} : { fileId: estudio.fileId }),
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

  /** El total original decide la tabla: buscar no hace saltar a tarjetas. */
  protected readonly grupos = computed(() =>
    CREDENTIAL_KINDS.map((clase) => {
      const total = this.todas().filter((credencial) => credencial.clase === clase).length;
      const busqueda = total > 5 ? (this.busquedas()[clase] ?? '') : '';
      const termino = normalizarTexto(busqueda);
      const tarjetas = this.visibles().filter(
        (credencial) => credencial.clase === clase && normalizarTexto([
          credencial.titulo,
          ...credencial.detalles,
          credencial.sello?.label ?? '',
          credencial.fuente ?? '',
        ].join(' ')).includes(termino),
      );
      const tamano = this.tamanos()[clase] ?? 10;
      const pagina = Math.min(
        this.paginas()[clase] ?? 1,
        Math.max(1, Math.ceil(tarjetas.length / tamano)),
      );
      const inicio = (pagina - 1) * tamano;
      return {
        clase,
        tarjetas,
        usaTabla: total > 5,
        busqueda,
        pagina,
        tamano,
        estado: ready(tarjetas.slice(inicio, inicio + tamano)),
      };
    }).filter((grupo) => grupo.usaTabla || grupo.tarjetas.length > 0),
  );

  private readonly celdaTitulo =
    viewChild.required<TemplateRef<{ $implicit: CredencialEnTarjeta }>>('celdaTitulo');
  private readonly celdaDetalles =
    viewChild.required<TemplateRef<{ $implicit: CredencialEnTarjeta }>>('celdaDetalles');
  private readonly celdaFuente =
    viewChild.required<TemplateRef<{ $implicit: CredencialEnTarjeta }>>('celdaFuente');
  private readonly celdaAcciones =
    viewChild.required<TemplateRef<{ $implicit: CredencialEnTarjeta }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<CredencialEnTarjeta>[]>(() => [
    { key: 'titulo', header: 'Credencial y estado', priority: 1, cell: this.celdaTitulo() },
    { key: 'detalles', header: 'Detalle', priority: 2, cell: this.celdaDetalles() },
    { key: 'fuente', header: 'Fuente de revisión', priority: 2, cell: this.celdaFuente() },
    { key: 'acciones', header: 'Acciones', priority: 2, cell: this.celdaAcciones() },
  ]);

  protected readonly porId = (credencial: CredencialEnTarjeta): string => credencial.id;
  protected readonly nombreDeFila = (credencial: CredencialEnTarjeta): string =>
    [credencial.titulo, ...credencial.detalles].join(' · ');

  /** Qué decir cuando el corte elegido no tiene nada. */
  protected readonly vacio = computed(() => {
    switch (this.filtro()) {
      case 'verified':
        return 'Todavía no hay nada verificado. Un administrador las comprueba contra la fuente que las emitió.';
      case 'declared':
        return 'No hay nada pendiente de verificación.';
      default:
        return 'Todavía no cargó credenciales. Son las que habilitan a ejercer: sin ninguna verificada el perfil queda pendiente.';
    }
  });

  protected elegirFiltro(filtro: CredentialFilter): void {
    this.filtro.set(filtro);
    this.paginas.set({});
  }

  protected buscar(clase: CredentialKind, termino: string): void {
    this.busquedas.update((actuales) => ({ ...actuales, [clase]: termino }));
    this.cambiarPagina(clase, 1);
  }

  protected cambiarPagina(clase: CredentialKind, pagina: number): void {
    this.paginas.update((actuales) => ({ ...actuales, [clase]: pagina }));
  }

  protected cambiarTamano(clase: CredentialKind, tamano: number): void {
    this.tamanos.update((actuales) => ({ ...actuales, [clase]: tamano }));
    this.cambiarPagina(clase, 1);
  }

  protected pedirDescarga(credencial: CredencialEnTarjeta): void {
    if (!this.permiteDescarga() || !credencial.fileId || this.descargando() !== null) {
      return;
    }
    const registro = credencial.clase === 'education'
      ? this.formacion().find((fila) => fila.id === credencial.id)
      : this.matriculas().find((fila) => fila.id === credencial.id);
    const prefijo = credencial.clase === 'education' ? 'diploma' : 'matricula';
    this.descargar.emit({
      fileId: credencial.fileId,
      nombre: `${prefijo}-${registro?.numero ?? credencial.id}`,
    });
  }

  protected pedirRetiro(id: string): void {
    const estudio = this.formacion().find((candidato) => candidato.id === id);
    if (estudio !== undefined) {
      this.retirar.emit(estudio);
    }
  }
}

function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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
