'use client'

import Image from 'next/image'
import Link from 'next/link'

import { assetUrl } from '@/core-services/assets/cdn'

import ResponsiveCanvas from './responsive-canvas'
import styles from './home-page.module.css'

export default function HomePage() {
  return (
    <>
      <style jsx global>{`
        header.site-header,
        footer.site-footer {
          display: none;
        }
        body {
          background-color: #021b2b;
        }
      `}</style>
      <ResponsiveCanvas designWidth={1920}>
        <div className={`${styles.root} contain`}>
          <div className="column">
            <div className="column2">
              <div className="row-view">
                <Link href="/" className="text" aria-label="Targon home">
                  targon
                </Link>
                <div className="box" />
                <Link href="/about" className="text2">
                  about
                </Link>
                <Link href="/products" className="text3">
                  products
                </Link>
                <Link href="/ecomos" className="text4">
                  EcomOS
                </Link>
                <Link href="/news" className="text5">
                  news
                </Link>
              </div>
              <div className="box2" />
            </div>
            <div className="column3">
              <div className="column4">
                <div
                  className="view"
                  style={{
                    backgroundImage: `url(${assetUrl('/home/hero-bg.png')})`,
                  }}
                >
                  <div className="view2">
                    <span className="text6">{`Innovation\nto\nimpact`}</span>
                  </div>
                </div>
                <Image src={assetUrl('/home/hero-floating.png')} alt="" width={2366} height={2371} className="absolute-image" priority />
              </div>
              <span className="text7">{`What the world needs next\nwe are making now.`}</span>
            </div>
            <div className="column5">
              <div className="column6">
                <Image src={assetUrl('/home/circle-left.png')} alt="" width={1019} height={1019} className="image" priority />
                <Image src={assetUrl('/home/circle-center.png')} alt="" width={928} height={929} className="absolute-image2" />
              </div>
              <Image src={assetUrl('/home/circle-right.png')} alt="" width={841} height={840} className="absolute-image3" />
            </div>
            <div className="row-view2">
              <div className="column7">
                <div
                  className="column8"
                  style={{
                    backgroundImage: `url(${assetUrl('/home/testimonials-bg.png')})`,
                  }}
                >
                  <div className="row-view3">
                    <div className="column9">
                      <span className="text8">Millon Zahino</span>
                      <span className="text9">Behavioral Science</span>
                    </div>
                    <div className="column10">
                      <span className="text8">Millon Zahino</span>
                      <span className="text10">Behavioral Science</span>
                    </div>
                    <span className="text11">Behavioral Science</span>
                  </div>
                  <div className="row-view4">
                    <div className="view3">
                      <span className="text12">★ ★ ★ ★ ★</span>
                    </div>
                    <div className="view4">
                      <span className="text12">★ ★ ★ ★ ★</span>
                    </div>
                    <div className="view5">
                      <span className="text12">★ ★ ★ ★ ★</span>
                    </div>
                  </div>
                  <div className="row-view5">
                    <span className="text13">As an industrial, securing capacity and</span>
                    <span className="text14">As an industrial, securing capacity and</span>
                  </div>
                  <div className="row-view6">
                    <span className="text13">optimizing budget are key. In that perspe</span>
                    <span className="text14">optimizing budget are key. In that perspe</span>
                  </div>
                  <div className="row-view7">
                    <span className="text13">ctive, you are looking for a transport</span>
                    <span className="text14">ctive, you are looking for a transport</span>
                  </div>
                  <div className="row-view8">
                    <span className="text13">partner committed</span>
                    <span className="text14">partner committed</span>
                  </div>
                </div>
                <div className="absolute-view">
                  <Link href="/about" className="text15">
                    about us
                  </Link>
                </div>
                <span className="absolute-text">what our customers think</span>
                <span className="absolute-text2">Millon Zahino</span>
                <span className="absolute-text3">As an industrial, securing capacity and</span>
                <span className="absolute-text4">optimizing budget are key. In that perspe</span>
                <span className="absolute-text5">ctive, you are looking for a transport</span>
                <span className="absolute-text6">partner committed</span>
                <div className="absolute-column">
                  <div className="row-view9">
                    <div className="column11">
                      <span className="text16">targon</span>
                      <span className="text17">
                        Hello, we are Targon. trying to make an effort to put the right people for you to get the best
                        results. Just insight
                      </span>
                    </div>
                    <div className="column12">
                      <span className="text18">quick Links</span>
                      <Link href="/policy" className="text19">
                        Policy
                      </Link>
                      <Link href="/ecomos" className="text20">
                        EcomOS
                      </Link>
                      <Link href="/caelum-star" className="text21">
                        Caelum Star
                      </Link>
                    </div>
                    <div className="column13">
                      <span className="text22">Explore</span>
                      <Link href="/resources" className="text23">
                        Resources
                      </Link>
                      <Link href="/blog" className="text24">
                        Blog
                      </Link>
                      <Link href="/documents" className="text21">
                        Documents
                      </Link>
                    </div>
                    <div className="column14">
                      <span className="text25">Company</span>
                      <div className="column15">
                        <Link href="/about" className="text26">
                          About us
                        </Link>
                        <Link href="/partners" className="text27">
                          Partners
                        </Link>
                        <Link href="/customers" className="text21">
                          Customers
                        </Link>
                        <Link href="/contact" className="text21">
                          Contact us
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="row-view10">
                    <Image src={assetUrl('/home/social-facebook.png')} alt="Facebook" width={24} height={49} className="image2" />
                    <Image src={assetUrl('/home/social-twitter.png')} alt="Twitter" width={52} height={43} className="image3" />
                    <Image src={assetUrl('/home/social-instagram.png')} alt="Instagram" width={54} height={54} className="image4" />
                  </div>
                </div>
              </div>
              <div className="column16">
                <div className="column17">
                  <span className="text8">Millon Zahino</span>
                  <span className="text10">Behavioral Science</span>
                </div>
                <div className="view6">
                  <span className="text12">★ ★ ★ ★ ★</span>
                </div>
                <span className="text28">As an industrial, securing capacity and</span>
                <span className="text28">optimizing budget are key. In that perspe</span>
                <span className="text28">ctive, you are looking for a transport</span>
                <span className="text14">partner committed</span>
              </div>
              <div className="column18">
                <div className="column17">
                  <span className="text8">Millon Zahino</span>
                  <span className="text10">Behavioral Science</span>
                </div>
                <div className="view7">
                  <span className="text12">★ ★ ★ ★ ★</span>
                </div>
                <span className="text28">As an industrial, securing capacity and</span>
                <span className="text28">optimizing budget are key. In that perspe</span>
                <span className="text28">ctive, you are looking for a transport</span>
                <span className="text14">partner committed</span>
              </div>
            </div>
          </div>
        </div>
      </ResponsiveCanvas>
    </>
  )
}
