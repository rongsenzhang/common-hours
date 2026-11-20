// Pure ranking and eligibility logic shared by the browser and the offline benchmark.
const stop = new Set(
  "a an and are as at be by can do for from have help helping i id in into is it like looking me my of on or our out someone something that the this to want with work would you your volunteer volunteering role roles".split(
    " ",
  ),
);

// Each concept links words used by volunteers to words in a listing. Keep this small and auditable.
const concepts = {
  growing:
    "allotment allotments beds garden gardens gardener gardening grow growing seedlings horticulture planting",
  seeds: "seed seeds packets sow sowing",
  food: "groceries grocery pantry food parcels hunger foodbank tins",
  cooking: "cook cooking kitchen meals meal chef culinary",
  devices:
    "smartphone smartphones devices device tablet tablets email computer computers tech technology",
  listening:
    "call calls telephone phone chat chats listening companionship loneliness lonely conversation isolated befriending befriender",
  repair: "repair repairing mending mend fix fixes fixing broken workbench",
  archive:
    "archive archives history historical heritage handwritten transcribe transcriber transcribing letters",
  litter: "litter cleanup litterpick recycling rubbish rubbishpicking",
  nature: "nature outdoors outdoor outside park parks riverside",
  birds: "wildlife birds bird birdwatching birding sightings ornithology",
  reading: "literacy reading pronunciation aloud english learner learners",
  design:
    "poster posters design designer designing graphic artwork graphics illustration",
  welcome: "welcome greeter greet visitors greeting receptionist reception",
  testing: "tester testing usability bugs navigation",
  caption:
    "caption captions captioning subtitles subtitling transcription transcripts",
  walking: "walk walks walking walker walkers stroll strolls strolling",
  dogs: "dog dogs canine canines pooch pooches",
  animals: "animal animals pet pets",
  sorting: "sort sorts sorter sorting",
  grooming: "groom grooms groomer grooming",
  training: "train trains trainer training",
  cycling: "cycle cycles cycling bicycle bicycles bike bikes",
};
const wordsByConcept = Object.entries(concepts).map(([label, words]) => [
  label,
  new Set(words.split(" ")),
]);

