"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  onGoogleLogin: () => Promise<void>;
}

type LoginMode = "login" | "signup" | "forgot";

export function LoginForm({ onGoogleLogin }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleModeChange = (newMode: LoginMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      setLoading(false);

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } else if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      setLoading(false);

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setSuccessMessage(
        "¡Registro completado! Verifica tu bandeja de entrada para confirmar tu correo."
      );
      setEmail("");
      setPassword("");
    } else if (mode === "forgot") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/perfil`,
        }
      );

      setLoading(false);

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccessMessage(
        "Se ha enviado un enlace de restauración de contraseña a tu correo."
      );
      setEmail("");
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-zinc-50">
      {/* Panel Izquierdo: Visual y abstracta */}
      <div className="relative hidden w-1/2 flex-col justify-between p-12 text-white lg:flex overflow-hidden">
        {/* Imagen de fondo generada con IA */}
        <img
          src="/login_background.png"
          alt="Abstract geometric background"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-950/60 to-zinc-950/40 mix-blend-multiply" />

        {/* Header del Panel Izquierdo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-md">
              KV
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              Kronos<span className="text-indigo-400">Viewer</span>
            </span>
          </div>
          <Link
            href="/"
            className="text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-1"
          >
            ← Volver al sitio
          </Link>
        </div>

        {/* Textos y Eslogan */}
        <div className="relative z-10 space-y-4">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Visualiza rápido.<br />
            Comparte fácil.<br />
            Despliega en segundos.
          </h2>
          <p className="text-zinc-300 max-w-md text-sm leading-relaxed">
            Sube tus compilados estáticos y previsualiza tus prototipos interactivos al instante. La forma más rápida de validar diseños y compartir tu progreso con el equipo.
          </p>
        </div>
      </div>

      {/* Panel Derecho: Formulario de Login */}
      <div className="flex w-full items-center justify-center p-6 sm:p-12 lg:w-1/2 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Logo para dispositivos móviles */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-md">
              KV
            </span>
            <span className="text-xl font-bold tracking-tight text-zinc-900">
              Kronos<span className="text-indigo-600">Viewer</span>
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              {mode === "login" && "¡Te damos la bienvenida!"}
              {mode === "signup" && "Crea tu cuenta"}
              {mode === "forgot" && "Restablecer contraseña"}
            </h1>
            <p className="text-sm text-zinc-500">
              {mode === "login" && "Inicia sesión para gestionar y visualizar tus proyectos."}
              {mode === "signup" && "Registra tus datos para empezar a subir prototipos."}
              {mode === "forgot" && "Introduce tu correo electrónico para recibir un enlace de recuperación."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-indigo-500/20 focus:border-indigo-500 focus:ring-4 transition-all placeholder:text-zinc-400"
                placeholder="tu@empresa.com"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-zinc-700"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-indigo-500/20 focus:border-indigo-500 focus:ring-4 transition-all placeholder:text-zinc-400"
                  placeholder="••••••••"
                />
              </div>
            )}

            {mode === "login" && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-600 hover:text-zinc-900 select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Recordarme
                </label>
                <button
                  type="button"
                  onClick={() => handleModeChange("forgot")}
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            {successMessage && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200">
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-zinc-950 py-3 text-sm font-semibold text-white hover:bg-zinc-800 active:bg-zinc-950 transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
            >
              {loading && "Procesando…"}
              {!loading && mode === "login" && "Iniciar sesión"}
              {!loading && mode === "signup" && "Registrarse"}
              {!loading && mode === "forgot" && "Enviar enlace"}
            </button>

            {mode !== "forgot" && (
              <>
                <div className="relative my-6 flex items-center justify-center">
                  <div className="absolute w-full border-t border-zinc-200"></div>
                  <span className="relative bg-white px-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    O continuar con
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 active:bg-white outline-none transition-all disabled:opacity-60 shadow-sm cursor-pointer"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </button>
              </>
            )}
          </form>

          <div className="text-center text-xs">
            {mode === "login" && (
              <p className="text-zinc-500">
                ¿No tienes una cuenta?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("signup")}
                  className="font-semibold text-zinc-700 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  Regístrate aquí
                </button>
              </p>
            )}
            {mode === "signup" && (
              <p className="text-zinc-500">
                ¿Ya tienes una cuenta?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  className="font-semibold text-zinc-700 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  Inicia sesión
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <p className="text-zinc-500">
                ¿Recordaste tu contraseña?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  className="font-semibold text-zinc-700 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  Inicia sesión
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}