import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

import {
  ATOM_CATEGORY_CODES,
  ATOM_CATEGORY_LABELS,
  SUPPORT_ATOMS,
  type AtomCategoryCode,
  type PermissionAtomMeta,
} from '../../../core/data-access/support-access/support-atoms';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../shared/components/atoms/input/input';

interface Grupo {
  readonly category: AtomCategoryCode;
  readonly label: string;
  readonly atoms: readonly PermissionAtomMeta[];
}

const sinTildes = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');

/**
 * **Selector de permisos**: una lista con buscador, agrupada por categoría, donde se marcan los permisos que forman un grupo
 * (por ejemplo, los dos lados de una regla de separación de funciones). Lo elegido se ve siempre como una lista de nombres
 * quitables, así que el estado no depende de recorrer las 73 casillas.
 *
 * Nada de acá autoriza: es un campo de formulario; la API valida lo que reciba.
 */
@Component({
  selector: 'app-atom-picker',
  imports: [Checkbox, Input],
  templateUrl: './atom-picker.html',
  styleUrl: './atom-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtomPicker {
  /** Los códigos elegidos. */
  readonly selected = model<readonly string[]>([]);
  readonly label = input.required<string>();
  /** Prefijo de los `data-testid` y de los ids. */
  readonly idPrefix = input.required<string>();
  readonly hasError = input(false);

  protected readonly filtro = signal('');

  protected readonly grupos = computed<readonly Grupo[]>(() => {
    const q = sinTildes(this.filtro().trim());
    return ATOM_CATEGORY_CODES.map((category) => ({
      category,
      label: ATOM_CATEGORY_LABELS[category],
      atoms: SUPPORT_ATOMS.filter(
        (a) =>
          a.category === category &&
          (q === '' || sinTildes(a.name).includes(q) || a.code.includes(q)),
      ),
    })).filter((g) => g.atoms.length > 0);
  });

  protected readonly elegidos = computed(() =>
    this.selected().map((code) => ({
      code,
      name: SUPPORT_ATOMS.find((a) => a.code === code)?.name ?? code,
    })),
  );

  protected estaElegido(code: string): boolean {
    return this.selected().includes(code);
  }

  protected alternar(code: string, marcado: boolean): void {
    const actual = this.selected();
    this.selected.set(
      marcado
        ? actual.includes(code)
          ? actual
          : [...actual, code]
        : actual.filter((c) => c !== code),
    );
  }

  protected quitar(code: string): void {
    this.alternar(code, false);
  }
}
