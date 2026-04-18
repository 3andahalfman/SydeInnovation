import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';

const servicesDropdown = [
  { label: 'Mechanical Design', path: '/services/mechanical-design' },
  { label: 'Manufacturing', path: '/services/manufacturing' },
  { label: 'Simulation', path: '/services/simulation' },
  { label: 'Automation', path: '/services/automation' },
];

const productsDropdown = [
  { label: 'SydeFlow', path: '#', comingSoon: true },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
    
    // If not on home page, navigate there first
    if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: id } });
      return;
    }
    
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle scroll after navigation from another page
  useEffect(() => {
    if (location.state?.scrollTo) {
      const element = document.getElementById(location.state.scrollTo);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.state]);

  const handleDropdownToggle = (menu: string) => {
    setActiveDropdown(activeDropdown === menu ? null : menu);
  };

  return (
    <header
      className={`fixed w-full top-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'glass-light shadow-lg' 
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-2xl font-bold bg-gradient-to-r from-blue-950 to-orange-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              SydeInnovation
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {/* Home */}
            <button
              onClick={() => scrollToSection('home')}
              className={`text-sm font-medium uppercase tracking-wider transition-colors ${
                isScrolled ? 'text-gray-700 hover:text-orange-500' : 'text-white hover:text-orange-400'
              }`}
            >
              Home
            </button>

            {/* Services Dropdown */}
            <div className="relative">
              <button
                onClick={() => handleDropdownToggle('services')}
                onMouseEnter={() => setActiveDropdown('services')}
                className={`flex items-center space-x-1 text-sm font-medium uppercase tracking-wider transition-colors ${
                  isScrolled ? 'text-gray-700 hover:text-orange-500' : 'text-white hover:text-orange-400'
                }`}
              >
                <span>Services</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'services' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'services' && (
                <div
                  className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-2 z-50"
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  {servicesDropdown.map((item, idx) => (
                    <Link
                      key={idx}
                      to={item.path}
                      onClick={() => setActiveDropdown(null)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-500 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Products Dropdown */}
            <div className="relative">
              <button
                onClick={() => handleDropdownToggle('products')}
                onMouseEnter={() => setActiveDropdown('products')}
                className={`flex items-center space-x-1 text-sm font-medium uppercase tracking-wider transition-colors ${
                  isScrolled ? 'text-gray-700 hover:text-orange-500' : 'text-white hover:text-orange-400'
                }`}
              >
                <span>Products</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'products' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'products' && (
                <div
                  className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-2 z-50"
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  {productsDropdown.map((item, idx) => (
                    <div
                      key={idx}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        item.comingSoon 
                          ? 'text-gray-400 cursor-not-allowed' 
                          : 'text-gray-700 hover:bg-orange-50 hover:text-orange-500 transition-colors'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.comingSoon && (
                        <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* About Us */}
            <Link
              to="/about"
              className={`text-sm font-medium uppercase tracking-wider transition-colors ${
                isScrolled ? 'text-gray-700 hover:text-orange-500' : 'text-white hover:text-orange-400'
              }`}
            >
              About Us
            </Link>

            {/* Contact */}
            <Link
              to="/contact"
              className={`text-sm font-medium uppercase tracking-wider transition-colors ${
                isScrolled ? 'text-gray-700 hover:text-orange-500' : 'text-white hover:text-orange-400'
              }`}
            >
              Contact
            </Link>

            {/* Project Button */}
            <Link
              to="/portfolio"
              className={`ml-4 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 uppercase tracking-wider border ${
                isScrolled 
                  ? 'border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-500' 
                  : 'border-white/30 text-white hover:border-orange-400 hover:text-orange-400'
              }`}
              style={{ minWidth: 220 }}
            >
              Project: Viewer SDK
            </Link>
          </nav>

          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
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
            <nav className="flex flex-col space-y-2 p-6">
              <button
                onClick={() => scrollToSection('home')}
                className="text-sm font-medium uppercase tracking-wider text-gray-700 hover:text-orange-500 transition-colors text-left py-2"
              >
                Home
              </button>
              
              {/* Mobile Services */}
              <div>
                <button
                  onClick={() => handleDropdownToggle('mobile-services')}
                  className="flex items-center justify-between w-full text-sm font-medium uppercase tracking-wider text-gray-700 hover:text-orange-500 transition-colors text-left py-2"
                >
                  <span>Services</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'mobile-services' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'mobile-services' && (
                  <div className="pl-4 mt-2 space-y-2 border-l-2 border-orange-200">
                    {servicesDropdown.map((item, idx) => (
                      <Link
                        key={idx}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block text-sm text-gray-600 hover:text-orange-500 transition-colors py-1"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Products */}
              <div>
                <button
                  onClick={() => handleDropdownToggle('mobile-products')}
                  className="flex items-center justify-between w-full text-sm font-medium uppercase tracking-wider text-gray-700 hover:text-orange-500 transition-colors text-left py-2"
                >
                  <span>Products</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'mobile-products' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'mobile-products' && (
                  <div className="pl-4 mt-2 space-y-2 border-l-2 border-orange-200">
                    {productsDropdown.map((item, idx) => (
                      <div
                        key={idx}
                        className={`text-sm py-1 ${
                          item.comingSoon 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-gray-600 hover:text-orange-500 transition-colors'
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.comingSoon && (
                          <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Link
                to="/about"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-sm font-medium uppercase tracking-wider text-gray-700 hover:text-orange-500 transition-colors text-left py-2"
              >
                About Us
              </Link>

              <Link
                to="/contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-sm font-medium uppercase tracking-wider text-gray-700 hover:text-orange-500 transition-colors text-left py-2"
              >
                Contact
              </Link>

              {/* Project Button */}
              <Link
                to="/portfolio"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 uppercase tracking-wider text-center border border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-500"
              >
                Project: Viewer SDK
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
