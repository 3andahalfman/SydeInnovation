import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import Products from './components/Products';
import About from './components/About';
import Footer from './components/Footer';
import AboutPage from './pages/AboutPage';
import PortfolioPage from './pages/PortfolioPage';
import ContactPage from './pages/ContactPage';
import CadDesignPage from './pages/CadDesignPage';
import CadDraftingPage from './pages/CadDraftingPage';
import ManufacturingPage from './pages/ManufacturingPage';
import SimulationPage from './pages/SimulationPage';
import AutomationPage from './pages/AutomationPage';
import NotFoundPage from './pages/NotFoundPage';

function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <Products />
        <About />
      </main>
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
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/services/mechanical-design" element={<CadDesignPage />} />
          <Route path="/services/cad-drafting" element={<CadDraftingPage />} />
          <Route path="/services/manufacturing" element={<ManufacturingPage />} />
          <Route path="/services/simulation" element={<SimulationPage />} />
          <Route path="/services/automation" element={<AutomationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Analytics />
      </div>
    </Router>
  );
}

export default App;
