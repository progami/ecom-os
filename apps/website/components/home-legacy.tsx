'use client'

import Image from 'next/image'

import { assetUrl } from '@/core-services/assets/cdn'

import styles from './home-legacy.module.css'

export default function HomeLegacy() {
  return (
    <>
      <style jsx global>{`
        header.site-header,
        footer.site-footer {
          display: none;
        }
      `}</style>
      <div className={`${styles.root} contain`}>
        <div className="column">
          <div className="column2">
            <div className="row-view">
              <span className="text">targon</span>
              <div className="box" />
              <span className="text2">about</span>
              <span className="text3">products</span>
              <span className="text4">EcomOS</span>
              <span className="text5">news</span>
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
                  <span className="text6">{'Innovation\nto\nimpact'}</span>
                </div>
              </div>
              <Image
                src={assetUrl('/home/hero-floating.png')}
                alt=""
                width={2366}
                height={2371}
                className="absolute-image"
                priority
              />
            </div>
            <span className="text7">{'What the world needs next\nwe are making now.'}</span>
          </div>
          <div className="column5">
            <div className="column6">
              <Image
                src={assetUrl('/home/circle-left.png')}
                alt=""
                width={1019}
                height={1019}
                className="image"
                priority
              />
              <Image
                src={assetUrl('/home/circle-center.png')}
                alt=""
                width={928}
                height={929}
                className="absolute-image2"
              />
            </div>
            <Image
              src={assetUrl('/home/circle-right.png')}
              alt=""
              width={841}
              height={840}
              className="absolute-image3"
            />
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
                    <span className="text12">{'    '}</span>
                  </div>
                  <div className="view4">
                    <span className="text12">{'    '}</span>
                  </div>
                  <div className="view5">
                    <span className="text12">{'    '}</span>
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
                <span className="text15">about us</span>
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
                    <span className="text19">Policy</span>
                    <span className="text20">EcomOS</span>
                    <span className="text21">Caelum Star</span>
                  </div>
                  <div className="column13">
                    <span className="text22">Explore</span>
                    <span className="text23">Resources</span>
                    <span className="text24">Blog</span>
                    <span className="text21">Documents</span>
                  </div>
                  <div className="column14">
                    <span className="text25">Company</span>
                    <div className="column15">
                      <span className="text26">About us</span>
                      <span className="text27">Partners</span>
                      <span className="text21">Customers</span>
                      <span className="text21">Contact us</span>
                    </div>
                  </div>
                </div>
                <div className="row-view10">
                  <Image
                    src={assetUrl('/home/social-facebook.png')}
                    alt="Facebook"
                    width={24}
                    height={49}
                    className="image2"
                  />
                  <Image
                    src={assetUrl('/home/social-twitter.png')}
                    alt="Twitter"
                    width={52}
                    height={43}
                    className="image3"
                  />
                  <Image
                    src={assetUrl('/home/social-instagram.png')}
                    alt="Instagram"
                    width={54}
                    height={54}
                    className="image4"
                  />
                </div>
              </div>
            </div>
            <div className="column16">
              <div className="column17">
                <span className="text8">Millon Zahino</span>
                <span className="text10">Behavioral Science</span>
              </div>
              <div className="view6">
                <span className="text12">{'    '}</span>
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
                <span className="text12">{'    '}</span>
              </div>
              <span className="text28">As an industrial, securing capacity and</span>
              <span className="text28">optimizing budget are key. In that perspe</span>
              <span className="text28">ctive, you are looking for a transport</span>
              <span className="text14">partner committed</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
