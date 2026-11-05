import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-6 py-32 text-center">
      <h1 className="section-title">Page not found</h1>
      <p className="mt-4 text-neutral-300">This page moved or doesn't exist anymore.</p>
      <Link to="/" className="btn-outline mt-8">
        Back home
      </Link>
    </section>
  );
}
