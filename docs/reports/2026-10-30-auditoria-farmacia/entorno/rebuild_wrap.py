# Corre rebuild_stack.main() con dos rodeos de esta VM, sin tocar archivos versionados:
# 1) saltea SOLO el gate de fuentes DDL (copia vendorizada de la API desfasada + un .sql
#    en tools/); la base se inicializa desde el SQL/ del modelo vía SQL_MODEL_DIR.
# 2) agrega un override de compose con los ulimits que este kernel permite.
import sys, os
sys.path.insert(0, "/home/user/mantra-core-health-model/salud-db")
import rebuild_stack
OVR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "compose.vm-override.yml")
rebuild_stack.revisar_fuentes_ddl = lambda: []
rebuild_stack.compose = lambda *a, capture=False: rebuild_stack.run(
    ["docker", "compose", "-f", str(rebuild_stack.COMPOSE_FILE), "-f", OVR, *a], capture)
sys.argv = ["rebuild_stack.py", "--yes"]
sys.exit(rebuild_stack.main())
