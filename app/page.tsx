'use client'

import Link from 'next/link'
import { 
  Shield, Package, CheckCircle, TrendingDown, Award,
  ArrowRight, Phone, Mail, Star, Menu, X, Truck,
  Clock, Users, ShoppingCart, Home as HomeIcon, Palette, Building2,
  Zap, Target, Lightbulb
} from 'lucide-react'
import { useState } from 'react'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const products = [
    {
      name: "Standard Drop Cloth",
      description: "12' x 9' • 7 Micron • Clear Plastic",
      features: ["Covers 108 sq ft", "Light & portable", "Single project use"],
      image: "/api/placeholder/400/300",
      options: [
        { pack: "6-Pack", price: "$6.99", perUnit: "$1.17 each" },
        { pack: "12-Pack", price: "$12.99", perUnit: "$1.08 each", savings: "8% savings" }
      ],
      badge: "Most Efficient"
    },
    {
      name: "Professional Drop Cloth",
      description: "12' x 9' • 32 Micron • Heavy-Duty Plastic",
      features: ["4x thicker", "Tear-resistant", "Multi-project use"],
      image: "/api/placeholder/400/300",
      options: [
        { pack: "1-Pack", price: "$7.99", perUnit: "$7.99 each" },
        { pack: "3-Pack", price: "$14.99", perUnit: "$5.00 each", savings: "37% savings" }
      ],
      badge: "Built to Last"
    },
    {
      name: "Reusable Canvas Drop Cloth",
      description: "12' x 9' • 8oz Cotton Canvas",
      features: ["Machine washable", "Absorbs spills", "Stays in place"],
      image: "/api/placeholder/400/300",
      options: [
        { pack: "1-Pack", price: "$19.99", perUnit: "$19.99 each" },
        { pack: "2-Pack", price: "$34.99", perUnit: "$17.50 each", savings: "13% savings" }
      ],
      badge: "Long-term Value"
    }
  ]

  const benefits = [
    {
      icon: Zap,
      title: "Efficient Coverage",
      description: "Right size, right price, no waste"
    },
    {
      icon: Target,
      title: "Simple Selection",
      description: "Three options. Easy choice."
    },
    {
      icon: Award,
      title: "Eco-Certified",
      description: "Recycled materials, same quality"
    },
    {
      icon: Clock,
      title: "Ships in 24 Hours",
      description: "In stock, ready to go"
    }
  ]

  return (
    <div className="relative min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#012D44] rounded flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold text-[#012D44]">Targon</span>
                  <span className="hidden sm:block text-xs text-gray-600">Drop Cloths Done Better</span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#products" className="text-gray-700 hover:text-[#012D44] transition-colors font-medium">Products</Link>
              <Link href="#why-targon" className="text-gray-700 hover:text-[#012D44] transition-colors font-medium">Why Choose Us</Link>
              <Link href="#contact" className="text-gray-700 hover:text-[#012D44] transition-colors font-medium">Contact</Link>
              <Link 
                href="#products" 
                className="px-6 py-2.5 bg-[#012D44] text-white rounded hover:bg-[#011f2e] transition-colors font-medium"
              >
                Shop Drop Cloths
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
          <div className="md:hidden bg-white border-t border-gray-100">
            <div className="px-4 py-4 space-y-4">
              <Link href="#products" className="block text-gray-700 hover:text-[#012D44] font-medium">Products</Link>
              <Link href="#why-targon" className="block text-gray-700 hover:text-[#012D44] font-medium">Why Choose Us</Link>
              <Link href="#contact" className="block text-gray-700 hover:text-[#012D44] font-medium">Contact</Link>
              <Link 
                href="#products" 
                className="block px-4 py-2.5 bg-[#012D44] text-white rounded text-center hover:bg-[#011f2e] font-medium"
              >
                Shop Drop Cloths
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative bg-[#E6FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#012D44] mb-4">
                Paint Protection.
                <span className="block">Done Better.</span>
              </h1>
              <p className="text-xl text-gray-700 mb-8">
                Simple choices. Right sizes. Fair prices. 
                The drop cloth you need, nothing you don't.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href="#products" 
                  className="px-8 py-3 bg-[#012D44] text-white rounded hover:bg-[#011f2e] transition-colors text-lg font-medium"
                >
                  View Products
                </a>
                <a 
                  href="#bulk" 
                  className="px-8 py-3 border-2 border-[#012D44] text-[#012D44] rounded hover:bg-[#E6FAFF] transition-colors text-lg font-medium"
                >
                  Bulk Pricing
                </a>
              </div>
              <div className="flex items-center gap-8 mt-10">
                <div>
                  <p className="text-3xl font-bold text-[#012D44]">$6.99</p>
                  <p className="text-sm text-gray-600">Starting at</p>
                </div>
                <div className="h-12 w-px bg-gray-300"></div>
                <div>
                  <p className="text-3xl font-bold text-[#012D44]">24hr</p>
                  <p className="text-sm text-gray-600">Ships within</p>
                </div>
                <div className="h-12 w-px bg-gray-300"></div>
                <div>
                  <p className="text-3xl font-bold text-[#012D44]">4.8★</p>
                  <p className="text-sm text-gray-600">2,847 reviews</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
                <div className="mb-6">
                  <div className="text-sm text-gray-600 mb-2">Most Popular</div>
                  <h3 className="text-2xl font-bold text-[#012D44] mb-4">Professional 3-Pack</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-gray-600">Regular price</span>
                      <span className="text-gray-500 line-through">$23.97</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-[#012D44]">Your price</span>
                      <span className="text-3xl font-bold text-[#012D44]">$14.99</span>
                    </div>
                    <div className="bg-green-50 text-green-700 px-3 py-2 rounded text-center">
                      You save $8.98 (37%)
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mb-6 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-[#012D44] rounded-full mt-1.5"></div>
                    <span className="text-gray-700">3 heavy-duty sheets (12' × 9')</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-[#012D44] rounded-full mt-1.5"></div>
                    <span className="text-gray-700">32 micron thickness</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-[#012D44] rounded-full mt-1.5"></div>
                    <span className="text-gray-700">Reusable for multiple projects</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-[#012D44] rounded-full mt-1.5"></div>
                    <span className="text-gray-700">324 sq ft total coverage</span>
                  </div>
                </div>
                <button className="w-full px-6 py-3 bg-[#012D44] text-white rounded hover:bg-[#011f2e] transition-colors font-medium">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-[#E6FAFF] rounded-full flex items-center justify-center mx-auto mb-3">
                  <benefit.icon className="w-6 h-6 text-[#012D44]" />
                </div>
                <h3 className="font-semibold text-[#012D44] text-sm mb-1">{benefit.title}</h3>
                <p className="text-xs text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#012D44] mb-4">
              Three Options. Simple Choice.
            </h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              We've done the research. These are the only drop cloths you'll ever need.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {product.badge && (
                  <div className="bg-[#E6FAFF] text-[#012D44] text-center py-2 text-sm font-medium border-b border-gray-200">
                    {product.badge}
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#012D44] mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-6">{product.description}</p>
                  
                  <div className="space-y-2 mb-6 text-sm">
                    {product.features.map((feature, fIndex) => (
                      <div key={fIndex} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-[#012D44] rounded-full mt-1.5"></div>
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {product.options.map((option, oIndex) => (
                      <div key={oIndex} className={`border rounded p-4 ${option.savings ? 'border-[#012D44] bg-[#E6FAFF]' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-baseline mb-3">
                          <div>
                            <h4 className="font-semibold text-[#012D44]">{option.pack}</h4>
                            <p className="text-sm text-gray-600">{option.perUnit}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#012D44]">{option.price}</p>
                            {option.savings && (
                              <p className="text-sm text-[#00a651] font-medium">{option.savings}</p>
                            )}
                          </div>
                        </div>
                        <button className="w-full px-4 py-2 bg-[#012D44] text-white rounded hover:bg-[#011f2e] transition-colors text-sm font-medium">
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 bg-[#E6FAFF] rounded-lg p-8 text-center">
            <h3 className="text-xl font-semibold text-[#012D44] mb-2">Need something different?</h3>
            <p className="text-gray-700 mb-4">Custom sizes and bulk orders available.</p>
            <Link href="#contact" className="inline-flex items-center gap-2 text-[#012D44] hover:underline font-medium">
              <Phone className="w-5 h-5" />
              <span>Call 1-800-TARGON1</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[#012D44] text-center mb-16">
            Right Tool. Right Job.
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="w-12 h-12 bg-[#E6FAFF] rounded flex items-center justify-center mb-4">
                <HomeIcon className="w-6 h-6 text-[#012D44]" />
              </div>
              <h3 className="text-lg font-semibold text-[#012D44] mb-2">Weekend DIY</h3>
              <p className="text-gray-700 text-sm">Quick room painting. Furniture projects. One-time use.</p>
              <p className="text-sm font-medium text-[#012D44] mt-3">→ Standard 6-Pack</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-[#E6FAFF] rounded flex items-center justify-center mb-4">
                <Palette className="w-6 h-6 text-[#012D44]" />
              </div>
              <h3 className="text-lg font-semibold text-[#012D44] mb-2">Professional Jobs</h3>
              <p className="text-gray-700 text-sm">Multiple rooms. Client projects. Need durability.</p>
              <p className="text-sm font-medium text-[#012D44] mt-3">→ Professional 3-Pack</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-[#E6FAFF] rounded flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-[#012D44]" />
              </div>
              <h3 className="text-lg font-semibold text-[#012D44] mb-2">Repeat Use</h3>
              <p className="text-gray-700 text-sm">Workshop protection. Regular projects. Long-term value.</p>
              <p className="text-sm font-medium text-[#012D44] mt-3">→ Canvas Drop Cloth</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Targon */}
      <section id="why-targon" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#012D44] mb-8">
                Why We're Different
              </h2>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#E6FAFF] rounded flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-[#012D44]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#012D44]">We Did the Research</h3>
                  </div>
                  <p className="text-gray-700 ml-13">Three products cover 99% of needs. No confusing choices.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#E6FAFF] rounded flex items-center justify-center">
                      <Target className="w-5 h-5 text-[#012D44]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#012D44]">Direct to You</h3>
                  </div>
                  <p className="text-gray-700 ml-13">No middleman markup. Same quality, 30% less cost.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#E6FAFF] rounded flex items-center justify-center">
                      <Award className="w-5 h-5 text-[#012D44]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#012D44]">Certified Sustainable</h3>
                  </div>
                  <p className="text-gray-700 ml-13">Recycled materials. Same performance. Better for tomorrow.</p>
                </div>
              </div>
            </div>
            <div>
              <div className="bg-[#E6FAFF] rounded-lg p-8">
                <h3 className="text-2xl font-bold text-[#012D44] mb-6">The Math is Simple</h3>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center py-3 border-b border-[#012D44]/10">
                    <span className="text-gray-700">Their Price (12x9 Heavy-Duty)</span>
                    <span className="font-semibold text-gray-700">$11.99</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#012D44]/10">
                    <span className="text-[#012D44] font-medium">Our Price (Same Quality)</span>
                    <span className="font-bold text-[#012D44] text-xl">$7.99</span>
                  </div>
                  <div className="flex justify-between items-center pt-3">
                    <span className="font-semibold text-green-700">You Save</span>
                    <span className="font-bold text-green-700 text-xl">$4.00 (33%)</span>
                  </div>
                </div>
                <p className="text-sm text-[#012D44] text-center font-medium">
                  Every. Single. Time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-20 bg-[#fafbfc]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[#012D44] text-center mb-16">
            Real Reviews. Real Results.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#012D44] text-[#012D44]" />
                ))}
              </div>
              <p className="text-gray-700 text-sm mb-4">"Actually reusable. Unlike others that tear first use. Worth it."</p>
              <p className="font-medium text-[#012D44]">Mike R.</p>
              <p className="text-xs text-gray-600">Pro Painter • 20 years</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#012D44] text-[#012D44]" />
                ))}
              </div>
              <p className="text-gray-700 text-sm mb-4">"Simple ordering. Fair price. Does the job. What more do you need?"</p>
              <p className="font-medium text-[#012D44]">Sarah L.</p>
              <p className="text-xs text-gray-600">Homeowner</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#012D44] text-[#012D44]" />
                ))}
              </div>
              <p className="text-gray-700 text-sm mb-4">"Bulk orders arrive on time. Every time. Reliable supplier."</p>
              <p className="font-medium text-[#012D44]">Johnson & Co.</p>
              <p className="text-xs text-gray-600">Contractor</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#012D44]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Drop Cloths. Done Better.
          </h2>
          <p className="text-lg text-[#E6FAFF] mb-10">
            Stop overpaying. Start protecting smarter.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="#products" 
              className="px-8 py-3 bg-white text-[#012D44] rounded hover:bg-[#E6FAFF] transition-colors font-medium"
            >
              View Products
            </a>
            <a 
              href="tel:1-800-TARGON1" 
              className="px-8 py-3 border-2 border-white text-white rounded hover:bg-white/10 transition-colors font-medium"
            >
              Call for Bulk Orders
            </a>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl font-bold text-[#012D44] mb-8">Let's Talk</h2>
              <p className="text-gray-700 mb-10">
                Quick question? Bulk order? We're here.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#E6FAFF] rounded flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-[#012D44]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#012D44]">Phone</p>
                    <a href="tel:1-800-TARGON1" className="text-gray-700 hover:text-[#012D44]">1-800-TARGON1</a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#E6FAFF] rounded flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-[#012D44]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#012D44]">Email</p>
                    <a href="mailto:help@targon.com" className="text-gray-700 hover:text-[#012D44]">help@targon.com</a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#E6FAFF] rounded flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[#012D44]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#012D44]">Hours</p>
                    <p className="text-gray-700">Mon-Fri: 8AM-6PM CST</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-[#E6FAFF] rounded-lg p-8">
              <h3 className="text-xl font-bold text-[#012D44] mb-6">Quick Quote</h3>
              <form className="space-y-4">
                <div>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 border border-[#012D44]/20 rounded focus:outline-none focus:border-[#012D44]"
                    placeholder="Name"
                  />
                </div>
                <div>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 border border-[#012D44]/20 rounded focus:outline-none focus:border-[#012D44]"
                    placeholder="Email"
                  />
                </div>
                <div>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-3 border border-[#012D44]/20 rounded focus:outline-none focus:border-[#012D44]"
                    placeholder="Phone"
                  />
                </div>
                <div>
                  <textarea 
                    className="w-full px-4 py-3 border border-[#012D44]/20 rounded focus:outline-none focus:border-[#012D44]"
                    rows={3}
                    placeholder="How many drop cloths do you need?"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full px-6 py-3 bg-[#012D44] text-white rounded hover:bg-[#011f2e] transition-colors font-medium"
                >
                  Get Quote
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#012D44] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded flex items-center justify-center">
                  <Shield className="w-6 h-6 text-[#012D44]" />
                </div>
                <div>
                  <span className="text-xl font-bold">Targon</span>
                  <p className="text-sm text-[#E6FAFF]">Drop Cloths Done Better</p>
                </div>
              </div>
              <p className="text-[#E6FAFF] text-sm max-w-xs">
                Simple products. Fair prices. <br/>
                The protection you need, nothing more.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4 text-sm">Quick Links</h4>
              <ul className="space-y-2 text-sm text-[#E6FAFF]">
                <li><a href="#products" className="hover:text-white transition-colors">Products</a></li>
                <li><a href="#why-targon" className="hover:text-white transition-colors">Why Choose Us</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Get Quote</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4 text-sm">Contact</h4>
              <ul className="space-y-2 text-sm text-[#E6FAFF]">
                <li>1-800-TARGON1</li>
                <li>help@targon.com</li>
                <li>Mon-Fri: 8AM-6PM CST</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#E6FAFF]/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-[#E6FAFF]">&copy; 2025 Targon LLC</p>
            <p className="text-sm text-[#E6FAFF]">Everyday, Done Better.™</p>
          </div>
        </div>
      </footer>
    </div>
  )
}