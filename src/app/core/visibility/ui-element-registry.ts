import type { UiElementDraft, UiElementKind } from '../data-access/ui-visibility/ui-visibility.types';
import { APP_SECTIONS } from '../navigation/navigation.map';
import type { AppSection } from '../navigation/navigation.types';
import { moduleCodeOf, navGroupKey, navScreenKey, UI_ELEMENT_KEY_PATTERN } from './ui-element-keys';

/**
 * El registro de lo que se puede ocultar. Primero se cataloga, después se regla: una regla sólo puede apuntar a un
 * elemento que existe en el catálogo.
 *
 * **La visibilidad no es autorización.** Catalogar un elemento no lo protege; sólo permite decidir si se presenta.
 *
 * ## De dónde sale el catálogo
 *
 * 1. **Solo, desde el menú** ({@link deriveNavElements}): un grupo (`MENU_SECTION`, clave `nav.group.<grupo>`) por
 *    cada grupo de `APP_SECTIONS` y una pantalla (`SCREEN`, clave `nav.<ruta con puntos>`) por cada sección, colgada
 *    de su grupo. Agregar una sección al registro la agrega al catálogo sin tocar nada más.
 * 2. **Declarado por cada feature** ({@link declareUiElements}): los `SECTION`, `WIDGET`, `FIELD` y `ACTION` de una
 *    pantalla. Se declaran en un archivo `*.ui-elements.ts` de la feature —datos puros— y se importan desde
 *    `app/ui-elements.catalog.ts`, que es lo que ve el portal de administración al sincronizar.
 */

/** Lo que una feature puede declarar. `MODULE`, `MENU_SECTION` y `SCREEN` salen del menú, no se declaran a mano. */
export type DeclarableUiElementKind = Extract<UiElementKind, 'SECTION' | 'WIDGET' | 'FIELD' | 'ACTION'>;

export interface UiElementDeclaration {
  /** `<modulo>.<pantalla>.<elemento>`, en minúsculas y con puntos (`dashboard.today-agenda`). Estable: renombrarla pierde las reglas. */
  readonly key: string;
  readonly kind: DeclarableUiElementKind;
  /** El módulo al que pertenece (`dashboard`, `pharmacy`…). Es lo que filtra el catálogo del portal. */
  readonly moduleCode: string;
  /**
   * Su padre: la pantalla (`nav.dashboard`) u otro elemento declarado. **Ocultar un padre oculta a todos sus
   * descendientes** (lo resuelve el servidor). `null` sólo para una raíz.
   */
  readonly parentKey: string | null;
  /** El nombre con el que lo ve quien administra las reglas. */
  readonly label: string;
  readonly description?: string;
  /** Visible cuando ninguna regla lo decide. `true` por omisión. */
  readonly defaultVisible?: boolean;
}

const declarados = new Map<string, UiElementDeclaration>();

/**
 * Declara los elementos de una pantalla para el catálogo. Se llama una vez por feature, al cargar el archivo.
 *
 * Falla fuerte ante una clave mal formada o una clave repetida con otro contenido: un catálogo ambiguo es peor que
 * uno que no arranca. Declarar dos veces **lo mismo** es inofensivo (los módulos pueden evaluarse más de una vez).
 */
export function declareUiElements(elementos: readonly UiElementDeclaration[]): void {
  for (const elemento of elementos) {
    if (!UI_ELEMENT_KEY_PATTERN.test(elemento.key)) {
      throw new Error(`Clave de elemento de interfaz inválida: «${elemento.key}» (forma: modulo.pantalla.elemento, en minúsculas).`);
    }
    const previo = declarados.get(elemento.key);
    if (previo !== undefined && JSON.stringify(previo) !== JSON.stringify(elemento)) {
      throw new Error(`El elemento de interfaz «${elemento.key}» ya está declarado con otro contenido.`);
    }
    declarados.set(elemento.key, elemento);
  }
}

