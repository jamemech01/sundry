"use client";

import { useRouter, usePathname } from "next/navigation";

type BackButtonProps = {
    fallbackHref?: string;
    onClick?: () => void;
    disabled?: boolean;
};

export default function BackButton({
    fallbackHref = "/",
    onClick,
    disabled = false,
}: BackButtonProps) {
    const router = useRouter();
    const pathname = usePathname();

    const focusStyle =
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

    const buttonStyle = `inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.97] ${focusStyle}`;

    const backHref =
        fallbackHref !== "/"
            ? fallbackHref
            : pathname === "/register"
                ? "/login"
                : "/";

    return (
        <button
            type="button"
            onClick={onClick ?? (() => router.push(backHref))}
            disabled={disabled}
            aria-label="Go back"
            title="Back"
            className={`${buttonStyle} disabled:cursor-not-allowed disabled:opacity-50`}
        >
            <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="m15 18-6-6 6-6" />
            </svg>
        </button>
    );
}
