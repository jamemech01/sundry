"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Product = {
    id: number;
    name: string;
    category: string;
    price: number | string;
    stock: number;
    imageUrl?: string | null;
};

type Shop = {
    id: number;
    name: string;
    lat: number;
    lng: number;
    products: Product[];
};

export default function ShopDetailPage() {
    return (
        <Suspense fallback={<main className="p-6">Loading shop...</main>}>
            <ShopDetailContent />
        </Suspense>
    );
}

function ShopDetailContent() {
    const params = useParams<{ id: string }>();
    const [shop, setShop] = useState<Shop | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        apiFetch<Shop>(`shops/${params.id}`)
            .then(setShop)
            .catch((err: unknown) => {
                setError(
                    err instanceof Error ? err.message : "Unable to load shop.",
                );
            })
            .finally(() => setLoading(false));
    }, [params.id]);

    if (loading) {
        return <main className="p-6">Loading shop...</main>;
    }

    if (error) {
        return <main className="p-6 text-red-600">{error}</main>;
    }

    if (!shop) {
        return <main className="p-6">Shop not found.</main>;
    }

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
            <Link
                href="/shops"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
                ← Back to Shops
            </Link>

            <h1 className="mt-4 text-3xl font-bold">{shop.name}</h1>
            <p className="mt-2 text-gray-600">{shop.products.length} products</p>

            {shop.products.length === 0 ? (
                <p className="mt-8 text-gray-500">No products available.</p>
            ) : (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {shop.products.map((product) => (
                        <article
                            key={product.id}
                            className="rounded-xl border bg-white p-4 shadow-sm"
                        >
                            {product.imageUrl && (
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="mb-3 h-40 w-full rounded-lg object-cover"
                                />
                            )}

                            <h2 className="font-semibold">{product.name}</h2>
                            <p className="mt-1 text-sm text-gray-500">{product.category}</p>
                            <p className="mt-2 font-semibold text-blue-700">
                                ฿{Number(product.price).toFixed(2)}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Stock: {product.stock}
                            </p>
                        </article>
                    ))}
                </div>
            )}
        </main>
    );
}