/** Lo declarado hasta ahora, en orden de clave. */
export function declaredUiElements(): readonly UiElementDeclaration[] {
  return [...declarados.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Sólo para las pruebas: vacía lo declarado. */
export function resetDeclaredUiElementsForTests(): void {
  declarados.clear();
}

/**
 * Un `MENU_SECTION` por grupo del menú y un `SCREEN` por sección, colgado de su grupo.
 * Se puede pasar otro registro para probarlo; por omisión es el real.
 */
export function deriveNavElements(secciones: readonly AppSection[] = APP_SECTIONS): readonly UiElementDraft[] {
  const grupos = [...new Set(secciones.map((s) => s.group))];
  const deGrupo = grupos.map<UiElementDraft>((grupo) => ({
    key: navGroupKey(grupo),
    kind: 'MENU_SECTION',
    moduleCode: 'nav',
    parentKey: null,
    label: grupo,
    description: 'Grupo del menú lateral. Ocultarlo oculta todas sus pantallas.',
    defaultVisible: true,
  }));
  const dePantalla = secciones.map<UiElementDraft>((s) => ({
    key: navScreenKey(s.path),
    kind: 'SCREEN',
    moduleCode: moduleCodeOf(s.module),
    parentKey: navGroupKey(s.group),
    label: s.label,
    description: s.summary,
    defaultVisible: true,
  }));
  return [...deGrupo, ...dePantalla];
}

function comoBorrador(e: UiElementDeclaration): UiElementDraft {
  return {
    key: e.key,
    kind: e.kind,
    moduleCode: e.moduleCode,
    parentKey: e.parentKey,
    label: e.label,
    description: e.description ?? null,
    defaultVisible: e.defaultVisible ?? true,
  };
}

/** Todo el catálogo que declara el código: lo derivado del menú más lo declarado por las features. */
export function collectUiElementDrafts(secciones: readonly AppSection[] = APP_SECTIONS): readonly UiElementDraft[] {
  return [...deriveNavElements(secciones), ...declaredUiElements().map(comoBorrador)];
}

/**
 * Lo que está mal en el catálogo: claves mal formadas o repetidas, padres que no existen y ciclos.
 * Vacío = sincronizable.
 */
export function validateUiElementDrafts(drafts: readonly UiElementDraft[]): readonly string[] {
  const problemas: string[] = [];
  const porClave = new Map<string, UiElementDraft>();
  for (const d of drafts) {
    if (!UI_ELEMENT_KEY_PATTERN.test(d.key)) {
      problemas.push(`clave inválida: «${d.key}»`);
    }
    if (porClave.has(d.key)) {
      problemas.push(`clave repetida: «${d.key}»`);
    }
    porClave.set(d.key, d);
  }
  for (const d of drafts) {
    if (d.parentKey === null) continue;
    if (!porClave.has(d.parentKey)) {
      problemas.push(`«${d.key}» cuelga de «${d.parentKey}», que no existe en el catálogo`);
      continue;
    }
    const visitados = new Set<string>([d.key]);
    let actual: string | null = d.parentKey;
    while (actual !== null) {
      if (visitados.has(actual)) {
        problemas.push(`ciclo de padres que pasa por «${d.key}»`);
        break;
      }
      visitados.add(actual);
      actual = porClave.get(actual)?.parentKey ?? null;
    }
  }
  return problemas;
}

/**
 * Arma los `UiElementDraft[]` para `POST /admin/ui-visibility/elements/sync`. Lanza si el catálogo es inconsistente:
 * mejor no sincronizar que publicar un catálogo con padres rotos.
 */
export function buildUiElementDrafts(secciones: readonly AppSection[] = APP_SECTIONS): readonly UiElementDraft[] {
  const drafts = collectUiElementDrafts(secciones);
  const problemas = validateUiElementDrafts(drafts);
  if (problemas.length > 0) {
    throw new Error(`Catálogo de visibilidad inconsistente:\n- ${problemas.join('\n- ')}`);
  }
  return drafts;
}
