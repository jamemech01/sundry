
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Order = {
  id: number;
  status: "pending" | "accepted" | "rejected" | "delivered" | "completed";
  deliveryFee: string | number;
  items: {
    id: number;
    quantity: number;
    price: string | number;
    product: {
      name: string;
    };
  }[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Order[]>("orders")
      .then(setOrders)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "โหลดคำสั่งซื้อไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <main className="p-6">กำลังโหลดคำสั่งซื้อ...</main>;
  }

  if (error) {
    return <main className="p-6 text-red-600">{error}</main>;
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">คำสั่งซื้อ</h1>

      {orders.length === 0 ? (
        <p className="text-gray-500">ยังไม่มีคำสั่งซื้อ</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">คำสั่งซื้อ #{order.id}</h2>
                <span className="rounded bg-gray-100 px-3 py-1 text-sm">
                  {order.status}
                </span>
              </div>

              <ul className="space-y-1 text-sm text-gray-700">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.product.name} × {item.quantity} —{" "}
                    {(Number(item.price) * item.quantity).toFixed(2)} บาท
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-sm text-gray-600">
                ค่าจัดส่ง: {Number(order.deliveryFee).toFixed(2)} บาท
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
