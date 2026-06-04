#!/usr/bin/env python3
from __future__ import annotations
import argparse, io, json, os, sys, uuid, zipfile, urllib.request, urllib.error

DEFAULT_BASE_URL = "https://kronos-viewer.vercel.app"
MIN_ZIP_DATE = (1980, 1, 1, 0, 0, 0)
SKIP_DIRS = {"node_modules", ".git", ".next", ".cache", "__MACOSX", ".turbo", ".vercel", "dist", "build", "out", ".svelte-kit", ".output", ".parcel-cache"}

def base_url(): return os.environ.get("KRONOS_BASE_URL", DEFAULT_BASE_URL).rstrip("/")

def token():
    tok = os.environ.get("KRONOS_TOKEN", "").strip()
    if not tok: sys.exit("ERROR: define KRONOS_TOKEN")
    return tok

def _request(method, path, *, data=None, content_type=None):
    url = f"{base_url()}{path}"
    headers = {"Authorization": f"Bearer {token()}"}
    if content_type: headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        try: detail = json.loads(detail).get("error", detail)
        except: pass
        sys.exit(f"ERROR {e.code}: {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"ERROR de red: {e.reason}")

def list_projects(): return _request("GET", "/api/v1/proyectos").get("proyectos", [])

def create_project(name, desc=""):
    payload = json.dumps({"nombre": name, "descripcion": desc}).encode()
    return _request("POST", "/api/v1/proyectos", data=payload, content_type="application/json").get("proyecto", {})

def zip_directory(directory):
    directory = os.path.abspath(directory)
    if not os.path.isdir(directory): sys.exit(f"ERROR: directorio no existe: {directory}")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(directory):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for fname in files:
                abspath = os.path.join(root, fname)
                relpath = os.path.relpath(abspath, directory)
                try:
                    zinfo = zipfile.ZipInfo.from_file(abspath, relpath)
                    if zinfo.date_time < MIN_ZIP_DATE:
                        zinfo.date_time = MIN_ZIP_DATE
                    with open(abspath, "rb") as f:
                        zf.writestr(zinfo, f.read())
                except Exception as e:
                    print(f"  Saltando {relpath}: {e}", file=sys.stderr)
    return buffer.getvalue()

def _multipart(version_tag, zip_bytes):
    boundary = f"----kronos{uuid.uuid4().hex}"
    crlf = b"\r\n"
    parts = []
    parts.append(f"--{boundary}".encode())
    parts.append(b'Content-Disposition: form-data; name="versionTag"')
    parts.append(b"")
    parts.append(version_tag.encode())
    parts.append(f"--{boundary}".encode())
    parts.append(b'Content-Disposition: form-data; name="zip"; filename="proyecto.zip"')
    parts.append(b"Content-Type: application/zip")
    parts.append(b"")
    body = crlf.join(parts) + crlf + zip_bytes + crlf
    body += f"--{boundary}--".encode() + crlf
    return body, f"multipart/form-data; boundary={boundary}"

def deploy(slug, version, directory):
    zip_bytes = zip_directory(directory)
    size_mb = len(zip_bytes) / (1024 * 1024)
    print(f"ZIP generado: {size_mb:.2f} MB", file=sys.stderr)
    body, ct = _multipart(version, zip_bytes)
    return _request("POST", f"/api/v1/proyectos/{slug}/versiones", data=body, content_type=ct)

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    p_create = sub.add_parser("create")
    p_create.add_argument("--name", required=True)
    p_create.add_argument("--desc", default="")
    p_deploy = sub.add_parser("deploy")
    p_deploy.add_argument("--dir", required=True)
    p_deploy.add_argument("--slug", required=True)
    p_deploy.add_argument("--version", required=True)
    args = parser.parse_args()
    if args.cmd == "list":
        projects = list_projects()
        if not projects: print("No hay proyectos.")
        for p in projects: print(f"- {p['nombre']}  (slug: {p['slug']})")
    elif args.cmd == "create":
        p = create_project(args.name, args.desc)
        print(f"Proyecto creado: {p.get('nombre')} (slug: {p.get('slug')})")
    elif args.cmd == "deploy":
        result = deploy(args.slug, args.version, args.dir)
        print("Desplegado correctamente.")
        print(f"URL del visor: {result.get('url')}")

if __name__ == "__main__":
    main()