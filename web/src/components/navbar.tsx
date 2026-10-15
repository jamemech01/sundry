"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        fetch("/api/auth/me", { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("Unable to check login");
                }
                return response.json();
            })
            .then((data: { authenticated?: boolean }) => {
                if (active) {
                    setAuthenticated(data.authenticated === true);
                }
            })
            .catch(() => {
                if (active) {
                    setAuthenticated(false);
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        setAuthenticated(false);
        router.push("/");
        router.refresh();
    }

    if (pathname === "/") {
        return null;
    }

    return (
        <header className="flex items-center justify-between border-b bg-white px-6 py-4">
            <Link href="/" className="text-2xl font-bold">
                Sundry
            </Link>

            <nav className="flex items-center gap-4 text-sm">
                <Link href="/shops" className="hover:text-blue-600">
                    Shops
                </Link>

                {!loading && authenticated && (
                    <>
                        <Link href="/orders" className="hover:text-blue-600">
                            Orders
                        </Link>

                        <Link href="/wallet" className="hover:text-blue-600">
                            Wallet
                        </Link>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="hover:text-blue-600"
                        >
                            Logout
                        </button>
                    </>
                )}

                {!loading && !authenticated && (
                    <>
                        <Link href="/login" className="hover:text-blue-600">
                            Login
                        </Link>

                        <Link href="/register" className="hover:text-blue-600">
                            Register
                        </Link>
                    </>
                )}
            </nav>
        </header>
    );
}