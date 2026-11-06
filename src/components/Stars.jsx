import { Star } from "lucide-react";

export default function Stars({ value, size = "h-4 w-4", onChange }) {
  return (
    <span className="inline-flex gap-1" role={onChange ? "radiogroup" : "img"} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star className={`${size} ${n <= value ? "fill-red-brand text-red-brand" : "text-neutral-600"}`} />;
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className="transition-transform hover:scale-110"
          >
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}
