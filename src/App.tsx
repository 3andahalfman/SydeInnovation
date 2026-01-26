import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import Products from './components/Products';
import About from './components/About';
import Footer from './components/Footer';
import AboutPage from './pages/AboutPage';
import PortfolioPage from './pages/PortfolioPage';
import DesignEngineeringPage from './pages/DesignEngineeringPage';
import CadCamServicesPage from './pages/CadCamServicesPage';
import ManufacturingSolutionsPage from './pages/ManufacturingSolutionsPage';
import ProcessOptimizationPage from './pages/ProcessOptimizationPage';

function HomePage() {
  return (
    <>
      <Header />
      <Hero />
      <Services />
      <Products />
      <About />
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/services/design-engineering" element={<DesignEngineeringPage />} />
          <Route path="/services/cad-cam" element={<CadCamServicesPage />} />
          <Route path="/services/manufacturing" element={<ManufacturingSolutionsPage />} />
          <Route path="/services/process-optimization" element={<ProcessOptimizationPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
