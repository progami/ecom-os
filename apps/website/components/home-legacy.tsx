'use client'

import Image from 'next/image'

import { assetUrl } from '@/core-services/assets/cdn'

import styles from './home-legacy.module.css'

export default function HomeLegacy() {
  return (
    <div className={`${styles.root} contain`}>
      <div className="column">
        <div className="column2">
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
  )
}
