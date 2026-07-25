import type { FC } from "hono/jsx";

export const Alert: FC<{ variant?: "error" | "success"; children: any }> = ({
  variant = "error",
  children,
}) => {
  const styles = variant === "error" ? "gt-badge-red" : "gt-badge-emerald";

  return (
    <div
      class={`gt-transition rounded-lg border border-transparent px-3 py-2 text-sm mb-4 ${styles}`}
    >
      {children}
    </div>
  );
};
