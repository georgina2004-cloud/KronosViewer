---
name: kronos-deploy
description: Despliega un prototipo o proyecto web (HTML estático, Vite, React, Next.js, Astro, etc.) en la plataforma Kronos Viewer como una nueva versión de un proyecto. Úsalo cuando el usuario pida "subir/desplegar/publicar este proyecto a Kronos", "mandar esto a Kronos Viewer", o mencione subir un prototipo a su plataforma de renderizado. Lista los proyectos del usuario, pregunta a cuál subir y con qué tag de versión, y hace el deploy.
---

# Kronos Deploy

Sube proyectos web a **Kronos Viewer** (https://kronos-viewer.vercel.app) como una
nueva versión de un proyecto existente. La plataforma compila automáticamente los
frameworks (Vite, CRA, Angular, Next.js, Astro, etc.) y sirve el resultado.

## Requisitos

1. **Token de acceso** (Personal Access Token). El usuario lo genera en
   `https://kronos-viewer.vercel.app/perfil` → "Tokens de acceso" → "Crear token".
   Debe exportarse como variable de entorno antes de usar el script:

   ```bash
   export KRONOS_TOKEN="kv_xxxxxxxxxxxxxxxx"
   ```

   Si el usuario no lo ha configurado, pídeselo y guárdalo en `KRONOS_TOKEN`.

2. **Python 3** (el script usa solo la librería estándar, sin dependencias).

## Flujo de trabajo

Cuando el usuario pida desplegar un proyecto a Kronos:

1. **Confirma el token**: verifica que `KRONOS_TOKEN` esté definido. Si no, pídelo.

2. **Lista los proyectos del usuario** para saber a cuál subir:

   ```bash
   python scripts/kronos_deploy.py list
   ```

   Muestra los proyectos (nombre + slug). Si el proyecto destino no existe,
   ofrece crearlo:

   ```bash
   python scripts/kronos_deploy.py create --name "Nombre del Proyecto"
   ```

3. **Pregunta el tag de versión** (ej. `v1.0.0`, `v2`, `2026-06-04`). No pidas el
   nombre del proyecto: ya está creado, solo se necesita el slug destino y la versión.

4. **Despliega** la carpeta del prototipo:

   ```bash
   python scripts/kronos_deploy.py deploy \
     --dir <carpeta-del-proyecto> \
     --slug <slug-del-proyecto> \
     --version <tag-de-version>
   ```

   El script empaqueta la carpeta en ZIP (excluyendo `node_modules`, `.git`,
   `dist`, `build`, etc.), la sube y devuelve la URL del visor.

5. **Confirma** al usuario con la URL del visor que imprime el comando.

## Notas

- La base de la API se puede sobrescribir con `KRONOS_BASE_URL` (por defecto la de
  producción). Útil para desarrollo local: `export KRONOS_BASE_URL=http://localhost:3000`.
- Para que se renderice, el proyecto debe tener un `index.html` en la raíz (sitios
  estáticos) o un script `build` que genere la salida (frameworks).
- El límite de subida por archivo es de ~100 MB; envía solo el código fuente, no
  binarios pesados ni `node_modules`.
- Endpoints usados (todos con `Authorization: Bearer <KRONOS_TOKEN>`):
  - `GET  /api/v1/proyectos` — lista proyectos.
  - `POST /api/v1/proyectos` — crea proyecto (`{ nombre, descripcion }`).
  - `POST /api/v1/proyectos/{slug}/versiones` — multipart `zip` + `versionTag`.
