'use client'

import Link from 'next/link'
import { 
  Shield, Package, CheckCircle, TrendingDown, Award,
  ArrowRight, Phone, Mail, Star, Menu, X, Truck,
  Clock, Users, ShoppingCart, Home, Palette, Building2
} from 'lucide-react'
import { useState } from 'react'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const products = [
    {
      name: "Standard Plastic Drop Cloth",
      description: "12' x 9' • 7 Micron • Clear",
      features: ["108 sq ft coverage", "Lightweight", "Single-use friendly"],
      image: "/api/placeholder/400/300",
      options: [
        { pack: "6-Pack", price: "$6.99", perUnit: "$1.17/sheet" },
        { pack: "12-Pack", price: "$12.99", perUnit: "$1.08/sheet", savings: "Save 8%" }
      ],
      badge: "Best Value"
    },
    {
      name: "Heavy-Duty Plastic Drop Cloth",
      description: "12' x 9' • 32 Micron • Clear",
      features: ["Professional grade", "Tear-resistant", "Reusable"],
      image: "/api/placeholder/400/300",
      options: [
        { pack: "1-Pack", price: "$7.99", perUnit: "$7.99/sheet" },
        { pack: "3-Pack", price: "$14.99", perUnit: "$5.00/sheet", savings: "Save 37%" }
      ],
      badge: "Contractor Choice"
    },
    {
      name: "Cotton Drop Cloth",
      description: "12' x 9' • 8oz/sqyd • Natural",
      features: ["Washable & reusable", "Absorbent", "Non-slip"],
      image: "/api/placeholder/400/300",
      options: [
        { pack: "1-Pack", price: "$19.99", perUnit: "$19.99/sheet" },
        { pack: "2-Pack", price: "$34.99", perUnit: "$17.50/sheet", savings: "Save 13%" }
      ],
      badge: "Premium Choice"
    }
  ]

  const benefits = [
    {
      icon: TrendingDown,
      title: "25-30% Less Than Competitors",
      description: "Professional quality at DIY prices"
    },
    {
      icon: Award,
      title: "Amazon Climate Pledge Friendly",
      description: "The only pro-grade recycled drop cloths"
    },
    {
      icon: Truck,
      title: "Fast US Shipping",
      description: "2-4 day delivery from our Texas warehouse"
    },
    {
      icon: Users,
      title: "Trusted by Pros & DIYers",
      description: "Used on thousands of projects nationwide"
    }
  ]

  return (
    <div className="relative min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold text-gray-900">Targon Shield</span>
                  <span className="hidden sm:block text-xs text-gray-600">Professional Drop Cloths</span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#products" className="text-gray-700 hover:text-blue-600 transition-colors">Products</Link>
              <Link href="#why-targon" className="text-gray-700 hover:text-blue-600 transition-colors">Why Targon</Link>
              <Link href="#reviews" className="text-gray-700 hover:text-blue-600 transition-colors">Reviews</Link>
              <Link href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors">Contact</Link>
              <Link 
                href="#products" 
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Shop Now</span>
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
              <Link href="#products" className="block text-gray-700 hover:text-blue-600">Products</Link>
              <Link href="#why-targon" className="block text-gray-700 hover:text-blue-600">Why Targon</Link>
              <Link href="#reviews" className="block text-gray-700 hover:text-blue-600">Reviews</Link>
              <Link href="#contact" className="block text-gray-700 hover:text-blue-600">Contact</Link>
              <Link 
                href="#products" 
                className="block px-4 py-2 bg-blue-600 text-white rounded-lg text-center hover:bg-blue-700"
              >
                Shop Now
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium mb-6">
                <Award className="w-4 h-4" />
                <span>Amazon Climate Pledge Friendly</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Professional Drop Cloths at 
                <span className="text-blue-600"> 25-30% Less</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Protect your floors and furniture during any painting or renovation project. 
                Trusted by professional contractors and DIY homeowners across America.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href="#products" 
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 text-lg font-semibold"
                >
                  <span>Shop Drop Cloths</span>
                  <ArrowRight className="w-5 h-5" />
                </a>
                <a 
                  href="#bulk" 
                  className="px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center text-lg font-semibold"
                >
                  <Building2 className="w-5 h-5 mr-2" />
                  <span>Bulk Orders</span>
                </a>
              </div>
              <div className="flex items-center space-x-6 mt-8">
                <div className="flex items-center">
                  <div className="flex -space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="ml-2 text-gray-700 font-medium">4.8/5 (2,847 reviews)</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-600 mb-2">Featured Product</p>
                  <h3 className="text-2xl font-bold text-gray-900">Heavy-Duty 3-Pack</h3>
                  <p className="text-3xl font-bold text-blue-600 mt-2">$14.99</p>
                  <p className="text-sm text-gray-500 line-through">$23.97</p>
                  <p className="text-green-600 font-medium">Save $8.98 (37%)</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">3 sheets (12' x 9' each)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">32 Micron professional grade</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">Reusable & tear-resistant</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">324 sq ft total coverage</span>
                  </li>
                </ul>
                <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                  Add to Cart
                </button>
                <p className="text-center text-sm text-gray-600 mt-4">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Ships within 24 hours
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex flex-col items-center text-center">
                <benefit.icon className="w-8 h-8 text-blue-600 mb-2" />
                <h3 className="font-semibold text-gray-900 text-sm">{benefit.title}</h3>
                <p className="text-xs text-gray-600 mt-1">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Drop Cloth
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From quick DIY projects to professional jobs, we have the right protection for every need
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {product.badge && (
                  <div className="bg-blue-600 text-white text-center py-2 text-sm font-medium">
                    {product.badge}
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-gray-600 mb-4">{product.description}</p>
                  
                  <ul className="space-y-2 mb-6">
                    {product.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-3">
                    {product.options.map((option, oIndex) => (
                      <div key={oIndex} className={`border rounded-lg p-4 ${option.savings ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-900">{option.pack}</h4>
                            <p className="text-sm text-gray-600">{option.perUnit}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-gray-900">{option.price}</p>
                            {option.savings && (
                              <p className="text-sm text-green-600 font-medium">{option.savings}</p>
                            )}
                          </div>
                        </div>
                        <button className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium">
                          Add to Cart
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">Need custom sizes or bulk quantities?</p>
            <Link href="#contact" className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-semibold">
              <Phone className="w-5 h-5" />
              <span>Call 1-800-TARGON1 for custom orders</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Perfect For Every Project
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Home Projects</h3>
              <p className="text-gray-600">Interior painting, furniture refinishing, and weekend DIY projects</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Palette className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Professional Painting</h3>
              <p className="text-gray-600">Commercial painting jobs, apartment turnovers, and contractor work</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Construction Sites</h3>
              <p className="text-gray-600">Floor protection during renovations, drywall work, and demolition</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Targon */}
      <section id="why-targon" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Why Professionals Choose Targon Shield
              </h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Eco-Friendly Without Compromise</h3>
                    <p className="text-gray-600">Made from recycled materials with Global Recycled Standard certification. Same quality as virgin plastic at a lower cost.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Unbeatable Value</h3>
                    <p className="text-gray-600">Direct-to-consumer model means you save 25-30% compared to big box stores. Professional quality at DIY prices.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Trusted by Thousands</h3>
                    <p className="text-gray-600">From weekend warriors to professional contractors, our drop cloths protect millions of square feet every year.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Compare & Save</h3>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">Big Box Store</p>
                      <p className="text-sm text-gray-600">12x9 Heavy-Duty Drop Cloth</p>
                    </div>
                    <p className="text-xl font-bold text-gray-500">$11.99</p>
                  </div>
                </div>
                <div className="bg-blue-600 text-white rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">Targon Shield</p>
                      <p className="text-sm text-blue-100">Same Quality, Better Price</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">$7.99</p>
                      <p className="text-sm text-blue-100">Save $4.00</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center mt-6 text-gray-700 font-medium">
                That's 33% savings on every drop cloth!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            What Our Customers Say
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">"Best drop cloths I've used in 20 years of painting. The heavy-duty ones are actually reusable unlike other brands."</p>
              <p className="font-semibold text-gray-900">Mike R.</p>
              <p className="text-sm text-gray-600">Professional Painter</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">"Perfect for my weekend projects. Love that they're eco-friendly and the price is unbeatable. Will buy again!"</p>
              <p className="font-semibold text-gray-900">Sarah L.</p>
              <p className="text-sm text-gray-600">DIY Homeowner</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">"We order in bulk for our contracting business. Quality is consistent and delivery is always on time. Great supplier!"</p>
              <p className="font-semibold text-gray-900">Johnson Construction</p>
              <p className="text-sm text-gray-600">General Contractor</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Save on Your Next Project?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of satisfied customers who trust Targon Shield for professional protection at unbeatable prices.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="#products" 
              className="px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold flex items-center justify-center"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Shop Drop Cloths
            </a>
            <a 
              href="tel:1-800-TARGON1" 
              className="px-8 py-3 border-2 border-white text-white rounded-lg hover:bg-white/10 transition-colors font-semibold flex items-center justify-center"
            >
              <Phone className="w-5 h-5 mr-2" />
              1-800-TARGON1
            </a>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Need Help? Get in Touch</h2>
              <p className="text-lg text-gray-600 mb-8">
                Questions about our products? Need a custom quote for bulk orders? Our team is here to help.
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Phone className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Call Us</p>
                    <a href="tel:1-800-TARGON1" className="text-blue-600 hover:text-blue-700">1-800-TARGON1</a>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Mail className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Email</p>
                    <a href="mailto:sales@targonshield.com" className="text-blue-600 hover:text-blue-700">sales@targonshield.com</a>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Clock className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Business Hours</p>
                    <p className="text-gray-600">Mon-Fri: 8AM-6PM CST</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Get a Quote</h3>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    rows={4}
                    placeholder="Tell us about your needs..."
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Send Message
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
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">Targon Shield</span>
              </div>
              <p className="text-gray-400">
                Professional drop cloths at unbeatable prices.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Products</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Plastic Drop Cloths</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cotton Drop Cloths</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Bulk Orders</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Shipping Info</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Call: 1-800-TARGON1</li>
                <li>Email: sales@targonshield.com</li>
                <li>Mon-Fri: 8AM-6PM CST</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Targon LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}