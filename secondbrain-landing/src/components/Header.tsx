'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navigationLinks = [
    { href: '/#features', label: 'Funciones' },
    { href: '/precios', label: 'Precios' },
    { href: '/#faq', label: 'FAQ' },
  ];

  const handleLinkClick = (href: string) => {
    setMobileMenuOpen(false);
    
    // Si estamos navegando a un ancla y no estamos en la página principal
    if (href.startsWith('/#') && pathname !== '/') {
      // Navegamos a la página principal con el ancla
      window.location.href = href;
    }
  };

  return (
    <nav 
      className="liquid-nav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 1000,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20 px-1 sm:px-0">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-3"
          >
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity duration-300">
              <div className="relative">
                <Image
                  src="/Logo-simple-SecondBrain.png"
                  alt="SecondBrain Logo"
                  width={32}
                  height={32}
                  className="w-7 h-7 sm:w-8 sm:h-8"
                  priority
                />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
              </div>
              <span className="text-lg sm:text-xl font-bold text-white tracking-tight">
                SecondBrain
              </span>
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex items-center space-x-6 xl:space-x-8"
          >
            <div className="flex items-center space-x-6 xl:space-x-8">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => handleLinkClick(link.href)}
                  className="text-gray-300 hover:text-white transition-colors duration-300 text-sm font-medium relative group header-nav-link"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400 transform scale-x-0 transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
              ))}
            </div>
            
            {/* Separator */}
            <div className="header-separator"></div>
            
            <div className="flex items-center space-x-8 header-cta-buttons">
              <Link
                href="https://app.secondbrainapp.com"
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Ir a la App
              </Link>
            </div>
          </motion.div>

          {/* Mobile menu button */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:hidden flex items-center space-x-4"
          >
            <Link
              href="https://app.secondbrainapp.com/login"
              className="text-gray-300 hover:text-white transition-colors text-sm font-medium hidden sm:block px-3 py-2 rounded-lg hover:bg-white/10"
            >
              Login
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10 border border-white/10"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="lg:hidden liquid-card border-t border-white/10 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col space-y-1">
                {navigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => handleLinkClick(link.href)}
                    className="text-gray-300 hover:text-white transition-colors text-base font-medium py-3 px-2 rounded-lg hover:bg-white/10 border-b border-white/5 last:border-b-0"
                  >
                    {link.label}
                  </Link>
                ))}
                
                <div className="flex flex-col space-y-3 pt-4 mt-4 border-t border-white/10">
                  <Link
                    href="https://app.secondbrainapp.com"
                    onClick={() => handleLinkClick('https://app.secondbrainapp.com')}
                    className="text-center liquid-button text-white px-4 py-3 rounded-lg text-base font-semibold transition-all duration-300 shadow-lg"
                  >
                    Ir a la App
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Header;
