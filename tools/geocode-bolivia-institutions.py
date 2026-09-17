#!/usr/bin/env python3
"""Le pone un punto en el mapa a cada institución de `data/bolivia-instituciones/`.

Mismo criterio que `geocode-bolivia-corpus.py`, del que es hermano: las
planillas traen dirección, no coordenadas, y los directorios dibujan un mapa.
El punto se **deriva** con Nominatim (OpenStreetMap, el proveedor que ya usan
esos mapas) y viaja con la precisión con la que se resolvió:

    direccion  Nominatim reconoció la dirección publicada, entera.
    via        reconoció la vía, sin el número de puerta.
    ciudad     no reconoció nada. Es el centro de la ciudad, y la ficha debe
               decir «ubicación aproximada» en vez de fingir precisión.

Sólo geocodifica las urbanas —clínicas, hospitales, cajas y aseguradoras—.
Los 464 centros de primer nivel están repartidos por todo el departamento y son
postas rurales: no entran al directorio y pedir 464 puntos a un servicio
gratuito por algo que no se dibuja sería abusar de él.

Es **incremental**: relee `locations.json` y sólo pide lo que falta o lo que
quedó en `ciudad`. Respeta el límite de una petición por segundo.

Uso:
    python3 tools/geocode-bolivia-institutions.py
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DATOS = Path("data") / "bolivia-instituciones"
SALIDA = DATOS / "locations.json"
ESPERA = 1.1
AGENTE = "alovida-mockup/1.0 (geocodificación de instituciones de salud de Bolivia)"

# Centro de Santa Cruz de la Sierra y de La Paz, para el último recurso.
CENTROS = {
    "Santa Cruz de la Sierra": (-17.783327, -63.182140),
    "La Paz": (-16.495400, -68.133800),
}


def contexto_ssl() -> ssl.SSLContext:
    """Los certificados de `certifi`, si están; si no, los del sistema.

    Sin esto, un Python instalado desde python.org no trae CA y **toda** consulta
    falla con CERTIFICATE_VERIFY_FAILED. Pasó: la primera corrida devolvió 58 de
    58 en `ciudad` y parecía un problema de las direcciones.
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


CONTEXTO = contexto_ssl()


class ErrorDeRed(RuntimeError):
    """La consulta no llegó a Nominatim. NO es «no encontrado»."""


def pedir(parametros: dict[str, str]) -> dict | None:
    """El primer resultado, `None` si Nominatim no conoce la dirección.

    Un fallo de red levanta `ErrorDeRed` en vez de devolver `None`: si se
    tratara igual que «no encontrado», el guion caería al centro de la ciudad
    para todos y escribiría 58 puntos inventados con cara de éxito.
    """
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {**parametros, "format": "jsonv2", "limit": "1", "countrycodes": "bo"}
    )
    peticion = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    try:
        with urllib.request.urlopen(peticion, timeout=25, context=CONTEXTO) as respuesta:
            cuerpo = json.load(respuesta)
    except (urllib.error.URLError, ssl.SSLError, TimeoutError) as fallo:
        raise ErrorDeRed(str(fallo)) from fallo
    finally:
        time.sleep(ESPERA)
    return cuerpo[0] if cuerpo else None


def sin_numero(direccion: str) -> str:
    """«Av. Irala # 468 / Calle Chuquisaca # 737» → «Av. Irala»."""
    primera = re.split(r"[/,]", direccion)[0]
    return re.sub(r"\s*(#|N[º°]|No\.?)\s*[\d-]+.*$", "", primera).strip()


def ciudad_de(institucion: dict) -> str:
    return institucion.get("city") or "Santa Cruz de la Sierra"


def resolver(institucion: dict) -> dict | None:
    direccion = institucion.get("address")
    ciudad = ciudad_de(institucion)
    if direccion:
        hallazgo = pedir({"street": direccion, "city": ciudad, "country": "Bolivia"})
        if hallazgo:
            return {"lat": float(hallazgo["lat"]), "lng": float(hallazgo["lon"]),
                    "precision": "direccion"}
        via = sin_numero(direccion)
        if via and via != direccion:
            hallazgo = pedir({"street": via, "city": ciudad, "country": "Bolivia"})
            if hallazgo:
                return {"lat": float(hallazgo["lat"]), "lng": float(hallazgo["lon"]),
                        "precision": "via"}
    centro = CENTROS.get(ciudad)
    if centro:
        return {"lat": centro[0], "lng": centro[1], "precision": "ciudad"}
    return None


def main() -> int:
    ubicaciones = json.loads(SALIDA.read_text(encoding="utf-8")) if SALIDA.is_file() else {}
    instituciones: list[dict] = []
    for nombre in ("clinics", "hospitals", "insurers"):
        instituciones += json.loads((DATOS / f"{nombre}.json").read_text(encoding="utf-8"))

    pendientes = [
        i for i in instituciones
        if i["id"] not in ubicaciones or ubicaciones[i["id"]]["precision"] == "ciudad"
    ]
    print(f"  {len(instituciones)} instituciones · {len(pendientes)} por resolver")

    for numero, institucion in enumerate(pendientes, 1):
        try:
            punto = resolver(institucion)
        except ErrorDeRed as fallo:
            print(f"\n! No se pudo consultar Nominatim: {fallo}", file=sys.stderr)
            print("  No se escribe nada: un punto al centro de la ciudad para todos"
                  " sería un dato inventado.", file=sys.stderr)
            return 1
        if punto is None:
            print(f"    [{numero}/{len(pendientes)}] {institucion['name'][:42]} — sin punto")
            continue
        ubicaciones[institucion["id"]] = punto
        print(f"    [{numero}/{len(pendientes)}] {institucion['name'][:42]:44} {punto['precision']}")

    SALIDA.write_text(json.dumps(ubicaciones, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
                      encoding="utf-8")
    reparto: dict[str, int] = {}
    for punto in ubicaciones.values():
        reparto[punto["precision"]] = reparto.get(punto["precision"], 0) + 1
    print(f"\n  {len(ubicaciones)} puntos en {SALIDA}")
    for precision, cuantos in sorted(reparto.items(), key=lambda p: -p[1]):
        print(f"    {precision:10} {cuantos:>4}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
