# KronosViewer

Aplicación para desplegar y visualizar versiones de sitios estáticos empaquetados en `.zip`, usando Next.js (App Router), Tailwind CSS y Supabase.

## Requisitos

- Node.js 20+
- Proyecto en [Supabase](https://supabase.com) con Auth habilitado

## Instalación local

```bash
npm install
cp .env.example .env.local   # o crea .env.local manualmente
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Crea `.env.local` en la raíz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente y servidor Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth y consultas desde el navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: subida a Storage e inserción de versiones |

> **Importante:** `SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse al cliente.

## Configuración en Supabase

1. **SQL:** ejecuta `supabase/schema.sql` en el SQL Editor.
2. **Usuario:** crea un usuario en Authentication → Users (email/contraseña).
3. **Storage:** crea dos buckets:
   - `sitios-desplegados` — **público**
   - `respaldos-zips` — **privado**

## Flujo de uso

1. Inicia sesión en `/login`.
2. En `/dashboard`, crea un proyecto (el slug se autogenera).
3. En la ficha del proyecto, indica un tag (ej. `v1.0.0`) y sube un `.zip` con `index.html` en la raíz.
4. Cada versión queda en la línea de tiempo con enlace al sitio público y descarga del ZIP firmado.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |

## Estructura principal

```
app/
  api/upload/      POST — despliegue desde ZIP
  api/download/    GET — URL firmada del respaldo
  dashboard/       Panel de proyectos
  login/           Autenticación
  proyectos/[slug]/ Historial y carga de versiones
components/        UI reutilizable (Dropzone, modales, etc.)
lib/supabase/      Clientes browser, server, admin y middleware
middleware.ts      Protección de rutas autenticadas
```
