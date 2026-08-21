import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { APP_SECTIONS } from '../navigation/navigation.map';
import { isVisibleTo } from '../navigation/navigation.types';
import type {
  TutorialConfigIssue,
  TutorialDefinition,
  TutorialStep,
} from './tutorial.types';

/**
 * El catálogo de tutoriales, validado.
 *
 * ## Por qué la validación vive acá y no en una prueba
 *
 * Podría alcanzar con una prueba que recorra las definiciones. No alcanza: los
 * tutoriales los va a escribir gente que no escribió el motor, y el error típico
 * —un requisito que apunta a un tutorial que se renombró— no se ve leyendo el
 * archivo. Validar al registrar hace que el problema aparezca al arrancar, con
 * el identificador del tutorial y el código del error, en vez de aparecer como
 * un recorrido que se corta a la mitad delante de un usuario.
 *
 * Los problemas **no tiran una excepción**: se acumulan y quedan disponibles en
 * `issues()`. Un tutorial mal configurado no puede tumbar la aplicación entera —
 * es ayuda, no infraestructura— pero tampoco puede pasar inadvertido, así que el
 * centro de tutoriales los muestra y el registro descarta los que no son
 * ejecutables.
 *
 * ## El filtrado por rol no autoriza nada
 *
 * Esconder un tutorial de un módulo que la sesión no puede abrir es cortesía y
 * es honestidad: enseñar a usar una pantalla que va a responder 403 es peor que
 * no enseñar nada. Quien autoriza sigue siendo el backend, en cada petición.
 */
@Injectable({ providedIn: 'root' })
export class TutorialRegistry {
  private readonly auth = inject(AuthService);

  private readonly definiciones = signal<readonly TutorialDefinition[]>([]);
  private readonly problemas = signal<readonly TutorialConfigIssue[]>([]);

  /** Todos los tutoriales ejecutables, sin filtrar por sesión. */
  readonly all = this.definiciones.asReadonly();

  /** Los problemas de configuración detectados al registrar. */
  readonly issues = this.problemas.asReadonly();

  /**
   * Los tutoriales que **esta sesión** puede hacer.
   *
   * Se filtra por rol dos veces: el tutorial entero, y después cada paso. Un
   * tutorial cuyos pasos se filtran todos deja de ofrecerse — un recorrido de
   * cero pasos no es un recorrido.
   */
  readonly available = computed<readonly TutorialDefinition[]>(() => {
    const roles = this.auth.roles();
    return this.definiciones()
      .filter((tutorial) => alcanzaElRol(tutorial.roles, roles))
      .map((tutorial) => ({
        ...tutorial,
        steps: tutorial.steps.filter((paso) => alcanzaElRol(paso.roles, roles)),
      }))
      .filter((tutorial) => tutorial.steps.length > 0);
  });

  /** Las categorías presentes, en el orden en que aparecen. Para los filtros. */
  readonly categories = computed<readonly string[]>(() => [
    ...new Set(this.available().map((tutorial) => tutorial.category)),
  ]);

  /**
   * Registra un lote de definiciones, descartando las que no son ejecutables.
   *
   * Reemplaza el catálogo entero en vez de acumular: registrar dos veces el
   * mismo lote —lo que pasa en las pruebas y con la recarga en caliente—
   * duplicaría todo, y el primer síntoma sería un «id duplicado» que nadie
   * escribió.
   */
  register(definiciones: readonly TutorialDefinition[]): void {
    const problemas: TutorialConfigIssue[] = [];
    const porId = new Map<string, TutorialDefinition>();

    for (const tutorial of definiciones) {
      if (porId.has(tutorial.id)) {
        problemas.push({
          tutorialId: tutorial.id,
          code: 'id-duplicado',
          message: `Ya hay un tutorial registrado con el id «${tutorial.id}».`,
        });
        continue;
      }
      problemas.push(...revisar(tutorial));
      porId.set(tutorial.id, tutorial);
    }

    // Los cruces entre tutoriales se revisan al final, con el catálogo completo:
    // un requisito puede apuntar a un tutorial declarado más abajo en la lista.
    problemas.push(...revisarCruces(porId));

    const rotos = new Set(
      problemas.filter((problema) => esFatal(problema.code)).map((problema) => problema.tutorialId),
    );

    this.definiciones.set([...porId.values()].filter((tutorial) => !rotos.has(tutorial.id)));
    this.problemas.set(problemas);
  }

  /** Un tutorial por id, ya filtrado para esta sesión. `null` si no aplica. */
  find(id: string): TutorialDefinition | null {
    return this.available().find((tutorial) => tutorial.id === id) ?? null;
  }
}

/**
 * Si los roles de la sesión alcanzan.
 *
 * Misma regla que el menú, y a propósito: `SUPERADMIN` es comodín porque lo es
 * en el `RolesGuard` del backend, y sin requisitos declarados lo ve cualquiera.
 * Tener dos reglas de visibilidad distintas en la misma aplicación es cómo se
 * llega a un tutorial que enseña una sección que no está en el menú.
 */
function alcanzaElRol(requeridos: readonly string[] | undefined, roles: readonly string[]): boolean {
  if (roles.includes('SUPERADMIN')) {
    return true;
  }
  return requeridos === undefined || requeridos.some((rol) => roles.includes(rol));
}

/** Los códigos que hacen inejecutable un tutorial; el resto son advertencias. */
function esFatal(code: TutorialConfigIssue['code']): boolean {
  return code === 'sin-pasos' || code === 'paso-duplicado' || code === 'version-invalida';
}

