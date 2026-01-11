import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header
      className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <button
              onClick={() => scrollToSection('home')}
              className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-orange-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              sydeingenis
            </button>
          </div>

          <nav className="hidden md:flex space-x-8">
            {['home', 'services', 'products', 'about'].map((item) => (
              <button
                key={item}
                onClick={() => scrollToSection(item)}
                className={`text-sm font-medium uppercase tracking-wider transition-colors ${
                  isScrolled ? 'text-gray-700 hover:text-orange-500' : 'text-white hover:text-orange-400'
                }`}
              >
                {item === 'about' ? 'About Us' : item}
              </button>
            ))}
          </nav>

          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className={isScrolled ? 'text-gray-700' : 'text-white'} />
            ) : (
              <Menu className={isScrolled ? 'text-gray-700' : 'text-white'} />
            )}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-white shadow-lg rounded-lg mb-4">
            <nav className="flex flex-col space-y-4 p-6">
              {['home', 'services', 'products', 'about'].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollToSection(item)}
                  className="text-sm font-medium uppercase tracking-wider text-gray-700 hover:text-orange-500 transition-colors text-left"
                >
                  {item === 'about' ? 'About Us' : item}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
