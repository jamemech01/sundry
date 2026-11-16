"use client";

import Image from "next/image";

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number | string;
  stock: number;
  imageData?: string | null;
};

type CartItem = { productId: number; quantity: number };

type ProductCardProps = {
  product: Product;
  cartItem: CartItem | undefined;
  isOwner: boolean;
  busy: boolean;
  authLoading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onImageChange: (product: Product, file: File) => void;
  onAddToCart: (product: Product) => void;
  onChangeQuantity: (product: Product, quantity: number) => void;
};

function ProductImageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 20" />
    </svg>
  );
}

function EditProductImageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 20m11-1 4-4m-2-2 2 2" />
    </svg>
  );
}

export default function ProductCard({
  product,
  cartItem,
  isOwner,
  busy,
  authLoading,
  onImageChange,
  onEdit,
  onDelete,
  onChangeQuantity,
  onAddToCart,
}: ProductCardProps) {
  const quantity = cartItem?.quantity ?? 0;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition duration-200 hover:border-blue-200 hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {product.imageData ? (
          <Image
            src={product.imageData}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 300px"
            unoptimized
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            role="img"
            aria-label="No product image"
            className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300"
          >
            <ProductImageIcon />
          </div>
        )}

        {product.stock < 1 && (
          <span className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-medium text-gray-600 sm:bottom-3 sm:left-3 sm:text-xs">
            Out of stock
          </span>
        )}

        {isOwner && (
          <label
            aria-label={`Change image for ${product.name}`}
            title="Change product image"
            className="absolute bottom-2 right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white/95 text-gray-700 shadow-sm transition hover:bg-white has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 sm:bottom-3 sm:right-3"
          >
            <EditProductImageIcon />
            <input
              type="file"
              accept="image/*"
              disabled={busy || authLoading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  onImageChange(product, file);
                }
                event.currentTarget.value = "";
              }}
              className="sr-only"
            />
          </label>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h2 className="card-title line-clamp-2 min-h-12">{product.name}</h2>
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-base font-semibold tabular-nums text-blue-700">
            ฿
            {Number(product.price).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-gray-500">
            Stock: {product.stock.toLocaleString("en-US")}
          </p>
          <p className="truncate text-xs font-medium text-gray-500">
            {product.category || "Other"}
          </p>
        </div>

        <div className="mt-auto pt-3">
          {isOwner ? (
            <div className="flex justify-end gap-1 border-t border-gray-100 pt-2">
              <button
                type="button"
                disabled={busy}
                aria-label={`Edit ${product.name}`}
                title="Edit product"
                onClick={() => onEdit(product)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M12 20h9" />
                  <path d="m16.5 3.5 4 4L8 20H4v-4Z" />
                </svg>
              </button>

              <button
                type="button"
                disabled={busy}
                aria-label={`Delete ${product.name}`}
                title="Delete product"
                onClick={() => onDelete(product)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex justify-end gap-1 border-t border-gray-100 pt-2">
              <button
                type="button"
                aria-label={`Decrease ${product.name} quantity`}
                title="Decrease quantity"
                disabled={authLoading || busy || quantity === 0}
                onClick={() => onChangeQuantity(product, quantity - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="h-5 w-5"
                >
                  <path d="M5 12h14" />
                </svg>
              </button>

              <span
                aria-label={`Quantity ${quantity}`}
                className="flex min-w-8 items-center justify-center text-sm font-semibold tabular-nums text-gray-900"
              >
                {quantity}
              </span>

              <button
                type="button"
                aria-label={`Increase ${product.name} quantity`}
                title="Increase quantity"
                disabled={
                  product.stock < 1 ||
                  authLoading ||
                  busy ||
                  quantity >= product.stock
                }
                onClick={() =>
                  cartItem
                    ? onChangeQuantity(product, quantity + 1)
                    : onAddToCart(product)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="h-5 w-5"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
