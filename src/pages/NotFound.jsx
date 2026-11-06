import { Link } from "react-router-dom";
import Heading from "@/components/Heading";

export default function NotFound() {
  return (
    <section className="container-page py-32 text-center">
      <Heading as="h1" center eyebrow="Oops" title="Page not found">
        <p>This page moved or doesn't exist anymore.</p>
      </Heading>
      <Link to="/" className="btn-outline mt-8">
        Back home
      </Link>
    </section>
  );
}
