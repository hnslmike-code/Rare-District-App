import { useEffect, useRef } from "react";

export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let nextX = -240;
    let nextY = -240;

    const paint = () => {
      glow.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      frame = 0;
    };

    const handlePointerMove = (event: PointerEvent) => {
      nextX = event.clientX;
      nextY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={glowRef} className="cursor-glow" aria-hidden="true" />;
}