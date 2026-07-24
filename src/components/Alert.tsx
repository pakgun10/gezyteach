import type { FC } from "hono/jsx";

export const Alert: FC<{ variant?: "error" | "success"; children: any }> = ({
  variant = "error",
  children,
}) => {
  const styles =
    variant === "error"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <div class={`rounded-lg border px-3 py-2 text-sm mb-4 ${styles}`}>
      {children}
    </div>
  );
};
