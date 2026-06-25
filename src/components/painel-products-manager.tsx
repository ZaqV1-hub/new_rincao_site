"use client";

import { CurrencyInput } from "@/components/currency-input";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PainelModal } from "@/components/painel-modal";
import {
  getB2cBoxOfficePrice,
  getB2cSitePrice,
  type B2cProduct,
  type B2cProductType,
} from "@/lib/b2c-catalog-defaults";

type EditState = {
  type: B2cProductType;
  product: B2cProduct | null;
};

function formatCurrency(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function CurrentImagePreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="grid gap-2">
      <p className="text-[13px] font-semibold text-[#17351f]">Imagem atual</p>
      <div className="overflow-hidden rounded-[8px] border border-[#dbe7d7] bg-[#eef3e8]">
        <img
          src={src}
          alt={alt}
          className="block h-40 w-full object-cover"
          loading="lazy"
        />
      </div>
      <p className="text-xs font-medium text-[#6a806e]">
        O navegador não reabre esse campo com um arquivo já selecionado. Para
        trocar a imagem, escolha um novo arquivo abaixo.
      </p>
    </div>
  );
}

function ImageInput() {
  return (
    <label className="grid gap-1.5 text-[13px] font-semibold text-[#17351f]">
      Imagem
      <input
        name="image"
        type="file"
        accept="image/*"
        className="rounded-[8px] border border-dashed border-[#9bbd91] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#17342d] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
      />
    </label>
  );
}

export function PainelProductsManager({ products }: { products: B2cProduct[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<B2cProduct | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passports = products.filter((product) => product.type === "passport");
  const addons = products.filter((product) => product.type === "addon");

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/painel/products", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível salvar.");
      }

      setEditing(null);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar.",
      );
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/painel/products", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível excluir.");
      }

      setDeleteTarget(null);
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ProductSection
        eyebrow="Passaportes"
        title="Produtos principais"
        products={passports}
        onCreate={() => setEditing({ type: "passport", product: null })}
        onEdit={(product) => setEditing({ type: product.type, product })}
        onDelete={setDeleteTarget}
      />
      <ProductSection
        eyebrow="Itens adicionais"
        title="Complementos"
        products={addons}
        onCreate={() => setEditing({ type: "addon", product: null })}
        onEdit={(product) => setEditing({ type: product.type, product })}
        onDelete={setDeleteTarget}
      />

      <PainelModal
        title={editing?.product ? "Editar produto" : "Adicionar produto"}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <form onSubmit={submitForm} className="grid gap-3">
            <input type="hidden" name="type" value={editing.type} />
            {editing.product ? (
              <input type="hidden" name="id" value={editing.product.id} />
            ) : null}
            <Field label="Título">
              <input
                name="title"
                defaultValue={editing.product?.title ?? ""}
                className="rounded-[8px] border border-[#dbe7d7] px-3 py-2.5"
              />
            </Field>
            <Field label="Subtítulo">
              <input
                name="subtitle"
                defaultValue={editing.product?.subtitle ?? ""}
                className="rounded-[8px] border border-[#dbe7d7] px-3 py-2.5"
              />
            </Field>
            <Field label="Descrição">
              <textarea
                name="description"
                defaultValue={editing.product?.description ?? ""}
                rows={4}
                className="rounded-[8px] border border-[#dbe7d7] px-3 py-2.5"
              />
            </Field>
            {editing.product?.imageSrc ? (
              <CurrentImagePreview
                src={editing.product.imageSrc}
                alt={editing.product.title}
              />
            ) : null}
            <ImageInput />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Valor no site">
                <CurrencyInput
                  key={`product-price-${editing.product?.id ?? "new"}-${editing.type}`}
                  name="sitePrice"
                  defaultValue={getB2cSitePrice(editing.product ?? { sitePrice: "", fixedPrice: "" })}
                  placeholder="100,00"
                  className="rounded-[8px] border border-[#dbe7d7] px-3 py-2.5"
                />
              </Field>
              {editing.type === "passport" ? (
                <Field label="Valor na bilheteria">
                  <CurrencyInput
                    key={`product-box-office-${editing.product?.id ?? "new"}-${editing.type}`}
                    name="boxOfficePrice"
                    defaultValue={getB2cBoxOfficePrice(
                      editing.product ?? { sitePrice: "", boxOfficePrice: "", fixedPrice: "" },
                    )}
                    placeholder="100,00"
                    className="rounded-[8px] border border-[#dbe7d7] px-3 py-2.5"
                  />
                </Field>
              ) : null}
              {editing.type !== "passport" ? (
                <input
                  type="hidden"
                  name="boxOfficePrice"
                  value={getB2cSitePrice(editing.product ?? { sitePrice: "", fixedPrice: "" })}
                />
              ) : null}
              <Field label="Ordem">
                <input
                  name="sortOrder"
                  type="number"
                  min="1"
                  defaultValue={editing.product?.sortOrder ?? ""}
                  className="rounded-[8px] border border-[#dbe7d7] px-3 py-2.5"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#17351f]">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing.product?.active ?? true}
              />
              Ativo
            </label>
            {error ? (
              <p className="rounded-[8px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
                {error}
              </p>
            ) : null}
            <button
              disabled={pending}
              className="rounded-[8px] bg-[#17342d] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Salvar"}
            </button>
          </form>
        ) : null}
      </PainelModal>

      <PainelModal
        title="Confirmar exclusão"
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      >
        <p className="text-sm leading-6 text-[#5f7564]">
          Excluir <strong>{deleteTarget?.title}</strong>?
        </p>
        {error ? (
          <p className="mt-3 rounded-[8px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-[8px] bg-[#b24239] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Excluindo..." : "Excluir"}
          </button>
          <button
            onClick={() => setDeleteTarget(null)}
            className="rounded-[8px] border border-[#dbe7d7] px-4 py-2.5 text-sm font-semibold text-[#17351f]"
          >
            Cancelar
          </button>
        </div>
      </PainelModal>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[13px] font-semibold text-[#17351f]">
      {label}
      {children}
    </label>
  );
}

