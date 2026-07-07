// Compte/login géré sur cooloss (hub d'identité partagé) — plus de modal
// login/register local. Redirection simple, cooloss revient sur `next` une
// fois connecté.
export function goToCoolossLogin() {
  if (typeof window === 'undefined') return;
  window.location.href = `https://cooloss.nathangracia.com/login?next=${encodeURIComponent(window.location.href)}`;
}
