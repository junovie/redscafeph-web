import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Stars from "@/components/Stars";
import { LOCATIONS } from "@/data/site";

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

function ReviewForm() {
  const [form, setForm] = useState({ name: "", location: "", rating: 0, comment: "", website: "" });
  const [state, setState] = useState({ status: "idle", message: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target ? e.target.value : e });

  async function submit(e) {
    e.preventDefault();
    if (!form.rating) return setState({ status: "error", message: "Please pick a star rating." });
    setState({ status: "sending", message: "" });
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setState({ status: "sent", message: "" });
    } catch (err) {
      setState({ status: "error", message: err.message });
    }
  }

  if (state.status === "sent") {
    return (
      <div className="card p-8 text-center">
        <p className="eyebrow">Thank you, Redsident!</p>
        <p className="lead mt-3">Your review will show up here once our team has had a look.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6 sm:p-8">
      <h2 className="font-display text-2xl uppercase tracking-wide">Leave a review</h2>
      <div>
        <span className="label">Your rating</span>
        <Stars value={form.rating} size="h-8 w-8" onChange={set("rating")} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input required maxLength={60} value={form.name} onChange={set("name")} className="field" placeholder="Juan" />
        </label>
        <label className="block">
          <span className="label">Which Red's? (optional)</span>
          <select value={form.location} onChange={set("location")} className="field">
            <option value="">Any</option>
            {LOCATIONS.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Tell us anything (optional)</span>
        <textarea rows={4} maxLength={1500} value={form.comment} onChange={set("comment")} className="field" placeholder="What did you love? What can we do better?" />
      </label>
      <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state.status === "error" && <p className="text-sm text-red-brand">{state.message}</p>}
      <button type="submit" disabled={state.status === "sending"} className="btn-solid disabled:opacity-60">
        {state.status === "sending" ? "Sending..." : "Submit review"}
      </button>
    </form>
  );
}

export default function Reviews() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Reviews"
        title="Tell us anything"
        intro={<p>Loved your stay, or think we can do better? Leave us a review. We read every one.</p>}
      >
      {data?.count > 0 && (
        <div className="flex items-center gap-4">
          <span className="font-display text-5xl text-cream">{data.average.toFixed(1)}</span>
          <span>
            <Stars value={Math.round(data.average)} size="h-5 w-5" />
            <span className="block text-sm text-paper/60">
              {data.count} review{data.count === 1 ? "" : "s"}
            </span>
          </span>
        </div>
      )}

      </PageHeader>
      <div className="container-page grid gap-10 py-16 md:py-20 lg:grid-cols-2">
        <div>
          <ReviewForm />
        </div>
        <section className="space-y-4">
        {error && <p className="text-paper/60">Reviews couldn't load right now. Please refresh in a bit.</p>}
        {!data && !error && <p className="text-paper/60">Loading reviews...</p>}
        {data?.reviews.map((r) => (
          <article key={r.id} className="card p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex h-10 w-10 items-center justify-center bg-red-brand font-display text-lg text-white">
                {r.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-display uppercase tracking-wide text-cream">{r.name}</span>
              <Stars value={r.rating} />
              <span className="text-sm text-paper/50">
                {formatDate(r.created_at)}
                {r.location && ` · ${r.location}`}
              </span>
            </div>
            {r.comment && <p className="mt-3 whitespace-pre-line leading-relaxed text-paper/85">{r.comment}</p>}
            {r.reply && (
              <div className="mt-4 border-l-2 border-red-brand pl-4">
                <p className="font-script text-lg text-red-brand">Red's Cafe replied</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-paper/70">{r.reply}</p>
              </div>
            )}
          </article>
        ))}
        </section>
      </div>
    </>
  );
}
