import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SymptomCheck } from '../../../symptom-check/symptom-check';

/**
 * El triaje de síntomas, **sin sesión**.
 *
 * ## Por qué existe
 *
 * Era lo primero que veía un paciente al entrar, y entrar es justamente lo que
 * no ha hecho quien todavía no sabe a qué médico ir. La pregunta que trae a
 * alguien a una plataforma de salud —«me pasa esto, ¿a quién consulto?»— llegaba
 * detrás de un formulario de registro, que es pedirle la cuenta antes de darle
 * la razón para abrirla.
 *
 * ## Es el MISMO componente, no una copia
 *
 * `app-symptom-check` se instancia con dos entradas: `sinSesion`, que cambia de
 * dónde salen las especialidades —el buscador público en vez del directorio
 * interno, que responde 401 a quien no entró— y `rutaDeResultados`, que manda a
 * la guía pública en vez de a la interna. Todo lo demás —la tabla de síntomas,
 * el reconocimiento, la derivación a urgencias— es literalmente el mismo
 * código: duplicarlo habría dejado dos triajes que se contradicen, y en salud
 * eso no es un problema de mantenimiento.
 *
 * ## Lo que sigue sin estar validado
 *
 * La tabla de síntomas **no tiene revisión médica** (§8 del plan de UX del
 * 23/08/2026). Publicarla sin sesión aumenta quién la ve, no su respaldo: el
 * aviso de que orienta y no diagnostica lo pinta el propio componente, y ahí se
 * queda hasta que el equipo médico la revise.
 */
@Component({
  selector: 'app-sintomas-publico',
  imports: [RouterLink, SymptomCheck],
  template: `
    <div class="sintomas-publico">
      <header class="sintomas-publico__cabecera">
        <p class="overline">Orientación</p>
        <!-- El título NO repite la pregunta del formulario: el componente ya
             pregunta «¿Qué te pasa?» dos líneas más abajo, y dos preguntas
             seguidas se leen como un error de armado. Este encabezado dice qué
             es la página; el formulario, qué hay que hacer. -->
        <h1 class="sintomas-publico__titulo">Consultá tus síntomas</h1>
        <p class="sintomas-publico__bajada">
          Sin cuenta y sin turno: describí lo que sentís y te orientamos sobre a qué
          especialidad conviene consultar.
        </p>
      </header>

      <app-symptom-check [sinSesion]="true" rutaDeResultados="/buscar/profesionales" />

      <p class="sintomas-publico__pie">
        ¿Ya sabés a quién buscar?
        <a routerLink="/buscar/profesionales">Ver todos los profesionales</a>
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sintomas-publico {
      display: flex;
      flex-direction: column;
      gap: var(--e5, 1.5rem);
      max-inline-size: 72ch;
      margin-inline: auto;
    }

    .sintomas-publico__cabecera .overline {
      margin: 0;
    }

    .sintomas-publico__titulo {
      margin: var(--e2) 0 0;
      font-family: var(--f-titulo);
      font-size: 32px;
      line-height: 1.15;
      color: var(--tinta-marca);
    }

    .sintomas-publico__bajada {
      margin: var(--e3) 0 0;
      color: var(--tinta-2);
      max-inline-size: 60ch;
    }

    .sintomas-publico__pie {
      margin: 0;
      color: var(--tinta-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SintomasPublico {}
