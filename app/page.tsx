'use client'

import Link from 'next/link'
import { 
  Shield, Leaf, DollarSign, TrendingUp, Award, Package,
  Target, Users, BarChart3, Globe, Building2, CheckCircle,
  ArrowRight, Phone, Mail, MapPin, Menu, X, Star
} from 'lucide-react'
import { useState } from 'react'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const features = [
    {
      icon: DollarSign,
      title: "25-30% Lower Prices",
      description: "Direct import model eliminates distributor markups while maintaining premium quality"
    },
    {
      icon: Leaf,
      title: "GRS Certified Sustainable",
      description: "Only recycled drop cloth brand qualifying for Amazon's Climate Pledge Friendly program"
    },
    {
      icon: Shield,
      title: "Professional Grade Quality",
      description: "Trusted by contractors and DIY homeowners for superior protection and durability"
    },
    {
      icon: Target,
      title: "Strategic Market Position",
      description: "Capturing the $2.5 billion U.S. drop cloth market with competitive advantages"
    }
  ]

  const products = [
    {
      name: "Targon Shield™ Standard",
      description: "9' x 12' plastic drop cloth, 0.7 mil thickness",
      features: ["Ideal for DIY projects", "Waterproof protection", "Tear-resistant"],
      price: "$8.99"
    },
    {
      name: "Targon Shield™ Heavy Duty",
      description: "9' x 12' plastic drop cloth, 1.0 mil thickness",
      features: ["Professional contractor grade", "Extra durability", "Reusable"],
      price: "$12.99"
    },
    {
      name: "Targon Shield™ Cotton",
      description: "9' x 12' canvas drop cloth",
      features: ["Premium absorbent material", "Washable & reusable", "Non-slip surface"],
      price: "$24.99"
    }
  ]

  const stats = [
    { value: "$2.5B", label: "Market Size" },
    { value: "29%", label: "Gross Margins" },
    { value: "$2.4M", label: "Year 5 Revenue" },
    { value: "6", label: "Core SKUs" }
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
              <Link href="#products" className="text-gray-700 hover:text-green-600 transition-colors">Products</Link>
              <Link href="#about" className="text-gray-700 hover:text-green-600 transition-colors">About</Link>
              <Link href="#sustainability" className="text-gray-700 hover:text-green-600 transition-colors">Sustainability</Link>
              <Link href="#contact" className="text-gray-700 hover:text-green-600 transition-colors">Contact</Link>
              <Link 
                href="/WMS" 
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Package className="w-4 h-4" />
                <span>WMS Portal</span>
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
              <Link href="#products" className="block text-gray-700 hover:text-green-600">Products</Link>
              <Link href="#about" className="block text-gray-700 hover:text-green-600">About</Link>
              <Link href="#sustainability" className="block text-gray-700 hover:text-green-600">Sustainability</Link>
              <Link href="#contact" className="block text-gray-700 hover:text-green-600">Contact</Link>
              <Link 
                href="/WMS" 
                className="block px-4 py-2 bg-green-600 text-white rounded-lg text-center hover:bg-green-700"
              >
                WMS Portal
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-green-50 to-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Professional Drop Cloths at
                <span className="text-green-600"> Unbeatable Prices</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                America's leading sustainable drop cloth manufacturer, delivering professional-grade protection 
                with 25-30% savings through our direct-to-consumer model.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href="#products" 
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <span>Shop Products</span>
                  <ArrowRight className="w-5 h-5" />
                </a>
                <a 
                  href="#contact" 
                  className="px-8 py-3 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors flex items-center justify-center"
                >
                  Get Wholesale Quote
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-green-600/20 rounded-3xl blur-3xl" />
              <div className="relative bg-white rounded-3xl shadow-2xl p-8 border border-green-100">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                    <Shield className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Targon Shield™</h3>
                  <p className="text-gray-600 mt-2">Premium Protection You Can Trust</p>
                </div>
                <div className="space-y-4">
                  {["Made from recycled materials", "GRS certified sustainable", "Amazon Climate Pledge Friendly", "Professional contractor approved"].map((item, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
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

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose Targon Global?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're revolutionizing the drop cloth industry with sustainable materials, 
              competitive pricing, and uncompromising quality.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Product Line
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Professional-grade drop cloths designed for every project and budget
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-8">
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Package className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 text-center">{product.name}</h3>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-4">{product.description}</p>
                  <ul className="space-y-2 mb-6">
                    {product.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-green-600">{product.price}</span>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      Order Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sustainability Section */}
      <section id="sustainability" className="py-20 bg-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Leading the Way in Sustainable Protection
              </h2>
              <p className="text-xl text-gray-600 mb-6">
                As the only recycled drop cloth brand qualifying for Amazon's Climate Pledge Friendly program, 
                we're committed to environmental responsibility without compromising quality.
              </p>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">GRS Certified Materials</h3>
                    <p className="text-gray-600">Global Recycled Standard certification ensures our materials meet the highest sustainability standards</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">20-30% Cost Reduction</h3>
                    <p className="text-gray-600">Recycled materials reduce production costs, allowing us to pass savings directly to customers</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Environmental Impact</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Recycled Content</span>
                    <span className="font-bold text-green-600">100%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-600 h-3 rounded-full" style={{width: '100%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Carbon Footprint Reduction</span>
                    <span className="font-bold text-green-600">75%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-600 h-3 rounded-full" style={{width: '75%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Waste Diverted from Landfills</span>
                    <span className="font-bold text-green-600">90%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-600 h-3 rounded-full" style={{width: '90%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built on Experience, Driven by Innovation
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              With proven expertise from building a successful UK drop cloth business, 
              we're bringing operational excellence to the American market.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Global Experience</h3>
              <p className="text-gray-600">4 years as COO of successful UK drop cloth company</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Proven Growth</h3>
              <p className="text-gray-600">Built business from startup to profitability</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">U.S. Job Creation</h3>
              <p className="text-gray-600">Committed to hiring 5+ full-time U.S. employees by Year 5</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-green-600 to-green-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Save on Your Next Project?
          </h2>
          <p className="text-xl text-green-100 mb-8">
            Join thousands of satisfied customers who trust Targon Shield™ for professional protection at unbeatable prices.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="#contact" 
              className="px-8 py-3 bg-white text-green-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
            >
              Get Started Today
            </a>
            <a 
              href="/WMS" 
              className="px-8 py-3 border-2 border-white text-white rounded-lg hover:bg-white/10 transition-colors font-semibold"
            >
              Partner Portal
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
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Request a Quote</h3>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600">
                    <option>Select...</option>
                    <option>Retailer</option>
                    <option>Contractor</option>
                    <option>Distributor</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                    rows={4}
                    placeholder="Tell us about your needs..."
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Send Quote Request
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
              <h4 className="font-semibold mb-4">Products</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Plastic Drop Cloths</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Canvas Drop Cloths</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Bulk Orders</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#sustainability" className="hover:text-white transition-colors">Sustainability</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/WMS" className="hover:text-white transition-colors">Partner Portal</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Wholesale</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms & Conditions</a></li>
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