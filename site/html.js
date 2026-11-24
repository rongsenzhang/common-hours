export function escapeText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export function roleByline(role, includeArea = true) {
  if (role.source === "exercise") {
    return '<span class="exercise-credit">From the matching exercise</span>';
  }
  const fields = includeArea ? [role.organisation, role.area] : [role.organisation];
  return fields.filter(Boolean).map(escapeText).join(" · ");
}
