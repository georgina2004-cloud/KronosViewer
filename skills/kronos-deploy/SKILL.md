---
name: kronos-deploy
description: Despliega un proyecto web creado en Claude (o en disco local) a Kronos Viewer. Actívala cuando el usuario diga "sube esto a Kronos", "despliega en Kronos", "manda este proyecto a mi plataforma", "publica esto en Kronos Viewer", o cualquier variante. Funciona con proyectos generados en el chat (Claude Design/Artifacts) y con carpetas locales. Lista los proyectos del usuario, pregunta a cuál subir y qué versión, y hace el deploy.
---

# Kronos Deploy

Despliega proyectos web en **Kronos Viewer** (https://kronos-viewer.vercel.app).

## Flujo principal — proyecto creado en Claude

Cuando el usuario acaba de crear un proyecto en el chat y pide subirlo a Kronos:

1. **Verifica el token**. Pregunta `KRONOS_TOKEN` si no está disponible. El usuario lo genera en `https://kronos-viewer.vercel.app/perfil`.

2. **Lista los proyectos** haciendo `GET /api/v1/proyectos` con `Authorization: Bearer <token>`. Muéstralos al usuario y pregunta a cuál subir. Si ninguno es el correcto, ofrece crear uno nuevo con `POST /api/v1/proyectos`.

3. **Pregunta solo el tag de versión** (ej. `v1.0.0`).

4. **Sube el proyecto** con `POST /api/v1/proyectos/{slug}/versiones` en multipart:
   - Campo `zip`: el ZIP del proyecto generado en el chat
   - Campo `versionTag`: el tag elegido

5. **Confirma** con la URL del visor devuelta por la API.

## Flujo alternativo — carpeta local

Si el usuario quiere subir una carpeta de su máquina, usa el script Python:

```bash
export KRONOS_TOKEN="kv_..."

# Listar proyectos
python3 '<ruta>/skills/kronos-deploy/scripts/kronos_deploy.py' list

# Desplegar carpeta
python3 '<ruta>/skills/kronos-deploy/scripts/kronos_deploy.py' deploy \
  --dir '<carpeta-del-proyecto>' \
  --slug <slug> \
  --version <tag>
```

La ruta del script es:
`/Users/kronosdev/Desktop/Kronoscode Projects/KronosViewer/skills/kronos-deploy/scripts/kronos_deploy.py`

El token activo es: `kv_16fd44cb0a0f523e93096deb5074a0ed19562cbb1d07e099`

## API

Todos los endpoints usan `Authorization: Bearer <KRONOS_TOKEN>`:

- `GET  /api/v1/proyectos` — lista proyectos del usuario
- `POST /api/v1/proyectos` — crea proyecto `{ nombre, descripcion }`
- `POST /api/v1/proyectos/{slug}/versiones` — sube versión (multipart: `zip` + `versionTag`)

Base URL: `https://kronos-viewer.vercel.app`