function words(text) {
  return (
    String(text ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((word) => !stop.has(word)) ?? []
  );
}
function conceptSet(tokens) {
  return new Set(
    wordsByConcept
      .filter(([, vocabulary]) => tokens.some((token) => vocabulary.has(token)))
      .map(([label]) => label),
  );
}

// An activity and its object must both be grounded in the work offered by a
// listing. Applying this only to known activity verbs leaves broad browsing
// (e.g. "digital arts") and the independent literal baseline unchanged.
const activityVerbs = new Set(["walking", "sorting", "grooming", "training", "cooking"]);
const requestModifiers = new Set(
  "am any anything anywhere available community could doing donated enjoy find first free get how interested local love nearby need new often opportunity opportunities please position prefer regular regularly seeking some somewhere start starting take taking there these things time try weekday weekdays weekend weekends what where which while who willing".split(" "),
);
function activityRequirements(tokens, queryConcepts) {
  const activities = [...queryConcepts].filter((name) => activityVerbs.has(name));
  if (!activities.length) return null;
  const verbWords = wordsByConcept.filter(([name]) => activities.includes(name));
  const objects = tokens.filter((word) =>
    !requestModifiers.has(word) && !verbWords.some(([, vocabulary]) => vocabulary.has(word)),
  );
  const objectConcepts = conceptSet(objects);
  const otherWords = objects.filter((word) => !wordsByConcept.some(([, vocabulary]) => vocabulary.has(word)));
  return { activities, objectConcepts, otherWords };
}

function coversActivity(record, requirement) {
  if (!requirement) return true;
  const { activities, objectConcepts, otherWords } = requirement;
  return activities.every((name) => record.taskConcepts.has(name))
    && [...objectConcepts].every((name) => record.taskConcepts.has(name))
    && otherWords.every((word) => record.counts.has(word));
}
function tally(tokens, weight, result) {
  for (const word of tokens) result.set(word, (result.get(word) ?? 0) + weight);
}
function listingText(role) {
  return [
    ["Title", role.title, 3],
    ["Tasks", role.tasks.join(" "), 2],
    ["Interests", role.interests.join(" "), 2],
    ["Description", role.summary, 1],
    ["Organisation", role.organisation, 1],
    ["Area", role.area, 1],
  ];
}
function indexRole(role) {
  const counts = new Map();
  const fields = listingText(role).map(([label, text, weight]) => {
    const tokens = words(text);
    tally(tokens, weight, counts);
    return { label, tokens, concepts: conceptSet(tokens) };
  });
  const taskFields = fields.filter(({ label }) => label !== "Organisation" && label !== "Area");
  const taskConcepts = new Set(taskFields.flatMap((field) => [...field.concepts]));
  return { role, fields, counts, concepts: conceptSet([...counts.keys()]), taskConcepts };
}
function tfidf(counts, idf, missingIdf) {
  const weights = new Map();
  for (const [word, count] of counts) {
    weights.set(word, (1 + Math.log(count)) * (idf.get(word) ?? missingIdf));
  }
  return weights;
}
function norm(weights) {
  return Math.sqrt([...weights.values()].reduce((sum, w) => sum + w * w, 0));
}
function cosine(query, queryNorm, document) {
  let dot = 0;
  for (const [word, value] of query) dot += value * (document.get(word) ?? 0);
  return queryNorm && dot ? dot / (queryNorm * norm(document)) : 0;
}

const timeLabels = {
  weekday: "Weekday",
  weekend: "Weekend",
  flexible: "Weekday or weekend",
};
const modeLabels = {
  onsite: "At the venue",
  remote: "From home",
  hybrid: "At the venue or from home",
};

// A known conflict takes precedence over missing information. Only a selected condition can restrict a result.
function checkConditions(role, prefs) {
  const issues = [];
  const reasons = [];
  function compare(field, allowed, expected, description) {
    const actual = role[field];
    if (!actual || actual === "unknown") {
      issues.push({
        field,
        status: "unknown",
        label: expected + " needs host confirmation.",
      });
    } else if (!allowed.includes(actual)) {
      issues.push({
        field,
        status: "conflict",
        label: expected + " conflicts with the listing (" + description + ").",
      });
    } else {
      reasons.push(expected + " confirmed (" + description + ").");
    }
  }
  if (prefs.time && prefs.time !== "any") {
    compare(
      "time",
      [prefs.time, "flexible"],
      timeLabels[prefs.time] + " availability",
      timeLabels[role.time],
    );
  }
  if (prefs.mode && prefs.mode !== "any") {
    compare(
      "mode",
      [prefs.mode, "hybrid"],
      modeLabels[prefs.mode] + " participation",
      modeLabels[role.mode],
    );
  }
  if (prefs.stepFree) {
    const remote =
      role.mode === "remote" ||
      (role.mode === "hybrid" && prefs.mode === "remote");
    if (remote) {
      reasons.push("No venue visit is needed on the remote route.");
    } else {
      compare(
        "stepFree",
        ["yes"],
        "Step-free venue access",
        role.stepFree === "yes" ? "confirmed level access" : "steps on site",
      );
    }
  }
  return { issues, reasons };
}

/**
 * Return positive-topic candidates in three eligibility groups. score is a relative similarity
 * measure in [0,1]. A blank query browses every role passing the selected conditions.
 */
export function matchOpportunities(
  opportunities,
  preferences = {},
  method = "hybrid",
) {
  const browse = !String(preferences.query ?? "").trim();
  const tokens = words(preferences.query);
  const queryWords = new Set(tokens);
  const queryConcepts = conceptSet(tokens);
  const literalMethod = method === "baseline" || method === "literal";
  const requirement = literalMethod ? null : activityRequirements(tokens, queryConcepts);
  const indexed = opportunities.map(indexRole);
  const documentFrequency = new Map();
  for (const record of indexed)
    tally(record.counts.keys(), 1, documentFrequency);
  const idf = new Map(
    [...documentFrequency].map(([word, n]) => [
      word,
      1 + Math.log((1 + indexed.length) / (1 + n)),
    ]),
  );
  const queryCounts = new Map();
  tally(tokens, 1, queryCounts);
  const queryVector = tfidf(queryCounts, idf, 1 + Math.log(1 + indexed.length));
  const queryNorm = norm(queryVector);
  const output = { matches: [], review: [], excluded: [] };
  for (const record of indexed) {
    if (!coversActivity(record, requirement)) continue;
    const literal = [...queryWords].filter((word) => record.counts.has(word));
    const shared = [...queryConcepts].filter((tag) => record.concepts.has(tag));
    const lexical = cosine(
      queryVector,
      queryNorm,
      tfidf(record.counts, idf, 1),
    );
    const conceptual =
      shared.length /
      (Math.sqrt(queryConcepts.size * record.concepts.size) || 1);
    const score = literalMethod
      ? literal.length / (queryWords.size || 1)
      : 0.65 * lexical + 0.35 * conceptual;
    if (!browse && score === 0) continue;
    const { issues, reasons } = checkConditions(record.role, preferences);
    if (!browse) {
      for (const field of record.fields) {
        const matched = literal.filter((word) => field.tokens.includes(word));
        if (matched.length)
          reasons.push(field.label + " includes " + matched.join(", ") + ".");
      }
      if (!literalMethod) {
        for (const concept of shared) {
          const field = record.fields.find((f) => f.concepts.has(concept));
          const vocabulary = wordsByConcept.find(
            ([label]) => label === concept,
          )[1];
          const evidence = field.tokens.find((token) => vocabulary.has(token));
          reasons.push(
            "Related concept “" +
              concept +
              "” from " +
              field.label.toLowerCase() +
              " (“" +
              evidence +
              "”).",
          );
        }
      }
    }
    const group = issues.some((item) => item.status === "conflict")
      ? "excluded"
      : issues.length
        ? "review"
        : "matches";
    output[group].push({
      opportunity: record.role,
      score,
      reasons,
      issues,
      matchedTerms: [
        ...new Set([...literal, ...(literalMethod ? [] : shared)]),
      ],
    });
  }
  for (const list of Object.values(output))
    list.sort(
      (a, b) =>
        b.score - a.score ||
        (a.opportunity.id < b.opportunity.id
          ? -1
          : a.opportunity.id > b.opportunity.id
            ? 1
            : 0),
    );
  return output;
}
