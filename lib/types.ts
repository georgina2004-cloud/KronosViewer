export type Proyecto = {
  id: string;
  user_id: string | null;
  nombre: string;
  slug: string;
  descripcion: string | null;
  fecha_creacion: string;
};

export type Version = {
  id: string;
  proyecto_id: string;
  version_tag: string;
  ruta_visor: string;
  ruta_zip_storage: string;
  fecha_subida: string;
};

export type ProyectoConVersiones = Proyecto & {
  versiones: Version[];
};
