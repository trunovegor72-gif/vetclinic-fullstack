const API = import.meta.env.VITE_API || "/api";

export async function api(path, opts) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}
