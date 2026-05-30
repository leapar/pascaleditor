'use client'

import { emitter } from '@pascal-app/core'
import Image from 'next/image'
import { ActionButton } from './action-button'
import { messages, useLocale } from '../../../lib/i18n'

export function CameraActions({ hideOrbit = false }: { hideOrbit?: boolean }) {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key

  const goToTopView = () => {
    emitter.emit('camera-controls:top-view')
  }

  const orbitCW = () => {
    emitter.emit('camera-controls:orbit-cw')
  }

  const orbitCCW = () => {
    emitter.emit('camera-controls:orbit-ccw')
  }

  return (
    <div className="flex items-center gap-1">
      {!hideOrbit && (
        <>
          {/* Orbit CCW */}
          <ActionButton
            className="group hover:bg-white/5"
            label={t('viewer.orbitLeft')}
            onClick={orbitCCW}
            size="icon"
            variant="ghost"
          >
            <Image
              alt={t('viewer.orbitLeft')}
              className="h-[28px] w-[28px] -scale-x-100 object-contain opacity-70 transition-opacity group-hover:opacity-100"
              height={28}
              src="/icons/rotate.png"
              width={28}
            />
          </ActionButton>

          {/* Orbit CW */}
          <ActionButton
            className="group hover:bg-white/5"
            label={t('viewer.orbitRight')}
            onClick={orbitCW}
            size="icon"
            variant="ghost"
          >
            <Image
              alt={t('viewer.orbitRight')}
              className="h-[28px] w-[28px] object-contain opacity-70 transition-opacity group-hover:opacity-100"
              height={28}
              src="/icons/rotate.png"
              width={28}
            />
          </ActionButton>
        </>
      )}

      {/* Top View */}
      <ActionButton
        className="group hover:bg-white/5"
        label={t('viewer.topView')}
        onClick={goToTopView}
        size="icon"
        variant="ghost"
      >
        <Image
          alt={t('viewer.topView')}
          className="h-[28px] w-[28px] object-contain opacity-70 transition-opacity group-hover:opacity-100"
          height={28}
          src="/icons/topview.png"
          width={28}
        />
      </ActionButton>
    </div>
  )
}
