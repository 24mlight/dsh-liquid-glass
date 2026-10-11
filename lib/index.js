/**
 * dsh-glass-skin — host side.
 *
 * This is a pure client-side skin: all presentation work happens in the
 * browser module (`./client.js`). The host entry exists only to satisfy the
 * DSH plugin shape and intentionally does nothing.
 *
 * @param {object} _ctx cordis plugin context (unused).
 */
export function apply(_ctx) {
  // Pure presentation lives client-side; nothing to register on the host.
}
