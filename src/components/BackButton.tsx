import { ArrowLeft } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";

export type BackButtonProps = {
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
};

/**
 * BackButton — Uiverse-style glow using app brand colors
 * - Black inner surface
 * - Animated gradient frame rotates on hover
 * - Soft gradient blur glow underneath
 */
const BackButton: React.FC<BackButtonProps> = ({ onClick, children = "Back", className }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onClick) return onClick();
    try {
      if (window.history.length > 1) navigate(-1);
      else navigate("/dashboard");
    } catch {
      navigate("/dashboard");
    }
  };
  return (
    <div className={[
      "relative inline-flex items-center justify-center group",
      "w-[128px] h-12 rounded-[10px]",
      className || "",
    ].join(" ")}> 
      {/* Rotating gradient frame (::before) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 w-full h-full rounded-[10px] z-0 transition-transform duration-[600ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover:-rotate-180 group-active:scale-75"
        style={{
          background: "linear-gradient(-45deg, hsl(var(--brand-warm-start)) 0%, hsl(var(--brand-cool-end)) 100%)",
        }}
      />
      {/* Blurred glow (::after) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[-1] w-full h-full rounded-[10px] blur-[20px] group-hover:blur-[30px]"
        style={{
          background: "linear-gradient(-45deg, hsl(var(--brand-warm-start)) 0%, hsl(var(--brand-cool-end)) 100%)",
        }}
      />

      {/* Inner button */}
      <button
        type="button"
        onClick={handleClick}
        className="relative z-10 inline-flex h-10 w-[120px] items-center justify-center gap-2 rounded-[10px] bg-black text-white px-3 py-2 active:translate-y-[1px]"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="leading-none">{children}</span>
      </button>
    </div>
  );
};

export default BackButton;