/** Las rutas que la aplicación declara, para no aceptar destinos inventados. */
const RUTAS_CONOCIDAS = new Set(APP_SECTIONS.map((seccion) => `/${seccion.path}`));

/** Revisa un tutorial contra sí mismo. */
function revisar(tutorial: TutorialDefinition): readonly TutorialConfigIssue[] {
  const problemas: TutorialConfigIssue[] = [];

  if (tutorial.steps.length === 0) {
    problemas.push({
      tutorialId: tutorial.id,
      code: 'sin-pasos',
      message: 'Un tutorial sin pasos no es un recorrido.',
    });
  }

  if (!/^\d+\.\d+$/.test(tutorial.version)) {
    problemas.push({
      tutorialId: tutorial.id,
      code: 'version-invalida',
      message: `La versión «${tutorial.version}» no tiene la forma «mayor.menor».`,
    });
  }

  const vistos = new Set<string>();
  for (const paso of tutorial.steps) {
    if (vistos.has(paso.id)) {
      problemas.push({
        tutorialId: tutorial.id,
        stepId: paso.id,
        code: 'paso-duplicado',
        message: `El paso «${paso.id}» está declarado dos veces.`,
      });
    }
    vistos.add(paso.id);
    problemas.push(...revisarPaso(tutorial, paso));
  }

  problemas.push(...revisarRuta(tutorial, tutorial.route));
  return problemas;
}

/** Revisa un paso. */
function revisarPaso(
  tutorial: TutorialDefinition,
  paso: TutorialStep,
): readonly TutorialConfigIssue[] {
  const problemas: TutorialConfigIssue[] = [...revisarRuta(tutorial, paso.route, paso.id)];

  // Un paso cuyos roles no se cruzan con los del tutorial no lo ve nadie nunca:
  // es una declaración muerta, y casi siempre un error de tipeo en un rol.
  if (paso.roles !== undefined && tutorial.roles !== undefined) {
    const cruce = paso.roles.some((rol) => tutorial.roles?.includes(rol));
    if (!cruce) {
      problemas.push({
        tutorialId: tutorial.id,
        stepId: paso.id,
        code: 'rol-imposible',
        message:
          'Los roles del paso no se cruzan con los del tutorial: nadie lo va a ver nunca.',
      });
    }
  }

  return problemas;
}

/**
 * Revisa que una ruta exista entre las secciones declaradas.
 *
 * Se compara contra el prefijo porque muchas rutas llevan parámetros
 * (`/medical-records/:id`) y el registro de secciones sólo declara la raíz.
 */
function revisarRuta(
  tutorial: TutorialDefinition,
  ruta: string | undefined,
  stepId?: string,
): readonly TutorialConfigIssue[] {
  if (ruta === undefined) {
    return [];
  }
  const conocida = [...RUTAS_CONOCIDAS].some(
    (declarada) => ruta === declarada || ruta.startsWith(`${declarada}/`),
  );
  return conocida
    ? []
    : [
        {
          tutorialId: tutorial.id,
          stepId,
          code: 'ruta-invalida' as const,
          message: `La ruta «${ruta}» no corresponde a ninguna sección declarada.`,
        },
      ];
}

/** Revisa requisitos y encadenados, que sólo se pueden mirar con todo el catálogo. */
function revisarCruces(
  porId: ReadonlyMap<string, TutorialDefinition>,
): readonly TutorialConfigIssue[] {
  const problemas: TutorialConfigIssue[] = [];

  for (const tutorial of porId.values()) {
    for (const requisito of tutorial.prerequisites ?? []) {
      if (!porId.has(requisito)) {
        problemas.push({
          tutorialId: tutorial.id,
          code: 'requisito-inexistente',
          message: `El requisito «${requisito}» no existe.`,
        });
      }
    }
    if (tutorial.next !== undefined && !porId.has(tutorial.next)) {
      problemas.push({
        tutorialId: tutorial.id,
        code: 'siguiente-inexistente',
        message: `El tutorial siguiente «${tutorial.next}» no existe.`,
      });
    }
    if (hayCiclo(tutorial.id, porId)) {
      problemas.push({
        tutorialId: tutorial.id,
        code: 'requisito-circular',
        message: 'Sus requisitos forman un ciclo: nunca se podría empezar por ninguno.',
      });
    }
  }

  return problemas;
}

/**
 * Si los requisitos de un tutorial vuelven sobre él.
 *
 * Recorrido en profundidad con la pila explícita del camino actual: un ciclo es
 * volver a pisar un id que ya está en el camino, no uno que ya se visitó antes
 * por otra rama.
 */
function hayCiclo(inicio: string, porId: ReadonlyMap<string, TutorialDefinition>): boolean {
  const camino = new Set<string>();

  const bajar = (id: string): boolean => {
    if (camino.has(id)) {
      return true;
    }
    camino.add(id);
    const requisitos = porId.get(id)?.prerequisites ?? [];
    const encontrado = requisitos.some((requisito) => bajar(requisito));
    camino.delete(id);
    return encontrado;
  };

  return bajar(inicio);
}

/** Expuesto para las pruebas del menú: qué secciones ve esta sesión. */
export function seccionesVisibles(
  roles: readonly string[],
  tenants: readonly string[] = [],
): readonly string[] {
  return APP_SECTIONS.filter((seccion) => isVisibleTo(seccion, roles, tenants)).map(
    (seccion) => `/${seccion.path}`,
  );
}
