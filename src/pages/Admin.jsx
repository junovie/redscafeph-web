import { useCallback, useEffect, useState } from "react";
import Stars from "@/components/Stars";

const KEY = "redscafe-admin";
const TABS = [
  ["pending", "Waiting for approval"],
  ["approved", "Live on site"],
  ["hidden", "Hidden"],
];

function useAdminApi(password, onUnauthorized) {
  return useCallback(
    async (path, options = {}) => {
      const res = await fetch(path, {
        ...options,
        headers: { "content-type": "application/json", authorization: `Bearer ${password}` },
      });
      if (res.status === 401) {
        onUnauthorized();
        throw new Error("Wrong password");
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
      return res.json();
    },
    [password, onUnauthorized],
  );
}

function Login({ onLogin, error }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onLogin(value);
      }}
      className="mx-auto max-w-sm space-y-4 px-6 py-24"
    >
      <h1 className="font-heading text-3xl">Reviews admin</h1>
      <input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Admin password"
        className="w-full border border-white/20 bg-black px-4 py-3 focus:border-red-brand focus:outline-none"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-solid w-full">Log in</button>
    </form>
  );
}

function ReviewRow({ review, api, reload }) {
  const [reply, setReply] = useState(review.reply);
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };
  const update = (body) => run(() => api(`/api/admin/reviews/${review.id}`, { method: "PATCH", body: JSON.stringify(body) }));
  const remove = () =>
    confirm(`Delete ${review.name}'s review forever?`) &&
    run(() => api(`/api/admin/reviews/${review.id}`, { method: "DELETE" }));

  return (
    <article className="space-y-3 border border-white/15 p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{review.name}</span>
        <Stars value={review.rating} />
        <span className="text-sm text-neutral-500">
          {new Date(review.created_at).toLocaleString("en-PH")}
          {review.location && ` · ${review.location}`}
        </span>
      </div>
      {review.comment ? (
        <p className="whitespace-pre-line text-neutral-200">{review.comment}</p>
      ) : (
        <p className="text-sm italic text-neutral-500">No comment, rating only</p>
      )}
      <textarea
        rows={2}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Public reply from Red's Cafe (optional)"
        className="w-full border border-white/15 bg-black px-3 py-2 text-sm focus:border-red-brand focus:outline-none"
      />
      <div className="flex flex-wrap gap-2 text-sm">
        {review.status !== "approved" && (
          <button disabled={busy} onClick={() => update({ status: "approved", reply })} className="btn-solid px-4 py-2">
            Approve
          </button>
        )}
        {review.status !== "hidden" && (
          <button disabled={busy} onClick={() => update({ status: "hidden" })} className="btn-outline px-4 py-2">
            Hide
          </button>
        )}
        {reply !== review.reply && (
          <button disabled={busy} onClick={() => update({ reply })} className="btn-outline px-4 py-2">
            Save reply
          </button>
        )}
        <button disabled={busy} onClick={remove} className="px-4 py-2 text-neutral-400 hover:text-red-400">
          Delete
        </button>
      </div>
    </article>
  );
}

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem(KEY) || "");
  const [reviews, setReviews] = useState(null);
  const [tab, setTab] = useState("pending");
  const [error, setError] = useState("");
  const logout = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setPassword("");
    setReviews(null);
  }, []);
  const api = useAdminApi(password, logout);

  const reload = useCallback(async () => {
    const data = await api("/api/admin/reviews");
    setReviews(data.reviews);
  }, [api]);

  useEffect(() => {
    if (!password) return;
    reload()
      .then(() => {
        sessionStorage.setItem(KEY, password);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [password, reload]);

  if (!password || !reviews) {
    return (
      <Login
        error={error}
        onLogin={(value) => {
          setError("");
          setPassword(value);
        }}
      />
    );
  }

  const shown = reviews.filter((r) => r.status === tab);
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl">Reviews admin</h1>
        <button onClick={logout} className="text-sm text-neutral-400 hover:text-white">
          Log out
        </button>
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`border px-4 py-2 text-sm ${tab === key ? "border-red-brand bg-red-brand" : "border-white/20 hover:border-white"}`}
          >
            {label} ({reviews.filter((r) => r.status === key).length})
          </button>
        ))}
      </div>
      <div className="mt-8 space-y-4">
        {shown.length === 0 && <p className="text-neutral-400">Nothing here.</p>}
        {shown.map((r) => (
          <ReviewRow key={`${r.id}-${r.status}-${r.reply}`} review={r} api={api} reload={reload} />
        ))}
      </div>
    </div>
  );
}
