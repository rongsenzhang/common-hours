// Small, labelled examples for local activity classification. No participant data is used.
// Each label maps to an activity query for the same catalogue search used by the finder.
const topics = [
  [
    "walk dogs",
    [
      "dog walking at an animal shelter",
      "dog walks and walking for a canine companion",
      "walk dogs at an animal shelter",
      "take a dog or a pooch for a walk",
      "exercise rescue hounds on a lead",
      "walk a puppy outdoors",
    ],
  ],
  [
    "animal supplies",
    [
      "sort pet supplies and animal food",
      "pack donated pet supplies for a shelter",
      "organise pet donations for animals",
    ],
  ],
  [
    "cycle repair",
    [
      "repair a bicycle at a cycle workshop",
      "fix bikes and repair punctures",
      "mend a bicycle wheel or tyre",
    ],
  ],
  [
    "garden",
    [
      "gardening outdoors in an allotment",
      "garden and gardening activities",
      "grow vegetables in a community garden",
      "plant seedlings in allotment beds",
      "tend a garden and water plants",
    ],
  ],
  [
    "seed library",
    [
      "sort and label seeds",
      "organise seed packets",
      "prepare seed library information cards",
    ],
  ],
  [
    "litter",
    [
      "pick rubbish up by the river",
      "collect litter on a riverside walk",
      "clean up trash and sort recycling",
    ],
  ],
  [
    "reading",
    [
      "help adults sound out words",
      "practise English pronunciation with adult learners",
      "read stories aloud and teach literacy",
    ],
  ],
  [
    "groceries",
    [
      "sort groceries and pack food parcels",
      "check tins in a food bank",
      "pack food donations in a pantry",
    ],
  ],
  [
    "cooking",
    [
      "cook meals in a community kitchen",
      "prepare food and chop vegetables",
      "join a kitchen team making meals",
    ],
  ],
  [
    "smartphones",
    [
      "teach people how to use tablets or smartphones",
      "explain device settings and email",
      "help someone use a computer or mobile phone",
    ],
  ],
  [
    "telephone companion",
    [
      "listen to people who feel lonely",
      "call isolated neighbours for a friendly chat",
      "keep someone company by telephone",
    ],
  ],
  [
    "archive",
    [
      "transcribe old letters from scans",
      "read handwriting for a local history archive",
      "turn historical manuscripts into typed text",
    ],
  ],
  [
    "repair",
    [
      "mend broken household items",
      "fix things at a repair cafe",
      "sort workbench tools for repairs",
    ],
  ],
  [
    "posters",
    [
      "draw artwork for local posters",
      "design publicity or graphic illustrations",
      "create posters for arts events",
    ],
  ],
  [
    "welcome",
    [
      "greet visitors at reception",
      "give directions at the welcome desk",
      "welcome people to the neighbourhood centre",
    ],
  ],
  [
    "testing",
    [
      "try website navigation and report bugs",
      "test a charity website",
      "review usability and find issues online",
    ],
  ],
  [
    "birds",
    [
      "watch birds in a park",
      "record wildlife sightings",
      "count birds and observe nature",
    ],
  ],
  [
    "captions",
    [
      "write captions for audio interviews",
      "edit subtitles and transcripts",
      "caption recorded interviews",
    ],
  ],
];

const common = new Set(
  `
  a an the as at by for from in of on or to up with and
  i id im me my it that these this those them they someone anyone people
  am are be can could do does doing have is should would will
  about also another any anything around available find findme first get give go
  good got keen help helping how interested interest interests know kind lets like locally local looking
  love maybe more much need new now offer offering only opportunity opportunities
  option options passionate passion please prefer project projects question really
  recommend recommended recommendation recommendations rather role roles search
  seeking show some something spare spend suggest suggested suggestions suitable
  tell than thanks thank there time try volunteer volunteering want way ways what
  where whether which who why work working you your activities activity
`
    .trim()
    .split(/\s+/),
);

export function topicTokens(input) {
  return (input.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (word) => !common.has(word),
  );
}

