import type { FC } from "hono/jsx";

/**
 * Script anti-FOUC: membaca preferensi tema dari localStorage dan langsung
 * menerapkan class `dark` ke <html> SEBELUM body dirender, supaya tidak ada
 * kedipan (flash) warna saat halaman dimuat.
 * Harus diletakkan di <head>, sebelum stylesheet dimuat.
 */
export const ThemeInitScript: FC = () => {
  const script = `
    (function () {
      try {
        var stored = localStorage.getItem("gezyteach-theme");
        var theme = stored === "dark" || stored === "light"
          ? stored
          : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        if (theme === "dark") {
          document.documentElement.classList.add("dark");
        }
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
};

/**
 * Tombol toggle dark/light mode. Menyimpan preferensi ke localStorage dan
 * toggle class `dark` di <html> tanpa reload halaman.
 */
export const ThemeToggle: FC = () => {
  const script = `
    (function (btn) {
      btn.addEventListener("click", function () {
        var html = document.documentElement;
        var isDark = html.classList.toggle("dark");
        try {
          localStorage.setItem("gezyteach-theme", isDark ? "dark" : "light");
        } catch (e) {}
      });
    })(document.currentScript.previousElementSibling);
  `;
  return (
    <>
      <button
        type="button"
        aria-label="Ganti tema terang/gelap"
        class="gt-theme-toggle"
      />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
};
