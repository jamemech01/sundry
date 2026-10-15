"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Product = {
    id: number;
    name: string;
    category: string;
    price: number | string;
    stock: number;
};

type Shop = {
    id: number;
    name: string;
    lat: number;
    lng: number;
    products: Product[];
};

export default function ShopsPage() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        apiFetch<Shop[]>("shops")
            .then(setShops)
            .catch((err: unknown) => {
                setError(
                    err instanceof Error ? err.message : "Unable to load shops.",
                );
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
            <h1 className="text-3xl font-bold">Shops</h1>
            <p className="mt-2 text-gray-600">
                Explore shops and discover their products.
            </p>

            {loading && <p className="mt-8">Loading shops...</p>}

            {error && (
                <p role="alert" className="mt-8 text-red-600">
                    {error}
                </p>
            )}

            {!loading && !error && shops.length === 0 && (
                <p className="mt-8 text-gray-600">
                    No shops available yet.
                </p>
            )}

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {shops.map((shop) => (
                    <section
                        key={shop.id}
                        className="rounded-xl border bg-white p-5 shadow-sm"
                    >
                        <h2 className="text-xl font-semibold">{shop.name}</h2>

                        <p className="mt-1 text-sm text-gray-500">
                            {shop.products.length} products
                        </p>

                        {shop.products.length > 0 ? (
                            <ul className="mt-4 divide-y">
                                {shop.products.map((product) => (
                                    <li key={product.id} className="py-3">
                                        <div className="flex justify-between gap-3">
                                            <div>
                                                <p className="font-medium">{product.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {product.category}
                                                </p>
                                            </div>

                                            <p className="font-medium">
                                                {Number(product.price).toFixed(2)}
                                            </p>
                                        </div>

                                        <p className="mt-1 text-sm text-gray-500">
                                            Stock: {product.stock}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-4 text-sm text-gray-500">
                                No products yet.
                            </p>
                        )}

                        <Link
                            href={`/shops/${shop.id}`}
                            className="mt-4 inline-block font-medium text-blue-600 hover:text-blue-700"
                        >
                            View Shop →
                        </Link>
                    </section>
                ))}
            </div>
        </main>
    );
}