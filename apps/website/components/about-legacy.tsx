'use client'

import Image from 'next/image'

import { assetUrl } from '@/core-services/assets/cdn'

import styles from './about-legacy.module.css'

export default function AboutLegacy() {
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
            <div className="column3">
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
                  <Image
                    src={assetUrl('/about/about-portrait.png')}
                    alt=""
                    width={640}
                    height={640}
                    className="image"
                    priority
                  />
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
            <Image
              src={assetUrl('/about/about-floating.png')}
              alt=""
              width={943}
              height={943}
              className="image2"
            />
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
          <Image
            src={assetUrl('/about/about-circle.png')}
            alt=""
            width={943}
            height={943}
            className="absolute-image"
          />
        </div>
      </div>
    </div>
    </>
  )
}
