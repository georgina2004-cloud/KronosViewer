"use client";

import { useState, useEffect, FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Proyecto {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  fecha_creacion: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Estados para el formulario de nuevo proyecto
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estados para la carga del ZIP
  const [selectedProyectoId, setSelectedProyectoId] = useState("");
  const [versionTag, setVersionTag] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    cargarProyectos();
  }, []);

  const cargarProyectos = async () => {
    try {
      const { data, error } = await supabase
        .from("proyectos")
        .select("*")
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      setProyectos(data || []);
      if (data && data.length > 0) setSelectedProyectoId(data[0].id);
    } catch (error: any) {
      console.error("Error al cargar proyectos:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProyecto = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreating(true);

    const slug = nombre
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    try {
      const { error } = await supabase
        .from("proyectos")
        .insert([{ nombre: nombre.trim(), slug, descripcion: descripcion.trim() }]);

      if (error) throw error;

      setNombre("");
      setDescripcion("");
      setShowModal(false);
      await cargarProyectos();
    } catch (error: any) {
      setFormError(error.message || "Error al crear el proyecto. Quizá el nombre ya existe.");
    } finally {
      setCreating(false);
    }
  };

  const handleZipUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProyectoId || !versionTag || !zipFile) {
      setUploadMessage({ type: "error", text: "Por favor, completa todos los campos del formulario." });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append("proyectoId", selectedProyectoId);
    formData.append("versionTag", versionTag.trim());
    formData.append("file", zipFile);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error desconocido al procesar el archivo.");
      }

      setUploadMessage({ type: "success", text: "¡Versión desplegada y respaldada con éxito!" });
      setVersionTag("");
      setZipFile(null);
      // Limpiar el input file nativo
      const fileInput = document.getElementById("zip-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error: any) {
      setUploadMessage({ type: "error", text: error.message || "Error de red al intentar subir el archivo." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="text-zinc-900">
      <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* PANEL IZQUIERDO: CARGAR NUEVA MAQUETA ZIP */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm h-fit">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Desplegar Maqueta HTML</h2>
          
          {proyectos.length === 0 ? (
            <p className="text-sm text-zinc-500">Debes crear al menos un proyecto antes de poder subir una maqueta ZIP.</p>
          ) : (
            <form onSubmit={handleZipUpload} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Seleccionar Proyecto</label>
                <select
                  value={selectedProyectoId}
                  onChange={(e) => setSelectedProyectoId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                >
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tag de Versión (Ej: v1.0.0)</label>
                <input
                  type="text"
                  required
                  placeholder="v1.0.0"
                  value={versionTag}
                  onChange={(e) => setVersionTag(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Archivo Maqueta (.zip)</label>
                <input
                  id="zip-input"
                  type="file"
                  required
                  accept=".zip"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              {uploadMessage && (
                <p className={`rounded-lg px-3 py-2 text-sm ${uploadMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {uploadMessage.text}
                </p>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {uploading ? "Procesando y Desplegando..." : "Subir y Renderizar Maqueta"}
              </button>
            </form>
          )}
        </div>

        {/* PANEL DERECHO: LISTADO DE PROYECTOS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900">Proyectos Activos</h2>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Nuevo Proyecto
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-sm text-zinc-500">Cargando proyectos...</div>
          ) : proyectos.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500">
              No hay proyectos creados todavía. ¡Crea el primero para empezar!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {proyectos.map((proyecto) => (
                <div
                  key={proyecto.id}
                  onClick={() => router.push(`/proyectos/${proyecto.slug}`)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md cursor-pointer transition-all"
                >
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                      {proyecto.nombre}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400 font-mono">/{proyecto.slug}</p>
                    <p className="mt-3 text-sm text-zinc-500 line-clamp-2">{proyecto.descripcion || "Sin descripción disponible."}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
                    <span>{new Date(proyecto.fecha_creacion).toLocaleDateString()}</span>
                    <span className="font-medium text-indigo-600 group-hover:underline">Ver historial →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREAR PROYECTO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">Crear Nuevo Proyecto</h3>
            
            <form onSubmit={handleCreateProyecto} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Nombre del Proyecto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cliente BCM Baking"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Descripción (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Breve descripción técnica o detalles del cliente..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              {formError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(null); }}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {creating ? "Creando..." : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}