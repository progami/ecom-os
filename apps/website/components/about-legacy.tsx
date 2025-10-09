'use client'

import Image from 'next/image'
import Link from 'next/link'

import { assetUrl } from '@/core-services/assets/cdn'

import ResponsiveCanvas from './responsive-canvas'
import styles from './about-legacy.module.css'

export default function AboutLegacy() {
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
              <div className="column3">
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
                <div
                  className="column4"
                  style={{
                    backgroundImage: `url(${assetUrl('/about/about-bg.png')})`,
                  }}
                >
                  <div className="box2" />
                  <div className="row-view2">
                    <div className="column5">
                      <span className="text6">Targon’s purpose</span>
                      <button className="button" type="button">
                        <span className="text7">vision</span>
                      </button>
                    </div>
                    <div className="column6">
                      <Image src={assetUrl('/about/about-portrait.png')} alt="" width={640} height={640} className="image" />
                      <span className="absolute-text">the simplest choices and the most efficient products.</span>
                      <div className="absolute-view">
                        <span className="text8">Mission</span>
                      </div>
                      <div className="absolute-view2">
                        <span className="text9">values</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Image src={assetUrl('/about/about-floating.png')} alt="" width={943} height={943} className="image2" />
                <div
                  className="column7"
                  style={{
                    backgroundImage: `url(${assetUrl('/about/about-vision-bg.png')})`,
                  }}
                >
                  <div className="view">
                    <span className="text10">vision</span>
                  </div>
                  <span className="text11">empowering you with simplicity and efficiency</span>
                </div>
              </div>
              <Image src={assetUrl('/about/about-circle.png')} alt="" width={943} height={943} className="absolute-image" />
            </div>
            <div className="column8">
              <div className="row-view3">
                <span className="text12">targon</span>
                <span className="text13">quick Links</span>
                <span className="text14">Explore</span>
                <span className="text15">Company</span>
              </div>
              <div className="row-view4">
                <span className="text16">
                  Hello, we are Targon. trying to make an effort to put the right people for you to get the best results. Just insight
                </span>
                <div className="column9">
                  <span className="text17">Legal</span>
                  <span className="text17">Policy</span>
                </div>
                <div className="column10">
                  <span className="text17">Resources</span>
                  <span className="text18">Blog</span>
                </div>
                <div className="column11">
                  <span className="text17">About us</span>
                  <span className="text17">Partners</span>
                </div>
              </div>
              <div className="view2">
                <div className="row-view5">
                  <span className="text19">EcomOS</span>
                  <span className="text20">Documents</span>
                  <span className="text21">Customers</span>
                </div>
              </div>
              <div className="view3">
                <div className="row-view6">
                  <span className="text22">Caelum Star</span>
                  <span className="text23">Contact us</span>
                </div>
              </div>
              <div className="row-view7">
                <Image src={assetUrl('/about/about-social-facebook.png')} alt="Facebook" width={24} height={50} className="image3" />
                <Image src={assetUrl('/about/about-social-twitter.png')} alt="Twitter" width={52} height={42} className="image4" />
                <Image src={assetUrl('/about/about-social-instagram.png')} alt="Instagram" width={54} height={54} className="image5" />
              </div>
            </div>
          </div>
        </div>
      </ResponsiveCanvas>
    </>
  )
}
