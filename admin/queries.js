// Sort for display only. Evaluation and embedding records use immutable case IDs.
const alphabetical = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });

export function alphabeticalCases(cases) {
  return [...cases].sort((left, right) =>
    alphabetical.compare(left.query, right.query) || alphabetical.compare(left.id, right.id)
  );
}

export function prettyPreferences(preferences) {
  const time = { weekday: "Weekday", weekend: "Weekend", flexible: "Flexible" };
  const mode = {
    onsite: "At the venue",
    remote: "From home",
    hybrid: "Hybrid",
  };
  return (
    [
      time[preferences.time],
      mode[preferences.mode],
      preferences.stepFree ? "Step-free access required" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Any time or setting"
  );
}

