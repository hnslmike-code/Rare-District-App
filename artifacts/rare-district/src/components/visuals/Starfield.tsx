import { useEffect, useRef } from "react";

interface StarfieldProps {
  density?: "low" | "medium" | "high";
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  drift: number;
  tint: "ivory" | "gold" | "chrome";
}

const PARTICLE_COUNTS = {
  low: 70,
  medium: 120,
  high: 175,
};

export function Starfield({ density = "medium", className = "" }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = [];
    let frame = 0;
    let animationFrame = 0;
    let width = 0;
    let height = 0;

    const createParticles = () => {
      particles.length = 0;
      const count = PARTICLE_COUNTS[density];
      for (let index = 0; index < count; index += 1) {
        const tintRoll = Math.random();
        particles.push({
          x: Math.random(),
          y: Math.random(),
          radius: Math.random() * 1.35 + 0.35,
          alpha: Math.random() * 0.65 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.00014 + 0.000035,
          drift: (Math.random() - 0.5) * 0.00006,
          tint: tintRoll > 0.84 ? "gold" : tintRoll > 0.65 ? "chrome" : "ivory",
        });
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      createParticles();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const time = reducedMotion ? 0 : frame;

      particles.forEach((particle) => {
        if (!reducedMotion) {
          particle.y = (particle.y - particle.speed + 1) % 1;
          particle.x = (particle.x + particle.drift + 1) % 1;
        }

        const twinkle = reducedMotion
          ? 1
          : 0.72 + Math.sin(time * 0.018 * particle.speed * 10000 + particle.phase) * 0.28;
        const alpha = Math.max(0.08, particle.alpha * twinkle);
        const colors = {
          ivory: `rgba(242, 237, 221, ${alpha})`,
          gold: `rgba(211, 177, 104, ${alpha * 0.9})`,
          chrome: `rgba(183, 198, 211, ${alpha * 0.82})`,
        };

        context.beginPath();
        context.fillStyle = colors[particle.tint];
        context.arc(particle.x * width, particle.y * height, particle.radius, 0, Math.PI * 2);
        context.fill();
      });
    };

    const animate = () => {
      frame += 1;
      draw();
      animationFrame = window.requestAnimationFrame(animate);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    if (reducedMotion) {
      draw();
    } else {
      animationFrame = window.requestAnimationFrame(animate);
    }

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className={`starfield-canvas ${className}`}
      aria-hidden="true"
      data-testid="visual-starfield"
    />
  );
}