// Unit-length TF-IDF centroids fitted to authored examples. Unfamiliar or ambiguous
// requests fall back to their original words, rather than inventing a new interest.
function trainTopicClassifier() {
  const frequency = new Map();
  const rows = topics.map(([query, samples]) => {
    const counts = new Map();
    for (const word of samples.flatMap(topicTokens))
      counts.set(word, (counts.get(word) || 0) + 1);
    for (const word of counts.keys())
      frequency.set(word, (frequency.get(word) || 0) + 1);
    return { query, counts };
  });
  const idf = new Map(
    [...frequency].map(([word, value]) => [
      word,
      1 + Math.log((rows.length + 1) / (value + 1)),
    ]),
  );
  const vectors = rows.map(({ query, counts }) => {
    const weights = new Map(
      [...counts].map(([word, count]) => [
        word,
        (1 + Math.log(count)) * idf.get(word),
      ]),
    );
    return { query, weights, norm: Math.hypot(...weights.values()) };
  });
  return function classify(tokens) {
    // Preserve the breadth of a one-word interest. Several different activities can fit.
    if (tokens.length === 1) {
      if (/^(?:animals?|pets?|dogs?|cats?)$/.test(tokens[0]))
        return /^(?:cats?|dogs?)$/.test(tokens[0])
          ? tokens[0].replace(/s$/, "")
          : "animals";
      if (tokens[0] === "food") return "food";
      if (/^(?:cycle|bicycle|bike)s?$/.test(tokens[0])) return "cycling";
    }
    const unique = [...new Set(tokens)];
    if (!unique.length || unique.some((word) => !idf.has(word))) return null;
    const norm = Math.hypot(...unique.map((word) => idf.get(word)));
    const scores = vectors
      .map(({ query, weights, norm: labelNorm }) => ({
        query,
        value:
          unique.reduce(
            (sum, word) => sum + (weights.get(word) || 0) * idf.get(word),
            0,
          ) /
          (norm * labelNorm),
        coverage:
          unique.filter((word) => weights.has(word)).length / unique.length,
      }))
      .sort((a, b) => b.value - a.value);
    const [first, second] = scores;
    if (
      first.coverage < 1 ||
      first.value < 0.25 ||
      first.value - second.value < 0.1
    )
      return null;
    if (
      first.query === "walk dogs" &&
      !unique.some((word) => /^(dog|dogs|pooch|hound|hounds|puppy)$/.test(word))
    )
      return null;
    return first.query;
  };
}

export const inferActivity = trainTopicClassifier();

// A related word in the area, organisation or description is insufficient evidence
// of the activity itself. Check a role's title/tasks before presenting an inferred intent.
export const activityEvidence = {
  cycling: [/\b(?:cycle|cycling|bike|bicycle)\w*\b/i],
  animals: [/\b(?:animals?|pets?|dogs?|cats?)\b/i],
  dog: [/\bdogs?\b/i],
  cat: [/\bcats?\b/i],
  food: [/\b(?:grocer\w*|food|pantr\w*|cook\w*|kitchen)\b/i],
  "walk dogs": [
    /\b(?:dogs?|canines?|hounds?|pupp(?:y|ies))\b/i,
    /\bwalk(?:s|er|ing)?\b/i,
  ],
  "animal supplies": [
    /\b(?:animal|pet)\b/i,
    /\b(?:suppl\w+|blankets|donations)\b/i,
  ],
  "cycle repair": [
    /\b(?:bi?cycles?|bikes?)\b/i,
    /\b(?:repair\w*|mend\w*|fix\w*|puncture\w*)\b/i,
  ],
  garden: [
    /\b(?:gardens?|gardening|gardener|allotments?|vegetables|seedlings|raised beds)\b/i,
  ],
  "seed library": [/\bseeds?\b/i],
  litter: [/\b(?:litter\w*|rubbish|trash)\b/i],
  reading: [/\b(?:reading|literacy|read|pronunciation)\b/i],
  groceries: [/\b(?:pantr\w*|grocer\w*|food parcels|food bank)\b/i],
  cooking: [/\b(?:cook\w*|kitchen|chop vegetables|prepare meals)\b/i],
  smartphones: [/\b(?:digital drop-in|devices?|smartphones?|email)\b/i],
  "telephone companion": [/\b(?:listen\w*|companion\w*|befriend\w*)\b/i],
  archive: [/\b(?:history|historic\w*|archive\w*|transcribe\w*)\b/i],
  repair: [/\b(?:repair\w*|mending|fix\w*)\b/i],
  posters: [/\b(?:posters?|artwork|graphic design)\b/i],
  welcome: [/\b(?:welcom\w*|greet\w*|reception)\b/i],
  testing: [/\b(?:test\w*|bug reports|usability)\b/i],
  birds: [/\b(?:birds?|birdwatch\w*|wildlife)\b/i],
  captions: [/\b(?:captions?|subtitles?)\b/i],
};
