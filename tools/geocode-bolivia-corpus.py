#!/usr/bin/env python3
"""Le pone un punto en el mapa a cada sucursal del corpus «Bolivia Salud».

## Por qué hace falta

El corpus de `data/bolivia-salud-eje-central/` **no publica coordenadas**, y no
por olvido: `metadata/metodologia.json` declara «coordenadas» entre sus
`criterios_no_inventar`. Es la decisión correcta para un corpus.

Pero los cuatro directorios de la aplicación dibujan un mapa, y un mapa
necesita un punto. Así que el punto se **deriva**, con el mismo proveedor que
ya usan esos mapas —Nominatim, de OpenStreetMap— y viaja siempre con la
precisión con que se resolvió:

    direccion  Nominatim reconoció la dirección publicada, entera.
    via        reconoció la vía, sin el número de puerta.
    zona       reconoció el barrio o la zona.
    ciudad     no reconoció nada. Es el centro de la ciudad, y la ficha lo
               dice: «ubicación aproximada».

Ninguna coordenada se escribe a mano, y lo que no se resuelve queda marcado
como aproximado en vez de fingir precisión.

## Cómo se usa

    python3 tools/geocode-bolivia-corpus.py

Es **incremental**: relee `ubicaciones.json` y sólo pide lo que falta o lo que
quedó en `ciudad`. Correrlo dos veces seguidas no pide nada y no cambia nada.
Respeta el límite de una petición por segundo que pide la política de uso de
Nominatim, así que la primera corrida completa tarda unos minutos.

    python3 tools/geocode-bolivia-corpus.py --desde-cero

vuelve a pedirlo todo.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

CORPUS = Path(__file__).resolve().parent.parent / 'data' / 'bolivia-salud-eje-central'
SALIDA = CORPUS / 'ubicaciones.json'
ARCHIVOS_DE_SUCURSALES = ('santa_cruz', 'la_paz_el_alto', 'cochabamba')

# La política de uso de Nominatim exige identificarse y no pasar de 1 req/s.
AGENTE = 'alovida-mockup-fixtures/1.0 (+https://github.com/mdavila-2001/mantra-core-health)'
ESPERA_SEGUNDOS = 1.1

# Un acierto a más de esta distancia del centro de su ciudad es otro sitio con
# el mismo nombre —«Calacoto» hay en La Paz y a 132 km—, no la sucursal.
RADIO_MAXIMO_KM = 30

# Lo que estorba a Nominatim: números de puerta, pisos, referencias y el nombre
# del edificio. La vía sí la reconoce.
RUIDO = re.compile(
    r'(#\s*\d+|N\.º\s*\d+|Nº\s*\d+|N°\s*\d+|No\.\s*\d+|s/n|esq\.?|entre .*|frente a .*'
    r'|zona |barrio |\bpiso\b.*|\boficina\b.*|\blocal\b.*|\bedificio\b.*|\bedif\.?\b.*'
    r'|\burb\.?\b.*)',
    re.I,
)


def pedir(parametros: dict[str, str]) -> dict | None:
    """Una consulta a Nominatim, acotada a Bolivia. `None` si no encuentra nada.

    Usa `curl` y no `urllib` a propósito: en macOS la instalación de Python de
    python.org no trae el almacén de certificados del sistema, y `urllib` muere
    con `CERTIFICATE_VERIFY_FAILED` contra un sitio perfectamente válido. `curl`
    usa el almacén del sistema y está en todas partes.
    """
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
        {**parametros, 'format': 'json', 'limit': 1, 'countrycodes': 'bo'}
    )
    try:
        respuesta = subprocess.run(
            ['curl', '--silent', '--max-time', '20', '--user-agent', AGENTE, url],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        encontrados = json.loads(respuesta)
    except (subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f'  aviso: la consulta {parametros} falló ({error})', file=sys.stderr)
        encontrados = []
    time.sleep(ESPERA_SEGUNDOS)
    return encontrados[0] if encontrados else None


def kilometros(uno: dict, otro: dict) -> float:
    """Distancia sobre la esfera entre dos aciertos de Nominatim."""
    lat1, lng1, lat2, lng2 = (
        math.radians(float(valor))
        for valor in (uno['lat'], uno['lon'], otro['lat'], otro['lon'])
    )
    seno = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * 6371 * math.asin(math.sqrt(seno))


def consultas_de(sucursal: dict) -> list[tuple[str, dict[str, str]]]:
    """Las consultas a probar, de la más precisa a la más general.

    La dirección entera primero; después cada tramo con el ruido quitado —que
    suele dejar la vía sola—; y al final la zona. La primera que caiga dentro
    del radio gana.
    """
    ciudad = sucursal['ciudad']
    direccion = sucursal.get('direccion')
    zona = sucursal.get('zona')
    consultas: list[tuple[str, dict[str, str]]] = []

    if direccion:
        consultas.append(('direccion', {'q': f'{direccion}, {ciudad}, Bolivia'}))
        for tramo in (parte.strip() for parte in direccion.split(',')):
            via = RUIDO.sub('', tramo).strip(' .,-')
            if len(via) >= 5:
                consultas.append(('via', {'q': f'{via}, {ciudad}, Bolivia'}))
    if zona:
        for parte in re.split(r'[/,]', zona):
            barrio = parte.strip()
            if len(barrio) >= 4:
                consultas.append(('zona', {'q': f'{barrio}, {ciudad}, Bolivia'}))

    vistas: set[str] = set()
    unicas = []
    for precision, parametros in consultas:
        clave = parametros['q']
        if clave not in vistas:
            vistas.add(clave)
            unicas.append((precision, parametros))
    return unicas


def main() -> int:
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument(
        '--desde-cero',
        action='store_true',
        help='vuelve a pedir todas las ubicaciones, incluidas las ya resueltas',
    )
    opciones = argumentos.parse_args()

    sucursales = [
        sucursal
        for archivo in ARCHIVOS_DE_SUCURSALES
        for sucursal in json.loads((CORPUS / 'sucursales' / f'{archivo}.json').read_text('utf8'))[
            'sucursales'
        ]
    ]

    resueltas: dict[str, dict] = {}
    if SALIDA.exists() and not opciones.desde_cero:
        resueltas = json.loads(SALIDA.read_text('utf8'))

    # El centro de cada ciudad: es el respaldo, y también la vara con la que se
    # descarta un acierto homónimo de otro departamento.
    centros: dict[str, dict] = {}
    for sucursal in sucursales:
        ciudad = sucursal['ciudad']
        if ciudad in centros:
            continue
        acierto = pedir(
            {'city': ciudad, 'state': sucursal['departamento'], 'country': 'Bolivia'}
        )
        if acierto is None:
            print(f'no se pudo ubicar la ciudad {ciudad}; se aborta', file=sys.stderr)
            return 1
        centros[ciudad] = acierto
        print(f'  ciudad · {ciudad} → {acierto["lat"]}, {acierto["lon"]}')

    pendientes = [
        sucursal
        for sucursal in sucursales
        if resueltas.get(sucursal['id'], {}).get('precision', 'ciudad') == 'ciudad'
    ]
    print(f'· {len(sucursales)} sucursales · {len(pendientes)} por resolver')

    for sucursal in pendientes:
        centro = centros[sucursal['ciudad']]
        punto = None
        for precision, parametros in consultas_de(sucursal):
            acierto = pedir(parametros)
            if acierto is None:
                continue
            distancia = kilometros(acierto, centro)
            if distancia > RADIO_MAXIMO_KM:
                print(
                    f'  descartado · {sucursal["id"]} · «{parametros["q"]}» cae a '
                    f'{distancia:.0f} km del centro'
                )
                continue
            punto = {
                'lat': round(float(acierto['lat']), 6),
                'lng': round(float(acierto['lon']), 6),
                'precision': precision,
                'query': parametros['q'],
                'display': acierto.get('display_name', ''),
            }
            break

        if punto is None:
            punto = {
                'lat': round(float(centro['lat']), 6),
                'lng': round(float(centro['lon']), 6),
                'precision': 'ciudad',
                'query': f'{sucursal["ciudad"]}, Bolivia',
                'display': centro.get('display_name', ''),
            }

        resueltas[sucursal['id']] = punto
        print(f'  {sucursal["id"]} · {punto["precision"]} · {punto["lat"]}, {punto["lng"]}')
        SALIDA.write_text(
            json.dumps(dict(sorted(resueltas.items())), ensure_ascii=False, indent=1) + '\n',
            'utf8',
        )

    SALIDA.write_text(
        json.dumps(dict(sorted(resueltas.items())), ensure_ascii=False, indent=1) + '\n', 'utf8'
    )

    cuenta: dict[str, int] = {}
    for punto in resueltas.values():
        cuenta[punto['precision']] = cuenta.get(punto['precision'], 0) + 1
    resumen = ' · '.join(f'{clave} {n}' for clave, n in sorted(cuenta.items(), key=lambda x: -x[1]))
    print(f'· {len(resueltas)} ubicaciones · {resumen}')
    print(f'  → {SALIDA.relative_to(Path.cwd()) if SALIDA.is_relative_to(Path.cwd()) else SALIDA}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
