#!/usr/bin/env python3
"""Receptor del webhook de GitHub que dispara un redespliegue del front.

## Por qué existe

El redespliegue ya lo hace un temporizador de systemd que sondea `dev` cada dos
minutos (`alovida-redeploy.timer`). Eso funciona, pero deja hasta dos minutos de
espera entre el `git push` y el despliegue, y consulta el remoto ~720 veces al
día para descubrir que casi siempre no hay nada nuevo. El webhook invierte la
carga: GitHub avisa, y el despliegue empieza en el acto.

**El temporizador NO se retira.** Es la red de seguridad: si el webhook no llega
—GitHub caído, la máquina apagada en ese momento, el túnel reiniciándose— la
siguiente pasada del temporizador recoge el commit igual. El webhook adelanta el
despliegue; no es de quien depende que ocurra.

## Cómo autentica

Con la firma HMAC-SHA256 que GitHub manda en `X-Hub-Signature-256`, calculada
sobre el cuerpo crudo con el secreto compartido. No con un token en la URL: una
URL viaja en logs de proxy, en el historial del navegador y en el propio panel
de GitHub, y este endpoint está expuesto a internet por el Funnel de Tailscale.

La comparación es `hmac.compare_digest`, que tarda lo mismo acierte o falle: un
`==` normal se rinde en el primer byte distinto y con suficientes intentos
filtra la firma byte a byte.

## Qué NO hace

No construye nada por su cuenta ni conoce el despliegue: sólo arranca
`alovida-redeploy.service`, la misma unidad `oneshot` que dispara el
temporizador. Así el webhook y el temporizador comparten exactamente un camino,
y el cerrojo de `redeploy.sh` impide que dos pasadas se solapen.

## Uso

    REDEPLOY_WEBHOOK_SECRET=... webhook.py [puerto]

En GitHub: Settings → Webhooks → Add webhook, `application/json`, sólo el evento
`push`, y el mismo secreto.
"""

import hashlib
import hmac
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRETO = os.environ.get("REDEPLOY_WEBHOOK_SECRET", "")
RAMA = os.environ.get("REDEPLOY_RAMA", "dev")
UNIDAD = os.environ.get("REDEPLOY_UNIDAD", "alovida-redeploy.service")
# Cuerpo máximo. Un `push` de GitHub ronda los 20 KB; el tope evita que alguien
# nos haga leer megabytes antes siquiera de comprobar la firma.
MAX = 1 << 20


def firma_valida(secreto: str, cuerpo: bytes, cabecera: str) -> bool:
    if not cabecera.startswith("sha256="):
        return False
    esperada = hmac.new(secreto.encode(), cuerpo, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperada, cabecera[len("sha256=") :])


class Receptor(BaseHTTPRequestHandler):
    server_version = "alovida-redeploy-webhook"

    def _responder(self, codigo: int, texto: str) -> None:
        cuerpo = (texto + "\n").encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    # El log por defecto escribe en stderr una línea por petición con la IP; se
    # deja, va al journal de la unidad y es lo que permite ver intentos fallidos.
    def log_message(self, formato: str, *args) -> None:
        sys.stderr.write("%s %s\n" % (self.address_string(), formato % args))

    def do_GET(self) -> None:
        # Sonda de vida, sin secreto: no dice nada que no se sepa por el nombre.
        if self.path.rstrip("/") in ("/salud", "/health"):
            self._responder(200, "ok")
        else:
            self._responder(404, "no")

    def do_POST(self) -> None:
        try:
            largo = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._responder(400, "Content-Length inválido")
            return
        if largo <= 0 or largo > MAX:
            self._responder(413, "cuerpo fuera de rango")
            return

        cuerpo = self.rfile.read(largo)

        if not firma_valida(SECRETO, cuerpo, self.headers.get("X-Hub-Signature-256", "")):
            # Sin detalles: a quien no acierta la firma no se le explica por qué.
            self._responder(401, "firma inválida")
            return

        evento = self.headers.get("X-GitHub-Event", "")
        if evento == "ping":
            self._responder(200, "pong")
            return
        if evento != "push":
            self._responder(202, f"ignorado: evento {evento}")
            return

        try:
            datos = json.loads(cuerpo)
        except json.JSONDecodeError:
            self._responder(400, "json inválido")
            return

        ref = datos.get("ref", "")
        if ref != f"refs/heads/{RAMA}":
            # Una rama que no es la que se sirve no dispara nada, y se contesta
            # 200 igual: para GitHub la entrega fue correcta.
            self._responder(200, f"ignorado: {ref} no es {RAMA}")
            return

        # `--no-block` para contestar YA. Una construcción pasa de los diez
        # minutos y GitHub corta la entrega a los diez segundos: esperar aquí
        # marcaría el webhook como fallido y provocaría reintentos.
        try:
            arranque = subprocess.run(
                ["systemctl", "--user", "start", "--no-block", UNIDAD],
                capture_output=True,
                text=True,
                timeout=15,
            )
        except (OSError, subprocess.SubprocessError) as error:
            # `systemctl` ausente o colgado. Sin capturarlo, la excepción sube y
            # se lleva el hilo de la petición: el receptor queda vivo pero esa
            # entrega muere sin respuesta y GitHub la reintenta contra un
            # endpoint que va a fallar igual.
            sys.stderr.write(f"no pude invocar systemctl: {error}\n")
            self._responder(500, "no pude arrancar el redespliegue")
            return
        if arranque.returncode != 0:
            sys.stderr.write(f"no pude arrancar {UNIDAD}: {arranque.stderr.strip()}\n")
            self._responder(500, "no pude arrancar el redespliegue")
            return

        commit = (datos.get("after") or "")[:7]
        sys.stderr.write(f"redespliegue disparado por {commit or '?'} en {RAMA}\n")
        self._responder(202, f"redespliegue disparado ({commit})")


def main() -> int:
    if not SECRETO:
        sys.stderr.write("Falta REDEPLOY_WEBHOOK_SECRET; sin secreto no se arranca.\n")
        return 2
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("REDEPLOY_WEBHOOK_PUERTO", "9099"))
    # Sólo loopback: quien lo publica hacia fuera es el Funnel de Tailscale, que
    # además pone el TLS. Escuchar en 0.0.0.0 lo dejaría accesible en la red
    # local sin cifrar y sin que nadie lo hubiera pedido.
    servidor = HTTPServer(("127.0.0.1", puerto), Receptor)
    sys.stderr.write(f"escuchando en 127.0.0.1:{puerto}, rama {RAMA} -> {UNIDAD}\n")
    servidor.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
