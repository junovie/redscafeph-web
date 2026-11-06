import { Link } from "react-router-dom";

export default function Logo({ className = "" }) {
  return (
    <Link to="/" aria-label="Red's Cafe home" className={`inline-flex ${className}`}>
      <img src="/images/logo-wordmark.webp" alt="Red's Cafe" width="640" height="280" className="h-14 w-auto sm:h-16" />
    </Link>
  );
}
