import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { startTelemetry } from './app/core/observability/telemetry.bootstrap';

/**
 * La telemetría arranca **antes** que Angular, y no se la espera.
 *
 * Antes, porque lo primero que hay que medir es el propio arranque: engancharla
 * después dejaría sin respuesta «¿cuánto tardó en aparecer la aplicación?», que
 * es la pregunta que más se hace y la única que no se puede reconstruir a
 * posteriori.
 *
 * Sin esperarla, porque `startTelemetry` no devuelve una promesa: dispara la
 * descarga del SDK en un fragmento aparte y sigue. Si esa descarga tarda, falla
 * o la corta un bloqueador de contenido, Angular arranca igual y a la misma
 * velocidad. Con la telemetría apagada —el valor por defecto— ni siquiera se
 * pide el fragmento.
 */
const bootstrap = startTelemetry();

bootstrapApplication(App, appConfig)
  .then(() => bootstrap.completed())
  .catch((err) => {
    bootstrap.failed(err);
    console.error(err);
  });
