"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@maza/ui/button";
import { Input } from "@maza/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maza/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@maza/ui/dialog";
import {
  createCampaign,
  deleteCampaign,
  toggleCampaignActive,
  uploadCampaignImage,
} from "@/app/(dashboard)/campanhas/actions";
import { formatDateBR } from "@/lib/format";
import type { CampaignWithBrand } from "@/lib/campanhas/types";
import type { BrandOption } from "@/lib/eventos/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const BUCKET = "campaign-images";

function publicUrl(path: string | null): string | null {
  if (!path || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

const CATEGORY_LABEL = {
  saude: "Saúde",
  evento: "Evento",
  comunicado: "Comunicado",
} as const;

const CATEGORY_COLOR = {
  saude: { bg: "rgba(34,197,94,0.16)", fg: "#15803D" },
  evento: { bg: "rgba(59,130,246,0.16)", fg: "#1D4ED8" },
  comunicado: { bg: "rgba(245,158,11,0.16)", fg: "#A16207" },
} as const;

export function CampanhasClient({
  campaigns,
  brands,
}: {
  campaigns: CampaignWithBrand[];
  brands: BrandOption[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (statusFilter === "active" && !c.active) return false;
      if (statusFilter === "inactive" && c.active) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (q && !c.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [campaigns, search, statusFilter, categoryFilter]);

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            placeholder="Buscar por título…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger style={{ width: 160 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v ?? "all")}
        >
          <SelectTrigger style={{ width: 160 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="saude">Saúde</SelectItem>
            <SelectItem value="evento">Evento</SelectItem>
            <SelectItem value="comunicado">Comunicado</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={14} className="mr-1" /> Nova campanha
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-3)",
            fontSize: 13,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          <Megaphone
            size={32}
            style={{ margin: "0 auto 12px", opacity: 0.4, display: "block" }}
          />
          Nenhuma campanha encontrada.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}

      <CampaignFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        brands={brands}
      />
    </>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignWithBrand }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cat = CATEGORY_COLOR[campaign.category];
  const img = publicUrl(campaign.image_url);

  const handleToggle = () => {
    startTransition(async () => {
      await toggleCampaignActive(campaign.id);
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!window.confirm(`Excluir campanha "${campaign.title}"?`)) return;
    startTransition(async () => {
      await deleteCampaign(campaign.id);
      router.refresh();
    });
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        opacity: campaign.active ? 1 : 0.55,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 9",
          background: "var(--surface-2)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-3)",
        }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={campaign.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <ImageIcon size={32} style={{ opacity: 0.3 }} />
        )}
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            padding: "3px 10px",
            borderRadius: 999,
            background: cat.bg,
            color: cat.fg,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {CATEGORY_LABEL[campaign.category]}
        </span>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: -0.2,
          }}
        >
          {campaign.title}
        </div>
        {campaign.description && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {campaign.description}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 11,
            color: "var(--text-3)",
            flexWrap: "wrap",
          }}
        >
          {campaign.brand_name && (
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: campaign.brand_color ?? "var(--brand)",
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              {campaign.brand_name}
            </span>
          )}
          <span>
            Target:{" "}
            <strong>
              {campaign.target === "department"
                ? `Depto: ${campaign.target_value ?? "?"}`
                : "Todos"}
            </strong>
          </span>
        </div>
        {(campaign.starts_at || campaign.ends_at) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--text-3)",
            }}
          >
            <Calendar size={12} />
            {campaign.starts_at ? formatDateBR(campaign.starts_at) : "—"}
            {" → "}
            {campaign.ends_at ? formatDateBR(campaign.ends_at) : "—"}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 4,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={handleToggle}
            disabled={pending}
            style={{
              ...BTN_GHOST,
              color: campaign.active ? "var(--text-2)" : "var(--brand)",
            }}
          >
            <Power size={12} />
            {campaign.active ? "Desativar" : "Ativar"}
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            style={{ ...BTN_GHOST, color: "var(--destructive)" }}
          >
            <Trash2 size={12} />
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignFormDialog({
  open,
  onOpenChange,
  brands,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brands: BrandOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [category, setCategory] = useState<"saude" | "evento" | "comunicado">(
    "comunicado",
  );
  const [target, setTarget] = useState<"all" | "department">("all");
  const [targetValue, setTargetValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setBrandId("");
    setCategory("comunicado");
    setTarget("all");
    setTargetValue("");
    setStartsAt("");
    setEndsAt("");
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setError(null);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Título obrigatório.");
      return;
    }
    if (target === "department" && !targetValue.trim()) {
      setError("Departamento obrigatório quando target='department'.");
      return;
    }
    setError(null);
    startTransition(async () => {
      // 1) Upload imagem (se houver) → path
      let imagePath: string | null = null;
      if (imageFile) {
        const u = await uploadCampaignImage(imageFile);
        if (!u.ok) {
          setError(`Erro no upload: ${u.error}`);
          return;
        }
        imagePath = u.data.path;
      }

      // 2) Create campaign
      const r = await createCampaign({
        title: title.trim(),
        description: description.trim() || null,
        brand_id: brandId || null,
        category,
        target,
        target_value: target === "department" ? targetValue.trim() : null,
        image_url: imagePath,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        active: true,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent style={{ maxWidth: 560 }}>
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
        </DialogHeader>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginTop: 8,
          }}
        >
          <Field label="Título *">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Ex: Campanha de vacinação 2026"
            />
          </Field>
          <Field label="Descrição">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o conteúdo da campanha…"
            />
          </Field>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="Marca (opcional)">
              <Select
                value={brandId || "all"}
                onValueChange={(v) => setBrandId(v === "all" ? "" : (v ?? ""))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as marcas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Categoria *">
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as typeof category)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saude">Saúde</SelectItem>
                  <SelectItem value="evento">Evento</SelectItem>
                  <SelectItem value="comunicado">Comunicado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: target === "department" ? "1fr 1fr" : "1fr",
              gap: 12,
            }}
          >
            <Field label="Direcionamento *">
              <Select
                value={target}
                onValueChange={(v) => setTarget(v as typeof target)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="department">Departamento</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {target === "department" && (
              <Field label="Departamento">
                <Input
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="Ex: COZINHA, SALAO"
                />
              </Field>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="Início">
              <Input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </Field>
            <Field label="Fim">
              <Input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Imagem (PNG/JPG até 5MB)">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              style={{
                fontSize: 12,
                color: "var(--text-3)",
                width: "100%",
              }}
            />
          </Field>
          {error && (
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 6,
                color: "var(--destructive)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              <X size={14} className="mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</label>
      {children}
    </div>
  );
}

const BTN_GHOST: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  fontSize: 11,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};