function ProductSection({
  eyebrow,
  title,
  products,
  onCreate,
  onEdit,
  onDelete,
}: {
  eyebrow: string;
  title: string;
  products: B2cProduct[];
  onCreate: () => void;
  onEdit: (product: B2cProduct) => void;
  onDelete: (product: B2cProduct) => void;
}) {
  return (
    <section className="panel-section p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="panel-eyebrow">{eyebrow}</p>
          <h3 className="mt-1 text-[20px] font-black text-[#17351f]">
            {title}
          </h3>
        </div>
        <button
          onClick={onCreate}
          className="rounded-[8px] bg-[#17342d] px-3 py-2 text-xs font-semibold text-white"
        >
          {eyebrow === "Passaportes" ? "Adicionar passaporte" : "Adicionar item"}
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article
            key={product.id}
            className="overflow-hidden rounded-[10px] border border-[#dbe7d7] bg-white"
          >
            <div className="relative h-28 bg-[#eef3e8]">
              <Image
                src={product.imageSrc}
                alt={product.title}
                fill
                className="object-cover"
                sizes="320px"
              />
            </div>
            <div className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-black text-[#17351f]">
                    {product.title}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#5f7564]">
                    {product.subtitle}
                  </p>
                </div>
                <strong className="text-sm text-[#17351f]">
                  {formatCurrency(getB2cSitePrice(product))}
                </strong>
              </div>
              {product.type === "passport" ? (
                <p className="mt-2 text-xs font-semibold text-[#5f7564]">
                  Bilheteria {formatCurrency(getB2cBoxOfficePrice(product))}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onEdit(product)}
                  className="rounded-[8px] border border-[#dbe7d7] px-2.5 py-1.5 text-xs font-semibold text-[#17351f]"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(product)}
                  className="rounded-[8px] border border-[#f0c3bc] px-2.5 py-1.5 text-xs font-semibold text-[#a33b31]"
                >
                  Excluir
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
