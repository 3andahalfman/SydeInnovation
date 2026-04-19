export interface Project {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  aps_urn: string | null;
  category: string | null;
  tech: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectInsert = Omit<Project, 'id' | 'created_at' | 'updated_at'>;
export type ProjectUpdate = Partial<ProjectInsert>;
