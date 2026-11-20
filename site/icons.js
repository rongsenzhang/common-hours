// Small, purpose-drawn interface symbols. Each inherits the surrounding text colour.
const paths = {
  paw: '<circle cx="5" cy="9" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="20" cy="10" r="2"/><path d="M6 17c0-2 2-3 3-5 1.3-2.2 4.4-2.2 6 0 1 2 3 3 3 5 0 2-2 3-4 2.4-1.5-.5-2.5-.5-4 0C8 20 6 19 6 17z"/>',
  chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.8-.9L3 21l1.6-5.1A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M8 10h8m-8 4h5"/>',
  discover:
    '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1z"/>',
  desk: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12c6 3 12 3 18 0m-9 0v3"/>',
  evidence: '<path d="M5 20V5m0 15h15M9 16v-4m4 4V8m4 8v-6"/>',
  book: '<path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4zM12 6v15"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z"/><circle cx="12" cy="10" r="2.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  filter:
    '<path d="M3 7h7m4 0h7M3 17h11m4 0h3"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  save: '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  external:
    '<path d="M13 4h7v7m0-7-9 9m7 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  leaf: '<path d="M4 20c2-6 6-10 13-13M6 16C1 7 13 4 21 3c-1 11-6 17-15 13z"/>',
  flower:
    '<path d="M12 20v-7m0 6c-4 0-6-2-6-4 3 0 5 1 6 4zm0-2c4 0 6-2 6-4-3 0-5 1-6 4z"/><path d="M9.5 10.5C3 12 3 6 7.7 6.2 7 1.8 12 1 13 5c3-3.8 7 .2 3.6 3 4 3-1 7.5-4 3.3-1.1 1.2-2.4 1-3.1-.8z"/>',
  food: '<path d="M3 12h18c-1.5 6-5 8-9 8s-7.5-2-9-8zM8 9c2-2-1-3 1-5m4 5c2-2-1-3 1-5m3 5 3-6"/>',
  digital:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v3m-5 0h10m-8-9 2 2 4-5"/>',
  arts: '<path d="m4 9 5-6 11 11-6 6L4 10zM9 4l7 7M5 18l-2 3 4-1m9-14 2-2 3 3-2 2"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m-1-16a3 3 0 0 1 0 6m3 3c3 1 4 3 4 6"/>',
  repair:
    '<path d="M15 4a5 5 0 0 0-6 6L3.8 16a2.5 2.5 0 0 0 3.5 3.5L13 14a5 5 0 0 0 6-7l-3 3-3-3z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.2"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5m-18 4 9 5 9-5"/>',
  sprout:
    '<path d="M12 21v-8M12 15C6 15 3 11 3 6c6 0 10 4 9 9zm0-3c0-6 4-9 10-9 0 6-4 9-10 9z"/>',
};
export function icon(name, size = 18) {
  return (
    '<svg aria-hidden="true" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] || paths.file) +
    "</svg>"
  );
}
export const mark =
  '<svg class="brandmark" aria-hidden="true" width="38" height="38" viewBox="0 0 38 38" fill="currentColor"><path d="M18 18C7 19 3 13 3 5c8-1 15 4 15 13ZM20 18C19 8 25 3 34 3c1 9-5 15-14 15ZM18 20C19 30 12 35 3 34c0-8 5-15 15-14ZM20 20c10-1 15 5 15 14-9 1-16-5-15-14Z"/></svg>';
