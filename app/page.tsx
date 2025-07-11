'use client'

import Link from 'next/link'
import { 
  Shield, Package, CheckCircle, TrendingDown, Award,
  ArrowRight, Phone, Mail, Star, Menu, X, Truck,
  Clock, Users, ShoppingCart, Home as HomeIcon, Palette, Building2,
  Zap, Target, Lightbulb, Wrench, Factory, Globe, Heart,
  TrendingUp, ShieldCheck, Leaf, DollarSign
} from 'lucide-react'
import { useState } from 'react'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const divisions = [
    {
      name: "Manufacturing",
      icon: Factory,
      description: "State-of-the-art facilities producing sustainable materials",
      capabilities: ["Plastic extrusion", "Textile processing", "Quality control"]
    },
    {
      name: "Distribution",
      icon: Truck,
      description: "Nationwide logistics network ensuring timely delivery",
      capabilities: ["24-hour fulfillment", "Bulk shipping", "Inventory management"]
    },
    {
      name: "Innovation",
      icon: Lightbulb,
      description: "R&D focused on sustainable materials and processes",
      capabilities: ["Material science", "Process optimization", "Sustainability research"]
    }
  ]

  const values = [
    {
      icon: Zap,
      title: "Efficiency",
      description: "Solving everyday problems better"
    },
    {
      icon: Target,
      title: "Simplicity",
      description: "Reducing complexity in every interaction"
    },
    {
      icon: Users,
      title: "Empowerment",
      description: "Enabling right decisions for our partners"
    },
    {
      icon: Leaf,
      title: "Sustainability",
      description: "Building tomorrow's solutions today"
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
                  <span className="hidden sm:block text-xs text-gray-600">Everyday, Done Better</span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#about" className="text-gray-700 hover:text-[#012D44] transition-colors font-medium">About</Link>
              <Link href="#divisions" className="text-gray-700 hover:text-[#012D44] transition-colors font-medium">Divisions</Link>
              <Link href="#impact" className="text-gray-700 hover:text-[#012D44] transition-colors font-medium">Impact</Link>
              <Link href="#contact" className="text-gray-700 hover:text-[#012D44] transition-colors font-medium">Contact</Link>
              <Link 
                href="#solutions" 
                className="px-6 py-2.5 bg-[#012D44] text-white rounded hover:bg-[#011f2e] transition-colors font-medium"
              >
                Our Solutions
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
              <Link href="#about" className="block text-gray-700 hover:text-[#012D44] font-medium">About</Link>
              <Link href="#divisions" className="block text-gray-700 hover:text-[#012D44] font-medium">Divisions</Link>
              <Link href="#impact" className="block text-gray-700 hover:text-[#012D44] font-medium">Impact</Link>
              <Link href="#contact" className="block text-gray-700 hover:text-[#012D44] font-medium">Contact</Link>
              <Link 
                href="#solutions" 
                className="block px-4 py-2.5 bg-[#012D44] text-white rounded text-center hover:bg-[#011f2e] font-medium"
              >
                Our Solutions
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative bg-[#E6FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-[#012D44] mb-6">
              Solving Everyday Problems.
              <span className="block text-3xl md:text-5xl mt-2">Better.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto">
              At Targon, we simplify complexities to empower our partners with 
              the simplest choices and most efficient solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <a 
                href="#about" 
                className="px-8 py-3 bg-[#012D44] text-white rounded hover:bg-[#011f2e] transition-colors text-lg font-medium"
              >
                Learn About Us
              </a>
              <a 
                href="#divisions" 
                className="px-8 py-3 border-2 border-[#012D44] text-[#012D44] rounded hover:bg-white transition-colors text-lg font-medium"
              >
                Our Divisions
              </a>
            </div>
            <div className="grid grid-cols-4 gap-8 max-w-2xl mx-auto">
              <div>
                <p className="text-3xl font-bold text-[#012D44]">30+</p>
                <p className="text-sm text-gray-600">Years of Innovation</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#012D44]">3</p>
                <p className="text-sm text-gray-600">Core Divisions</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#012D44]">50M+</p>
                <p className="text-sm text-gray-600">Products Delivered</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#012D44]">100%</p>
                <p className="text-sm text-gray-600">US Operations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-[#012D44] text-center mb-12">Our Core Values</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-[#E6FAFF] rounded-full flex items-center justify-center mx-auto mb-3">
                  <value.icon className="w-6 h-6 text-[#012D44]" />
                </div>
                <h3 className="font-semibold text-[#012D44] text-sm mb-1">{value.title}</h3>
                <p className="text-xs text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#012D44] mb-6">
                Who We Are
              </h2>
              <div className="space-y-6 text-gray-700">
                <p className="text-lg">
                  Targon is a sustainable manufacturing company dedicated to solving 
                  everyday problems through innovative, efficient solutions.
                </p>
                <div>
                  <h3 className="font-semibold text-[#012D44] mb-2">Our Purpose</h3>
                  <p>We exist to simplify the complexities of modern life by providing tools and solutions that empower better decisions.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-[#012D44] mb-2">Our Approach</h3>
                  <p>We dive deep into the details to understand real problems, then engineer simple, sustainable solutions that just work.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-[#012D44] mb-2">Our Promise</h3>
                  <p>Every Targon product is designed with efficiency, simplicity, and sustainability at its core. No complexity, no waste.</p>
                </div>
              </div>
            </div>
            <div className="bg-[#E6FAFF] rounded-lg p-10">
              <h3 className="text-2xl font-bold text-[#012D44] mb-8 text-center">By the Numbers</h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center py-3 border-b border-[#012D44]/10">
                  <span className="text-gray-700">Founded</span>
                  <span className="font-bold text-[#012D44] text-xl">1993</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-[#012D44]/10">
                  <span className="text-gray-700">Team Members</span>
                  <span className="font-bold text-[#012D44] text-xl">200+</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-[#012D44]/10">
                  <span className="text-gray-700">Products Shipped</span>
                  <span className="font-bold text-[#012D44] text-xl">50M+</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-700">Carbon Neutral Since</span>
                  <span className="font-bold text-[#012D44] text-xl">2020</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divisions Section */}
      <section id="divisions" className="py-20 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#012D44] mb-4">
              Our Divisions
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Three focused divisions working together to deliver comprehensive solutions 
              for everyday challenges.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {divisions.map((division, index) => (
              <div key={index} className="bg-white rounded-lg p-8 border border-gray-200">
                <div className="w-16 h-16 bg-[#E6FAFF] rounded-lg flex items-center justify-center mb-6">
                  <division.icon className="w-8 h-8 text-[#012D44]" />
                </div>
                <h3 className="text-xl font-bold text-[#012D44] mb-3">{division.name}</h3>
                <p className="text-gray-700 mb-6">{division.description}</p>
                <div className="space-y-2">
                  {division.capabilities.map((capability, cIndex) => (
                    <div key={cIndex} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-[#012D44] rounded-full mt-1.5"></div>
                      <span className="text-sm text-gray-600">{capability}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#012D44] mb-4">
              Solutions That Work
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              From protective materials to logistics solutions, we make everyday tasks simpler and more efficient.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white rounded-lg p-8 border border-gray-200">
              <h3 className="text-2xl font-bold text-[#012D44] mb-4">For Businesses</h3>
              <p className="text-gray-700 mb-6">
                Streamline your operations with our B2B solutions designed for efficiency at scale.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#012D44] mt-0.5" />
                  <span className="text-gray-700">Bulk ordering with volume discounts</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#012D44] mt-0.5" />
                  <span className="text-gray-700">Custom product specifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#012D44] mt-0.5" />
                  <span className="text-gray-700">Dedicated account management</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#012D44] mt-0.5" />
                  <span className="text-gray-700">Just-in-time delivery</span>
                </li>
              </ul>
              <Link href="#contact" className="inline-flex items-center gap-2 text-[#012D44] hover:underline font-medium">
                Learn More <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-white rounded-lg p-8 border border-gray-200">
              <h3 className="text-2xl font-bold text-[#012D44] mb-4">For Individuals</h3>
              <p className="text-gray-700 mb-6">
                Quality products designed for your projects, available when you need them.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#012D44] mt-0.5" />
                  <span className="text-gray-700">Simple product selection</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#012D44] mt-0.5" />
                  <span className="text-gray-700">24-hour shipping</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#012D44] mt-0.5" />
                  <span className="text-gray-700">Eco-friendly materials</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#012D44] mt-0.5" />
                  <span className="text-gray-700">Fair, transparent pricing</span>
                </li>
              </ul>
              <Link href="/products" className="inline-flex items-center gap-2 text-[#012D44] hover:underline font-medium">
                View Products <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="impact" className="py-20 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#012D44] mb-4">
              Our Impact
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Measuring success not just in products delivered, but in problems solved and futures protected.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#E6FAFF] rounded-full flex items-center justify-center mx-auto mb-4">
                <Leaf className="w-8 h-8 text-[#012D44]" />
              </div>
              <p className="text-4xl font-bold text-[#012D44] mb-2">85%</p>
              <p className="text-sm text-gray-700">Products from recycled materials</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#E6FAFF] rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[#012D44]" />
              </div>
              <p className="text-4xl font-bold text-[#012D44] mb-2">2M+</p>
              <p className="text-sm text-gray-700">Customers served annually</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#E6FAFF] rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-[#012D44]" />
              </div>
              <p className="text-4xl font-bold text-[#012D44] mb-2">30%</p>
              <p className="text-sm text-gray-700">Average customer savings</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#E6FAFF] rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-[#012D44]" />
              </div>
              <p className="text-4xl font-bold text-[#012D44] mb-2">100%</p>
              <p className="text-sm text-gray-700">Carbon neutral operations</p>
            </div>
          </div>
          <div className="bg-[#012D44] text-white rounded-lg p-12 text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Building a Better Tomorrow
            </h3>
            <p className="text-lg text-[#E6FAFF] max-w-3xl mx-auto mb-8">
              Every decision we make is guided by our commitment to efficiency, 
              sustainability, and empowering our partners to succeed.
            </p>
            <Link href="/sustainability" className="inline-flex items-center gap-2 text-white hover:text-[#E6FAFF] font-medium">
              Learn About Our Commitments <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[#012D44] text-center mb-16">
            Trusted Partners
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg p-8 border border-gray-200">
              <p className="text-gray-700 mb-6 italic">
                "Targon transformed our supply chain. Their efficiency-first approach 
                reduced our material costs by 35% while improving product quality. 
                They're not just a supplier, they're a strategic partner."
              </p>
              <div>
                <p className="font-semibold text-[#012D44]">Jennifer Martinez</p>
                <p className="text-sm text-gray-600">VP Operations, BuildRight Construction</p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-8 border border-gray-200">
              <p className="text-gray-700 mb-6 italic">
                "In 10 years of partnership, Targon has never missed a delivery. 
                Their commitment to simplicity and reliability has made them an 
                essential part of our business operations."
              </p>
              <div>
                <p className="font-semibold text-[#012D44]">Robert Chen</p>
                <p className="text-sm text-gray-600">CEO, Premier Painting Solutions</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#012D44]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Simplify?
          </h2>
          <p className="text-lg text-[#E6FAFF] mb-10">
            Let's solve your everyday challenges together.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="#contact" 
              className="px-8 py-3 bg-white text-[#012D44] rounded hover:bg-[#E6FAFF] transition-colors font-medium"
            >
              Start a Conversation
            </a>
            <a 
              href="#divisions" 
              className="px-8 py-3 border-2 border-white text-white rounded hover:bg-white/10 transition-colors font-medium"
            >
              Explore Our Capabilities
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
              <h3 className="text-xl font-bold text-[#012D44] mb-6">Start a Conversation</h3>
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
                    placeholder="Tell us about your challenge"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full px-6 py-3 bg-[#012D44] text-white rounded hover:bg-[#011f2e] transition-colors font-medium"
                >
                  Send Message
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
                  <p className="text-sm text-[#E6FAFF]">Everyday, Done Better</p>
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
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#divisions" className="hover:text-white transition-colors">Our Divisions</a></li>
                <li><a href="#solutions" className="hover:text-white transition-colors">Solutions</a></li>
                <li><a href="#impact" className="hover:text-white transition-colors">Our Impact</a></li>
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