'use client'

import Link from 'next/link'
import { 
  Shield, Leaf, DollarSign, TrendingUp, Award, Package,
  Target, Users, BarChart3, Globe, Building2, CheckCircle,
  ArrowRight, Phone, Mail, MapPin, Menu, X, Star,
  Factory, Truck, Lightbulb, Briefcase, HandshakeIcon
} from 'lucide-react'
import { useState } from 'react'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const businessCapabilities = [
    {
      icon: Globe,
      title: "Global Supply Chain",
      description: "Direct partnerships with certified manufacturers across Asia, ensuring quality control and competitive pricing"
    },
    {
      icon: Building2,
      title: "Enterprise Solutions",
      description: "Customized B2B programs for retailers, distributors, and large-scale contractors"
    },
    {
      icon: Leaf,
      title: "Sustainability Leadership",
      description: "GRS certified operations setting industry standards for environmental responsibility"
    },
    {
      icon: BarChart3,
      title: "Data-Driven Operations",
      description: "Advanced analytics and AI-powered inventory management for optimal efficiency"
    }
  ]

  const divisions = [
    {
      name: "Manufacturing & Import",
      icon: Factory,
      description: "Strategic partnerships with GRS-certified facilities",
      capabilities: ["Quality Control", "Supply Chain Management", "Cost Optimization"]
    },
    {
      name: "Distribution & Logistics",
      icon: Truck,
      description: "Nationwide fulfillment network serving major markets",
      capabilities: ["3PL Integration", "Just-in-Time Delivery", "Inventory Management"]
    },
    {
      name: "Technology & Innovation",
      icon: Lightbulb,
      description: "Proprietary systems for operational excellence",
      capabilities: ["E-commerce Platform", "WMS Integration", "Business Intelligence"]
    }
  ]

  const stats = [
    { value: "$2.5B", label: "Market Opportunity" },
    { value: "5+", label: "U.S. Jobs Created" },
    { value: "100%", label: "Recycled Materials" },
    { value: "25%", label: "Cost Advantage" }
  ]

  return (
    <div className="relative min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Targon Global</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#capabilities" className="text-gray-700 hover:text-green-600 transition-colors">Capabilities</Link>
              <Link href="#divisions" className="text-gray-700 hover:text-green-600 transition-colors">Divisions</Link>
              <Link href="#partners" className="text-gray-700 hover:text-green-600 transition-colors">Partners</Link>
              <Link href="#contact" className="text-gray-700 hover:text-green-600 transition-colors">Contact</Link>
              <Link 
                href="/WMS" 
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Package className="w-4 h-4" />
                <span>Partner Portal</span>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-4 py-4 space-y-4">
              <Link href="#capabilities" className="block text-gray-700 hover:text-green-600">Capabilities</Link>
              <Link href="#divisions" className="block text-gray-700 hover:text-green-600">Divisions</Link>
              <Link href="#partners" className="block text-gray-700 hover:text-green-600">Partners</Link>
              <Link href="#contact" className="block text-gray-700 hover:text-green-600">Contact</Link>
              <Link 
                href="/WMS" 
                className="block px-4 py-2 bg-green-600 text-white rounded-lg text-center hover:bg-green-700"
              >
                Partner Portal
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Building America's Future in
              <span className="text-green-600"> Sustainable Manufacturing</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
              Targon Global is revolutionizing the protective materials industry through innovative supply chain management, 
              sustainable practices, and technology-driven operations.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <a 
                href="#capabilities" 
                className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-lg font-semibold"
              >
                <span>Explore Our Business</span>
                <ArrowRight className="w-5 h-5" />
              </a>
              <a 
                href="#contact" 
                className="px-8 py-4 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors flex items-center justify-center text-lg font-semibold"
              >
                <Briefcase className="w-5 h-5 mr-2" />
                <span>Partner With Us</span>
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-green-600">{stat.value}</div>
                <div className="text-gray-600 mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business Capabilities Section */}
      <section id="capabilities" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Core Business Capabilities
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Leveraging our expertise and infrastructure to deliver exceptional value across the supply chain
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {businessCapabilities.map((capability, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition-all duration-300 border border-gray-100">
                <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <capability.icon className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{capability.title}</h3>
                <p className="text-gray-600">{capability.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business Divisions Section */}
      <section id="divisions" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Business Divisions
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Integrated operations delivering end-to-end value in the protective materials industry
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {divisions.map((division, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="bg-gradient-to-br from-green-600 to-green-700 p-8 text-white">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center mb-4">
                    <division.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">{division.name}</h3>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-6">{division.description}</p>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">Key Capabilities:</h4>
                    {division.capabilities.map((capability, cIndex) => (
                      <div key={cIndex} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                        <span className="text-gray-700">{capability}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners & Certifications Section */}
      <section id="partners" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Strategic Partnerships & Certifications
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Building strong relationships with industry leaders and maintaining the highest standards
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Certifications */}
            <div className="bg-gray-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Award className="w-8 h-8 text-green-600 mr-3" />
                Industry Certifications
              </h3>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Global Recycled Standard (GRS)</h4>
                  <p className="text-gray-600">Certified for recycled content and responsible production practices</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Amazon Climate Pledge Friendly</h4>
                  <p className="text-gray-600">Only recycled drop cloth brand qualifying for sustainability certification</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">ISO 9001:2015 (In Progress)</h4>
                  <p className="text-gray-600">Pursuing quality management system certification</p>
                </div>
              </div>
            </div>

            {/* Key Partners */}
            <div className="bg-gray-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <HandshakeIcon className="w-8 h-8 text-green-600 mr-3" />
                Key Business Partners
              </h3>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Major Retail Chains</h4>
                  <p className="text-gray-600">Strategic partnerships with leading home improvement retailers</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">E-commerce Platforms</h4>
                  <p className="text-gray-600">Preferred vendor status on Amazon and other marketplaces</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Manufacturing Partners</h4>
                  <p className="text-gray-600">Exclusive agreements with GRS-certified facilities</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership & Vision Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Leadership & Vision
              </h2>
              <p className="text-xl text-gray-600 mb-6">
                Targon Global combines proven international experience with innovative American entrepreneurship 
                to transform the protective materials industry.
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Jarrar Amjad, Founder & CEO</h3>
                  <p className="text-gray-600 mb-4">
                    Former COO of Trademan Enterprise Ltd (UK), bringing 4 years of experience building 
                    a successful drop cloth business from startup to profitability. Expert in supplier 
                    negotiations, inventory management, and strategic partnerships.
                  </p>
                </div>
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Our Mission</h4>
                  <p className="text-gray-600">
                    To become America's leading sustainable protective materials company by combining 
                    operational excellence, environmental responsibility, and customer-first innovation.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 text-center shadow-lg">
                <Globe className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="font-bold text-gray-900 mb-2">Global Expertise</h4>
                <p className="text-sm text-gray-600">International supply chain management</p>
              </div>
              <div className="bg-white rounded-xl p-6 text-center shadow-lg">
                <Target className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="font-bold text-gray-900 mb-2">Market Focus</h4>
                <p className="text-sm text-gray-600">$2.5B U.S. market opportunity</p>
              </div>
              <div className="bg-white rounded-xl p-6 text-center shadow-lg">
                <Users className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="font-bold text-gray-900 mb-2">Job Creation</h4>
                <p className="text-sm text-gray-600">5+ U.S. employees by Year 5</p>
              </div>
              <div className="bg-white rounded-xl p-6 text-center shadow-lg">
                <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="font-bold text-gray-900 mb-2">Growth Target</h4>
                <p className="text-sm text-gray-600">$2.4M revenue by Year 5</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-green-600 to-green-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Let's Build the Future Together
          </h2>
          <p className="text-xl text-green-100 mb-8">
            Whether you're a retailer, distributor, or investor, discover how partnering with 
            Targon Global can transform your business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="#contact" 
              className="px-8 py-3 bg-white text-green-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold flex items-center justify-center"
            >
              <HandshakeIcon className="w-5 h-5 mr-2" />
              Become a Partner
            </a>
            <a 
              href="/WMS" 
              className="px-8 py-3 border-2 border-white text-white rounded-lg hover:bg-white/10 transition-colors font-semibold flex items-center justify-center"
            >
              <Building2 className="w-5 h-5 mr-2" />
              Partner Portal Access
            </a>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Get in Touch</h2>
              <p className="text-lg text-gray-600 mb-8">
                Whether you're a retailer interested in wholesale pricing or a contractor looking for bulk orders, 
                we're here to help you get the best value.
              </p>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <MapPin className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Headquarters</h3>
                    <p className="text-gray-600">13401 Legendary Dr, Apt 5208<br />Austin, TX 78727</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Mail className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Email</h3>
                    <a href="mailto:sales@targonglobal.com" className="text-green-600 hover:text-green-700">
                      sales@targonglobal.com
                    </a>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Phone className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Phone</h3>
                    <a href="tel:1-800-TARGON1" className="text-green-600 hover:text-green-700">
                      1-800-TARGON1
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Start a Partnership</h3>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                    placeholder="your@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partnership Type</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600">
                    <option>Select...</option>
                    <option>Retail Partnership</option>
                    <option>Distribution Agreement</option>
                    <option>Supplier/Vendor</option>
                    <option>Investment Opportunity</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                    rows={4}
                    placeholder="Tell us about your partnership interests..."
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Submit Partnership Inquiry
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">Targon Global</span>
              </div>
              <p className="text-gray-400">
                America's sustainable drop cloth manufacturer
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Business</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a></li>
                <li><a href="#divisions" className="hover:text-white transition-colors">Divisions</a></li>
                <li><a href="#partners" className="hover:text-white transition-colors">Partners</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Leadership</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/WMS" className="hover:text-white transition-colors">Partner Portal</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Investor Relations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Sustainability Report</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Targon LLC. All rights reserved. | Federal EIN: 33-3853937</p>
          </div>
        </div>
      </footer>
    </div>
  )
}