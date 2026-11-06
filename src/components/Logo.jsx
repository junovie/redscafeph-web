import { Link } from "react-router-dom";

export default function Logo({ className = "" }) {
  return (
    <Link to="/" aria-label="Red's Cafe home" className={`inline-flex flex-col items-end leading-none ${className}`}>
      <span className="font-logo text-5xl text-red-brand sm:text-6xl">Red's</span>
      <span className="-mt-1 mr-3 font-logo text-2xl text-neutral-300 sm:text-3xl">cafe</span>
    </Link>
  );
}
