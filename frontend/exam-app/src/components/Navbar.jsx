// src/components/Navbar.jsx
import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink, Link } from "react-router-dom";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen((v) => !v);

  const navItems = [
    { name: "Trang chủ", path: "/" },
    { name: "Sinh câu hỏi", path: "/llms" },
    { name: "Duyệt câu hỏi", path: "/can-llms" },
  ];  

  // Link styles tối ưu cho nền tím
  const linkBase =
    "inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300";
  const linkInactive = "text-white/90 hover:text-white";
  const linkActive = "text-white bg-white/15";

  return (
    <nav
      className="
        sticky top-0 z-50
        bg-gradient-to-r from-indigo-600 to-violet-600
        shadow-md
        dark:from-indigo-900 dark:to-violet-900
      "
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          to="/"
          className="group inline-flex items-center gap-2 rounded-xl px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          onClick={() => setMenuOpen(false)}
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm">
            EA
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            <span className="bg-white/90 bg-clip-text text-transparent">Exam</span>
            &nbsp;Assistant
          </span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end
              className={({ isActive }) =>
                [linkBase, isActive ? linkActive : linkInactive].join(" ")
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={toggleMenu}
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="inline-flex items-center rounded-lg p-2 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 md:hidden"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`md:hidden transition-all duration-200 ease-out ${
          menuOpen ? "max-h-96 opacity-100" : "pointer-events-none max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-1 px-4 pb-4">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                [
                  "block rounded-lg px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/90 hover:bg-white/10 hover:text-white",
                ].join(" ")
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
