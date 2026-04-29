"use client";

import { useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved =
      localStorage.getItem("theme") || localStorage.getItem("restok-theme");

    if (saved === "dark" || saved === "light") {
      localStorage.setItem("theme", saved);
      localStorage.removeItem("restok-theme");
      return saved === "dark";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  function toggle() {
    const newDark = !dark;
    setDark(newDark);

    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
    localStorage.removeItem("restok-theme");
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition"
    >
      <div
        className={`w-10 h-5 flex items-center rounded-full p-1 transition ${
          dark ? "bg-sky-600" : "bg-slate-400"
        }`}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
            dark ? "translate-x-5" : ""
          }`}
        ></div>
      </div>
      <span>{dark ? "Dark Mode" : "Light Mode"}</span>
    </button>
  );
}
