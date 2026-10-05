// Tipos do módulo Campanhas (HOS RH expansion).
//
// Migration 011-018 — comunicação interna do app mobile.

export type CampaignCategory = "saude" | "evento" | "comunicado";
export type CampaignTarget = "all" | "department";

export type Campaign = {
  id: string;
  brand_id: string | null;
  unit_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;        // path no bucket campaign-images
  category: CampaignCategory;
  target: CampaignTarget;
  target_value: string | null;     // se target='department', é o nome
  active: boolean;
  starts_at: string | null;        // DATE
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type CampaignInsert = {
  id?: string;
  brand_id?: string | null;
  unit_id?: string | null;
  title: string;
  description?: string | null;
  image_url?: string | null;
  category: CampaignCategory;
  target?: CampaignTarget;
  target_value?: string | null;
  active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_by?: string | null;
};

export type CampaignUpdate = Partial<Omit<CampaignInsert, "brand_id">>;

export type CampaignWithBrand = Campaign & {
  brand_name: string | null;
  brand_color: string | null;
};
