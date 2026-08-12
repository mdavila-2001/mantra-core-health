import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavigationService } from '../../../core/navigation/navigation.service';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Una operación del módulo, con su pantalla si ya existe. */
interface Operacion {
  readonly label: string;
  readonly route?: string;
}

interface Area {
  readonly titulo: string;
  readonly descripcion: string;
  readonly operaciones: readonly Operacion[];
}

const BASE = '/administration/health-context';

/**
 * Portada de la sección «Contexto sanitario» (M44).
 *
 * El backend del módulo tiene **doce comandos y una sola lectura**
 * —`GET /health-context/contexts/resolve`—, así que esta portada no lista nada:
 * ordena las operaciones por área, igual que las de M29, M40 y M27. Cuando
 * lleguen los `GET` de colección, acá va el listado de contextos con sus
 * acciones por fila.
 *
 * El resolver no es la pantalla de la sección aunque sea la única lectura: pide
 * tres parámetros obligatorios, así que entrar a la sección mostraría un vacío
 * permanente. Va como una operación más, dentro de su área.
 */
@Component({
  selector: 'app-health-context-home',
  imports: [Alert, Card, Link, PageHeader, RouterLink],
  templateUrl: './health-context-home.html',
  styleUrl: '../../portada.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthContextHome {
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly areas: readonly Area[] = [
    {
      titulo: 'Contextos',
      descripcion:
        'El contexto sanitario de un país para un dominio y una clave. Se crea en borrador y se consulta ya publicado.',
      operaciones: [
        { label: 'Resolver el contexto vigente', route: `${BASE}/contexts/resolve` },
        { label: 'Crear un contexto', route: `${BASE}/contexts/new` },
      ],
    },
    {
      titulo: 'Versiones',
      descripcion:
        'Cada versión nace en borrador con sus hechos y su evidencia; publicar es una decisión aparte y exige revisión aprobada.',
      operaciones: [
        { label: 'Redactar una versión', route: `${BASE}/versions/new` },
        { label: 'Registrar una revisión de calidad', route: `${BASE}/quality-reviews/new` },
        { label: 'Publicar una versión', route: `${BASE}/versions/publish` },
        { label: 'Retirar una versión', route: `${BASE}/versions/supersede` },
      ],
    },
    {
      titulo: 'Recolección',
      descripcion:
        'La corrida es idempotente por clave y se cierra una sola vez; sus observaciones son inmutables y se deduplican por hash.',
      operaciones: [
        { label: 'Iniciar una corrida', route: `${BASE}/collection-runs/new` },
        { label: 'Registrar una observación', route: `${BASE}/observations/new` },
        { label: 'Cerrar una corrida', route: `${BASE}/collection-runs/finish` },
      ],
    },
    {
      titulo: 'Agentes y fuentes',
      descripcion:
        'Quién recolecta, de dónde, con qué licencia y con cuánta confianza — y cada cuánto vuelve a mirar.',
      operaciones: [
        { label: 'Registrar un agente', route: `${BASE}/agents/new` },
        { label: 'Registrar una fuente', route: `${BASE}/sources/new` },
        { label: 'Programar una recolección', route: `${BASE}/schedules/new` },
      ],
    },
  ];
}
