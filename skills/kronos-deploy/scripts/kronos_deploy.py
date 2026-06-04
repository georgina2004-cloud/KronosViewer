#!/usr/bin/env python3
"""CLI para desplegar prototipos en Kronos Viewer.

Usa la API REST v1 de Kronos Viewer autenticada con un Personal Access Token.

Variables de entorno:
  KRONOS_TOKEN     Token de acceso (obligatorio). Se genera en /perfil.
  KRONOS_BASE_URL  Base de la plataforma. Por defecto la de producción.

Ejemplos:
  python kronos_deploy.py list
  python kronos_deploy.py create --name "Cimedi"
  python kronos_deploy.py deploy --dir ./mi-proyecto --slug cimedi --version v1.0.0
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import uuid
import zipfile
import urllib.request
import urllib.error

DEFAULT_BASE_URL = "https://kronos-viewer.vercel.app"

# Carpetas/archivos que no se deben incluir en el ZIP (pesan y no se despliegan).
SKIP_DIRS = {
    "node_modules", ".git", ".next", ".cache", "__MACOSX",
    ".turbo", ".vercel", "dist", "build", "out", ".svelte-kit",
    ".output", ".parcel-cache",
}


def base_url() -> str:
    return os.environ.get("KRONOS_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def token() -> str:
    tok = os.environ.get("KRONOS_TOKEN", "").strip()
    if not tok:
        sys.exit(
            "ERROR: define la variable de entorno KRONOS_TOKEN "
            "(crea un token en /perfil de Kronos Viewer)."
        )
    return tok


def _request(method: str, path: str, *, data: bytes | None = None,
             content_type: str | None = None) -> dict:
    url = f"{base_url()}{path}"
    headers = {"Authorization": f"Bearer {token()}"}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail).get("error", detail)
        except Exception:
            pass
        sys.exit(f"ERROR {e.code}: {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"ERROR de red: {e.reason}")


def list_projects() -> list[dict]:
    return _request("GET", "/api/v1/proyectos").get("proyectos", [])


def create_project(name: str, descripcion: str = "") -> dict:
    payload = json.dumps({"nombre": name, "descripcion": descripcion}).encode()
    return _request(
        "POST", "/api/v1/proyectos",
        data=payload, content_type="application/json",
    ).get("proyecto", {})


def zip_directory(directory: str) -> bytes:
    directory = os.path.abspath(directory)
    if not os.path.isdir(directory):
        sys.exit(f"ERROR: el directorio no existe: {directory}")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(directory):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for fname in files:
                abspath = os.path.join(root, fname)
                relpath = os.path.relpath(abspath, directory)
                zf.write(abspath, relpath)
    return buffer.getvalue()


def _multipart(version_tag: str, zip_bytes: bytes) -> tuple[bytes, str]:
    boundary = f"----kronos{uuid.uuid4().hex}"
    crlf = b"\r\n"
    parts: list[bytes] = []

    parts.append(f"--{boundary}".encode())
    parts.append(b'Content-Disposition: form-data; name="versionTag"')
    parts.append(b"")
    parts.append(version_tag.encode())

    parts.append(f"--{boundary}".encode())
    parts.append(
        b'Content-Disposition: form-data; name="zip"; filename="proyecto.zip"'
    )
    parts.append(b"Content-Type: application/zip")
    parts.append(b"")
    body = crlf.join(parts) + crlf + zip_bytes + crlf
    body += f"--{boundary}--".encode() + crlf
    return body, f"multipart/form-data; boundary={boundary}"


def deploy(slug: str, version: str, directory: str) -> dict:
    zip_bytes = zip_directory(directory)
    size_mb = len(zip_bytes) / (1024 * 1024)
    print(f"ZIP generado: {size_mb:.1f} MB", file=sys.stderr)
    body, content_type = _multipart(version, zip_bytes)
    return _request(
        "POST", f"/api/v1/proyectos/{slug}/versiones",
        data=body, content_type=content_type,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Desplegar prototipos en Kronos Viewer")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="Listar tus proyectos")

    p_create = sub.add_parser("create", help="Crear un proyecto")
    p_create.add_argument("--name", required=True)
    p_create.add_argument("--desc", default="")

    p_deploy = sub.add_parser("deploy", help="Subir una versión a un proyecto")
    p_deploy.add_argument("--dir", required=True, help="Carpeta del prototipo")
    p_deploy.add_argument("--slug", required=True, help="Slug del proyecto destino")
    p_deploy.add_argument("--version", required=True, help="Tag de versión (ej. v1.0.0)")

    args = parser.parse_args()

    if args.cmd == "list":
        projects = list_projects()
        if not projects:
            print("No tienes proyectos. Crea uno con: create --name ...")
            return
        for p in projects:
            print(f"- {p['nombre']}  (slug: {p['slug']})")
    elif args.cmd == "create":
        p = create_project(args.name, args.desc)
        print(f"Proyecto creado: {p.get('nombre')} (slug: {p.get('slug')})")
    elif args.cmd == "deploy":
        result = deploy(args.slug, args.version, args.dir)
        print("Desplegado correctamente.")
        print(f"URL del visor: {result.get('url')}")


if __name__ == "__main__":
    main()
