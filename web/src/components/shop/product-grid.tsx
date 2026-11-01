import Image from "next/image";

type Product = {
    id: number;
    name: string;
    category: string;
    price: number | string;
    stock: number;
    imageUrl?: string | null;
};

type ProductGridProps = {
    products: Product[];
    isOwner: boolean;
    busy: boolean;
    authLoading: boolean;
    loading: boolean;
    cart: { productId: number; quantity: number }[];
    page: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onEdit: (product: Product) => void;
    onDelete: (product: Product) => void;
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
    totalPages,
    onPageChange,
    onEdit,
    onDelete,
    onAddToCart,
    onChangeQuantity,
}: ProductGridProps) {
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

    if (total === 0) {
        return (
            <section className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
                    ◇
                </div>
                <p className="mt-4 text-base font-semibold text-gray-900">
                    {isOwner ? "Your shop is empty" : "No products yet"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                    {isOwner
                        ? "Add your first product to get started."
                        : "Check back later for new products."}
                </p>
            </section>
        );
    }

    return (
        <section className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-900">
                        {total.toLocaleString("en-US")}
                    </span>{" "}
                    {total === 1 ? "product" : "products"}
                </p>

                {loading && (
                    <span className="text-xs text-blue-600">Updating...</span>
                )}
            </div>

            <div
                className={`grid grid-cols-2 gap-3 sm:gap-5 ${loading ? "opacity-60" : ""
                    }`}
            >
                {products.map((product) => {
                    const cartItem = cart.find(
                        (item) => item.productId === product.id,
                    );

                    return (
                        <article
                            key={product.id}
                            className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition duration-200 hover:border-blue-200 hover:shadow-md"
                        >
                            <div className="relative aspect-square overflow-hidden bg-gray-50">
                                {product.imageUrl ? (
                                    <Image
                                        src={product.imageUrl}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 640px) 50vw, 300px"
                                        unoptimized
                                        className="object-cover transition duration-300 group-hover:scale-[1.03]"
                                    />
                                ) : (
                                    <div
                                        className="flex h-full w-full items-center justify-center text-4xl text-gray-300"
                                        aria-label="No product image"
                                    >
                                        ◇
                                    </div>
                                )}

                                {isOwner && (
                                    <span className="absolute left-2 top-2 rounded-lg bg-purple-50/95 px-2 py-1 text-[10px] font-semibold text-purple-700 sm:left-3 sm:top-3 sm:text-xs">
                                        Your product
                                    </span>
                                )}

                                {product.stock < 1 && (
                                    <span className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-medium text-gray-600 sm:bottom-3 sm:left-3 sm:text-xs">
                                        Out of stock
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-1 flex-col p-3 sm:p-4">
                                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:text-xs">
                                    {product.category || "Other"}
                                </p>

                                <h2 className="mt-1.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-gray-900 sm:min-h-12 sm:text-base sm:leading-6">
                                    {product.name}
                                </h2>

                                <div className="mt-3 flex flex-col gap-1">
                                    <p className="text-base font-bold tabular-nums text-blue-700 sm:text-lg">
                                        ฿
                                        {Number(product.price).toLocaleString(
                                            "en-US",
                                            {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            },
                                        )}
                                    </p>
                                    <p className="text-[11px] text-gray-500 sm:text-xs">
                                        Stock:{" "}
                                        {product.stock.toLocaleString("en-US")}
                                    </p>
                                </div>

                                <div className="mt-auto pt-4">
                                    {isOwner ? (
                                        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => onEdit(product)}
                                                className="h-9 rounded-xl bg-purple-50 px-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => onDelete(product)}
                                                className="h-9 rounded-xl border border-red-200 px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="border-t border-gray-100 pt-3">
                                            <button
                                                type="button"
                                                disabled={
                                                    product.stock < 1 ||
                                                    authLoading ||
                                                    busy
                                                }
                                                onClick={() =>
                                                    onAddToCart(product)
                                                }
                                                className="h-10 w-full rounded-xl bg-blue-600 px-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 sm:text-sm"
                                            >
                                                {product.stock < 1
                                                    ? "Out of stock"
                                                    : "Add to cart"}
                                            </button>

                                            {cartItem && (
                                                <div className="mt-3 flex items-center justify-between gap-1">
                                                    <span className="text-xs text-gray-500 sm:text-sm">
                                                        Qty
                                                    </span>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            aria-label={`Decrease ${product.name} quantity`}
                                                            onClick={() =>
                                                                onChangeQuantity(
                                                                    product,
                                                                    cartItem.quantity -
                                                                    1,
                                                                )
                                                            }
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50"
                                                        >
                                                            −
                                                        </button>

                                                        <span className="min-w-4 text-center text-sm font-semibold tabular-nums text-gray-900">
                                                            {cartItem.quantity}
                                                        </span>

                                                        <button
                                                            type="button"
                                                            aria-label={`Increase ${product.name} quantity`}
                                                            disabled={
                                                                cartItem.quantity >=
                                                                product.stock
                                                            }
                                                            onClick={() =>
                                                                onChangeQuantity(
                                                                    product,
                                                                    cartItem.quantity +
                                                                    1,
                                                                )
                                                            }
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>

            {totalPages > 1 && (
                <nav
                    aria-label="Product pagination"
                    className="mt-8 flex flex-col gap-4 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
                >
                    <p className="text-center text-sm text-gray-500 sm:text-left">
                        Page{" "}
                        <span className="font-semibold text-gray-900">
                            {page}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-gray-900">
                            {totalPages}
                        </span>
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