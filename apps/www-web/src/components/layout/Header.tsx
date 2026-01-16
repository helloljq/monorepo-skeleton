import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { useState } from "react";
import Logo from "@/assets/logo.svg";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-12 md:h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center">
              <img
                src={Logo}
                alt="Monorepo Skeleton"
                className="h-7 md:h-10 w-auto"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link
              to="/"
              className="text-gray-600 hover:text-brand-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              首页
            </Link>
            <Link
              to="/landing/whey-protein"
              className="text-gray-600 hover:text-brand-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              产品
            </Link>
            <Link
              to="/about"
              className="text-gray-600 hover:text-brand-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              关于我们
            </Link>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:flex items-center">
            <Link
              to="/about"
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm hover:shadow-md"
            >
              联系我们
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-md focus:outline-none"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 absolute w-full">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              to="/"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-brand-600 hover:bg-brand-50"
            >
              首页
            </Link>
            <Link
              to="/landing/whey-protein"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-brand-600 hover:bg-brand-50"
            >
              产品
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
