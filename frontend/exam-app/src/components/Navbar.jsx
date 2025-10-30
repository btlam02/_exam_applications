import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const navItems = [
    { name: "Trang chủ", path: "/" },
    { name: "Đăng nhập", path: "/login" },
    // { name: "Liên hệ", path: "/contact" },
    { name: "Đăng ký", path: "/register" },
  ];

  return (
    <nav className="bg-white shadow-md sticky">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo */}
        <div className="text-2xl font-bold text-blue-600">
          <Link to="/">EA.</Link>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex space-x-6">
          {navItems.map((item) => (
            <> 
            <Link
              key={item.name}
              to={item.path}
              className="text-gray-700 hover:text-blue-600"
            >
              {item.name}
            </Link>
            </>
          ))}
        </div>

        

        {/* Mobile Icon */}
        <div className="md:hidden">
          <button onClick={toggleMenu}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden px-4 pb-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setMenuOpen(false)}
              className="block text-gray-700 hover:text-blue-600"
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
