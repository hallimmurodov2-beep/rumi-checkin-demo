import type { Slide } from './gallery'

/**
 * A hotel photo that fills the screen. A portrait photo would lose most of its height if cropped to the
 * wide screen, so it is shown whole in the middle, over a blurred, darkened copy of itself.
 * Fills its (positioned) parent. `className` goes on the outer element (the screensaver animates it).
 */
export function SlideImage({ slide, alt = '', className = '' }: { slide: Slide; alt?: string; className?: string }) {
  if (!slide.portrait) {
    return <img src={slide.src} alt={alt} decoding="async" draggable={false} className={`ss-photo ${className}`} />
  }
  return (
    <div className={`ss-photo ${className}`}>
      <img src={slide.src} alt="" aria-hidden="true" decoding="async" draggable={false} className="si-backdrop" />
      <img src={slide.src} alt={alt} decoding="async" draggable={false} className="si-front" />
    </div>
  )
}
