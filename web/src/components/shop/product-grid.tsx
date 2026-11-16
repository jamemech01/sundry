import ProductCard, { type Product } from "./product-card";

type ProductGridProps = {
  products: Product[];
  isOwner: boolean;
  busy: boolean;
  authLoading: boolean;
  loading: boolean;
  cart: { productId: number; quantity: number }[];
  page: number;
  total: number;
  shopTotal: number;
  totalPages: number;
  categories: string[];
  selectedCategory: string;
  search: string;
  onPageChange: (page: number) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onImageChange: (product: Product, file: File) => void;
  onAddToCart: (product: Product) => void;
  onChangeQuantity: (product: Product, quantity: number) => void;
};

export default function ProductGrid({
  products,
  isOwner,
  busy,
  authLoading,
  loading,
  cart,
  page,
  total,
  shopTotal,
  totalPages,
  categories,
  selectedCategory,
  search,
  onPageChange,
  onCategoryChange,
  onSearchChange,
  onEdit,
  onDelete,
  onImageChange,
  onAddToCart,
  onChangeQuantity,
}: ProductGridProps) {
  const searchTerm = search.trim().toLocaleLowerCase();
  const visibleProducts = searchTerm
    ? products.filter(
        (product) =>
          product.name.toLocaleLowerCase().includes(searchTerm) ||
          product.category.toLocaleLowerCase().includes(searchTerm),
      )
    : products;

  if (loading && products.length === 0) {
    return (
      <section
        aria-label="Loading products"
        className="mt-6 grid grid-cols-2 gap-3 sm:gap-5"
      >
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
          >
            <div className="aspect-square animate-pulse bg-gray-100" />
            <div className="space-y-3 p-3 sm:p-4">
              <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-9 animate-pulse rounded-xl bg-gray-100" />
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center gap-3">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 text-gray-500 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0"
          >
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search..."
            aria-label="Search products by name or category"
            className="h-full w-full min-w-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear product search"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                className="h-5 w-5"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </label>

        <details className="group relative ml-auto shrink-0">
          <summary
            aria-label="Filter products by category"
            title={selectedCategory || "All categories"}
            className="flex h-10 max-w-[min(42vw,12rem)] cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden"
          >
            <span className="truncate">
              {selectedCategory || "All categories"}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 transition group-open:rotate-180"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="absolute right-0 z-30 mt-2 max-h-64 w-52 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
            {categories.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">
                No categories yet
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    onCategoryChange("");
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${
                    selectedCategory === ""
                      ? "font-semibold text-blue-700"
                      : "text-gray-700"
                  }`}
                >
                  All categories
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={(event) => {
                      onCategoryChange(category);
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${
                      selectedCategory === category
                        ? "font-semibold text-blue-700"
                        : "text-gray-700"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </>
            )}
          </div>
        </details>
      </div>

      {visibleProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <path d="M3 10l2-6h14l2 6" />
              <path d="M4 10v10h16V10" />
              <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
              <path d="M9 20v-5h6v5" />
            </svg>
          </div>
          <p className="mt-4 text-base font-semibold text-gray-900">
            {search.trim()
              ? "No products match your search"
              : shopTotal === 0
                ? isOwner
                  ? "Your shop is empty"
                  : "No products yet"
                : "No products in this category"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {search.trim()
              ? "Try a different product name or category."
              : shopTotal === 0
                ? isOwner
                  ? "Add your first product to get started."
                  : "Check back later for new products."
                : "Choose another category to see more products."}
          </p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-2 gap-3 sm:gap-5 ${
            loading ? "opacity-60" : ""
          }`}
        >
          {visibleProducts.map((product) => {
            const cartItem = cart.find((item) => item.productId === product.id);
            return (
              <ProductCard
                key={product.id}
                product={product}
                cartItem={cartItem}
                isOwner={isOwner}
                busy={busy}
                authLoading={authLoading}
                onEdit={onEdit}
                onDelete={onDelete}
                onImageChange={onImageChange}
                onAddToCart={onAddToCart}
                onChangeQuantity={onChangeQuantity}
              />
            );
          })}
        </div>
      )}

      {total > 0 && (
        <nav
          aria-label="Product pagination"
          className="mt-8 flex flex-col gap-4 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-center text-sm text-gray-500 sm:text-left">
            Page <span className="font-semibold text-gray-900">{page}</span> of{" "}
            <span className="font-semibold text-gray-900">{totalPages}</span>
          </p>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
