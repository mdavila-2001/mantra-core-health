import { environment } from '../../../environments/environment';

/**
 * Sólo para pruebas: enciende o apaga `environment.reportingMockEnabled` y devuelve la función que restaura el
 * valor anterior (llamarla en `afterEach`). El entorno es un objeto plano compartido, así que olvidar restaurar
 * contamina a las pruebas siguientes del mismo archivo.
 */
export function setReportingMock(encendida: boolean): () => void {
  const entorno = environment as { reportingMockEnabled: boolean };
  const anterior = entorno.reportingMockEnabled;
  entorno.reportingMockEnabled = encendida;
  return () => {
    entorno.reportingMockEnabled = anterior;
  };
}
