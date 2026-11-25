import {
  EXERCISE_CASE_TEXT,
  exerciseEvidence,
  exerciseLanguageExamples,
  exerciseProfile,
  exerciseRoles,
  matchExercise,
} from "./exercise-engine.js";
import { escapeText as e } from "./html.js";
import { icon } from "./icons.js";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const codeUrl = "https://github.com/rongsenzhang/common-hours/blob/main/site/exercise-engine.js";

function selectField(name, label, options) {
  return `<label class="ex-field">${label}<select name="${name}">${options
    .map(([value, text]) => `<option value="${value}">${text}</option>`)
    .join("")}</select></label>`;
}

function controls() {
  return `<details class="ex-controls" id="ex-controls" open>
    <summary>${icon("filter", 20)}<span>Volunteer conditions</span>${icon("down", 18)}</summary>
    <form id="exercise-form" class="ex-form" novalidate>
      <fieldset class="ex-section"><legend>Requirements</legend>
        ${selectField("mode", "Participation", [["either", "Online or in person"], ["in-person", "In person only"], ["online", "Online only"]])}
        <fieldset class="ex-days"><legend>Available days</legend><div>${days
          .map(day => `<label><input type="checkbox" name="days" value="${day}"><span>${day}</span></label>`).join("")}</div></fieldset>
        ${selectField("period", "Time of day", [["evening", "Evenings only"], ["daytime", "Daytime only"], ["any", "Daytime or evening"]])}
        <label class="ex-field">Maximum in-person distance (miles)<input type="number" name="maxMiles" min="0" step="any" required inputmode="decimal" aria-describedby="ex-radius-error"></label>
        <p class="ex-error" id="ex-radius-error" hidden>Enter a distance of zero miles or more.</p>
        ${selectField("clearance", "Safeguarding clearance for this role", [["unknown", "Validity unknown"], ["verified", "Verified for this role"], ["none", "No valid clearance"]])}
      </fieldset>
      <fieldset class="ex-section ex-preferences"><legend>Preferences</legend>
        <label><input name="individual" type="checkbox">One-to-one support</label>
        <label><input name="digital" type="checkbox">Using digital support skills</label>
      </fieldset>
    </form>
  </details>`;
}

function titleList(items) {
  if (!items.length) return "<p>No roles.</p>";
  return `<ol>${items.map(({ role }) => `<li>${e(role.title)}</li>`).join("")}</ol>`;
}

function reasons(item) {
  return item.reasons.map(e).join(" ");
}

function recommended(items) {
  if (!items.length) return '<p class="ex-empty">No role is ready to recommend with these conditions. Review the other records below or change an input.</p>';
  return `<ol class="ex-recs">${items.map(item => `<li>
    <article><div class="ex-card-top"><h3>${e(item.role.title)}</h3><span class="ex-fit">${e(item.fit)}</span></div>
    <p class="ex-when">${item.role.id === "form-filling-volunteer" ? "Original listing · " : ""}${e(item.role.whenWhere)}</p><p class="ex-activity">${e(item.role.activity)}.</p>
    <p class="ex-reason">${reasons(item)}</p></article>
  </li>`).join("")}</ol>`;
}

function reviewed(items, key) {
  if (!items.length) return "<p>No roles in this group.</p>";
  return `<ul class="ex-review-list">${items.map(item =>
    `<li><strong>${e(item.role.title)}</strong><p>${reasons(item)}${key === "other" && item.fit !== "No stated interest match" ? " Other eligible roles filled the three shortlist places." : ""}</p></li>`
  ).join("")}</ul>`;
}

function disclosure(key, heading, open = false) {
  return `<details class="ex-disclosure ex-${key}"${open ? " open" : ""}><summary>
    <span>${heading}</span><span class="ex-count" id="ex-${key}-count"></span>${icon("down", 17)}
  </summary><div class="ex-detail-body" id="ex-${key}"></div></details>`;
}

function records() {
  return exerciseRoles.map(role => {
    const evidence = exerciseEvidence(role);
    const tags = [
      evidence.individual && `One-to-one from “${e(evidence.individual)}”`,
      evidence.digital && `Digital support from “${e(evidence.digital)}”`,
    ].filter(Boolean);
    return `<li><h4>${e(role.title)}</h4><p>${e(role.activity)}</p>
      <dl><div><dt>When and where</dt><dd>${e(role.whenWhere)}</dd></div>
      <div><dt>Requirement</dt><dd>${e(role.requirement)}</dd></div>
      <div><dt>Derived interests</dt><dd>${tags.length ? tags.join(" · ") : "None identified"}</dd></div></dl>
    </li>`;
  }).join("");
}

function venueScenario() {
  return `<fieldset id="ex-venue-scenario" class="ex-scenario">
    <legend>What if the venue distance is confirmed?</legend>
    <p id="ex-venue-help"><strong>Form-filling volunteer</strong> takes place in person. Its original listing gives no distance. Test a hypothetical distance from this volunteer.</p>
    <div class="ex-distance-options">${[["unknown", "Unknown (source)"], ["2", "2 miles"], ["5", "5 miles"]]
      .map(([value, text]) => `<label><input type="radio" name="formFillingMiles" value="${value}" aria-describedby="ex-venue-help"${value === "unknown" ? " checked" : ""}>${text}</label>`).join("")}</div>
    <p id="ex-venue-outcome" class="ex-scenario-outcome"></p>
  </fieldset>`;
}

function venueOutcome(result) {
  const target = row => row.role.id === "form-filling-volunteer";
  const rank = result.recommendations.findIndex(target);
  if (rank >= 0) return `Form-filling volunteer is number ${rank + 1} on the shortlist.`;
  const pending = result.pending.find(target);
  if (pending) return "Needs confirmation. " + pending.reasons.join(" ");
  const excluded = result.excluded.find(target);
  if (excluded) return "Ruled out. " + excluded.reasons.join(" ");
  return "Form-filling volunteer is among the other feasible roles.";
}

function tagList(individual, digital) {
  const tags = [];
  if (individual) tags.push("One-to-one support");
  if (digital) tags.push("Digital support");
  return tags.join(", ") || "No matching tags";
}

function wordingChecks() {
  const checks = exerciseLanguageExamples.map(example => {
    const actual = exerciseEvidence({activity: example.text});
    const passed = Boolean(actual.individual) === example.individual && Boolean(actual.digital) === example.digital;
    return `<li data-check="${passed ? "pass" : "check"}"><div class="ex-check-heading">
      <q>${e(example.text)}</q><strong>${passed ? "Pass" : "Check"}</strong></div>
      <dl><div><dt>Expected</dt><dd>${tagList(example.individual, example.digital)}</dd></div>
      <div><dt>Observed</dt><dd>${tagList(actual.individual, actual.digital)}</dd></div></dl></li>`;
  }).join("");
  return `<details class="ex-disclosure" id="ex-wording"><summary><span>Wording checks</span>${icon("down", 17)}</summary>
    <div class="ex-detail-body"><p>These additional phrases test how the matcher reads activity descriptions. The seven case records are listed separately.</p>
    <ul class="ex-checks">${checks}</ul><div class="ex-links"><a href="https://github.com/rongsenzhang/common-hours/blob/main/tests/exercise.mjs">Inspect the tests ${icon("external", 14)}</a></div></div>
  </details>`;
}

function odiFields() {
  return `<details class="ex-disclosure" id="ex-odi"><summary><span>ODI field guide</span>${icon("down", 17)}</summary>
    <div class="ex-detail-body"><p>These fields in the volunteering opportunity standard help explain the form-filling decision.</p>
    <dl class="ex-mapping">
      <div><dt>Activity description · <code>Role.description</code></dt><dd>“Online forms” describes the work. The matcher uses those words as evidence of digital support.</dd></div>
      <div><dt>Remote option · <code>Role.allowsRemoteParticipation</code></dt><dd>This role is explicitly in person. The published field records whether remote participation is allowed. A role allowing it could also offer an in-person option.</dd></div>
      <div><dt>When and where · <code>Session.time</code> and <code>Session.location</code></dt><dd>The record gives Thursday evening and no venue address. Distance in miles depends on the volunteer’s starting point. The 2- and 5-mile scenarios add a temporary distance assumption.</dd></div>
      <div><dt>Eligibility · <code>Role.requirement</code></dt><dd>Youth reading mentor requires verified safeguarding clearance. Whether this volunteer’s clearance is valid for that role is a separate, private check.</dd></div>
    </dl>
    <div class="ex-links"><a href="https://standard.volunteeringdata.io/ontology">Explore the published data model ${icon("external", 14)}</a></div></div>
  </details>`;
}

function layout() {
  return `<div class="ex-page">
    <header class="ex-header"><h1>Matching exercise</h1>
      <p>Compare volunteer conditions with the seven fictional roles supplied in the recruitment task.</p>
    </header>
    <div class="ex-empty" id="ex-welcome">
      <h2>Welcome to the matching exercise</h2>
      <p>Choose a case to see its shortlist. Then change a condition or try a different venue distance to see how the recommendations respond.</p>
    </div>
    <div class="ex-cases" role="group" aria-label="Load a case">
      <button type="button" data-ex-case="A" aria-pressed="false"><strong>Case A</strong><span>Online or in person</span></button>
      <button type="button" data-ex-case="B" aria-pressed="false"><strong>Case B</strong><span>In person only</span></button>
    </div>
    <p class="ex-case-note">Both cases start with weekday evenings, a three-mile travel limit and unverified clearance. One-to-one work and using digital skills are preferences. <a href="#ask-exercise">Try these cases in the role finder</a>.</p>
    <div class="ex-workspace" id="ex-workspace" hidden>
      ${controls()}
      <section class="ex-results" aria-label="Match results and venue scenario">
        ${venueScenario()}
        <div id="ex-output">
          <div class="ex-result-head"><h2 id="ex-shortlist-title">Shortlist</h2><span class="ex-current" id="ex-current"></span></div>
          <div id="ex-recommendations"></div>
          <div id="ex-breakdown">
            ${disclosure("pending", "Needs confirmation", true)}
            ${disclosure("other", "Other feasible roles")}
            ${disclosure("excluded", "Ruled out")}
            <details class="ex-disclosure"><summary><span>Compare with a simple filter</span>${icon("down", 17)}</summary>
              <div class="ex-detail-body"><p>Both methods apply the same requirements. The filter takes the first three feasible records in the supplied order. The shortlist also uses the volunteer’s interests.</p><div id="ex-baseline" class="ex-comparison"></div></div>
            </details>
          </div>
        </div>
      </section>
    </div>
    <section aria-label="Inspect the exercise" class="ex-evidence">
      <details class="ex-disclosure"><summary><span>Matching rules</span>${icon("down", 17)}</summary>
        <div class="ex-detail-body"><ol class="ex-rules">
          <li><strong>Check feasibility.</strong> Apply the selected days, time, setting, in-person travel limit and any required clearance. A known conflict rules a role out. An unresolved required fact needs confirmation. Online roles require no travel.</li>
          <li><strong>Interpret preferences.</strong> Treat one-to-one work and digital support as preferences. A small vocabulary links record wording to those concepts. Open the source records to see each phrase behind a tag.</li>
          <li><strong>Rank viable roles.</strong> Award one point for each selected preference the record supports. Return up to three roles with a positive score. Break ties in the supplied record order. With both preferences off, use that order for all feasible roles.</li>
        </ol><div class="ex-links"><a href="${codeUrl}">Inspect the matching code ${icon("external", 14)}</a>
        <a href="https://github.com/rongsenzhang/common-hours/blob/main/docs/matching-exercise.md">Run the exercise locally ${icon("external", 14)}</a></div></div>
      </details>
      <details class="ex-disclosure" id="exercise-records"><summary><span>Seven recruitment-task records</span>${icon("down", 17)}</summary>
        <div class="ex-detail-body"><p>The recruitment task supplies each role’s title, activity, time, location and requirements. “None listed” means the record gives no extra requirement. The matcher adds the derived interests.</p><ul class="ex-records">${records()}</ul>
        <h3 class="ex-source-heading">Original case inputs</h3>
        <dl class="ex-mapping"><div><dt>Case A · Online or in person</dt><dd>“${e(EXERCISE_CASE_TEXT.A)}”</dd></div>
        <div><dt>Case B · In person only</dt><dd>${e(EXERCISE_CASE_TEXT.B)}</dd></div></dl></div>
      </details>
      ${wordingChecks()}
      ${odiFields()}
    </section>
    <p class="sr" role="status" id="ex-status"></p>
  </div>`;
}

function putProfile(form, profile) {
  for (const key of ["mode", "period", "maxMiles", "clearance"]) form.elements[key].value = profile[key];
  for (const key of ["individual", "digital"]) form.elements[key].checked = profile[key];
  for (const box of form.querySelectorAll("[name=days]")) box.checked = profile.days.includes(box.value);
}

function readProfile(form) {
  const fields = form.elements;
  return {
    mode: fields.mode.value,
    days: [...form.querySelectorAll("[name=days]:checked")].map(box => box.value),
    period: fields.period.value,
    maxMiles: fields.maxMiles.valueAsNumber,
    clearance: fields.clearance.value,
    individual: fields.individual.checked,
    digital: fields.digital.checked,
  };
}

function caseName(profile) {
  for (const name of ["A", "B"]) {
    const preset = exerciseProfile(name);
    if (Object.keys(preset).every(key => key === "days"
      ? preset.days.join() === profile.days.join()
      : preset[key] === profile[key])) return name;
  }
  return null;
}

export function mountExercise(main) {
  main.innerHTML = layout();
  const find = id => main.querySelector("#ex-" + id);
  const form = main.querySelector("#exercise-form");
  const venue = find("venue-scenario");
  const caseButtons = [...main.querySelectorAll("[data-ex-case]")];
  if (window.matchMedia("(max-width: 740px)").matches) find("controls").open = false;

  function update() {
    if (find("workspace").hidden) return;
    const profile = readProfile(form);
    const radius = form.elements.maxMiles;
    radius.disabled = profile.mode === "online";
    // With no in-person roles, an unfinished distance field has no bearing on eligibility.
    if (radius.disabled && (!Number.isFinite(profile.maxMiles) || profile.maxMiles < 0)) profile.maxMiles = 0;
    const invalid = !radius.disabled && !radius.validity.valid;
    radius.setAttribute("aria-invalid", String(invalid));
    find("radius-error").hidden = !invalid;
    const preset = caseName(profile);
    const selected = venue.querySelector("input:checked").value;
    const formFillingMiles = selected === "unknown" ? null : Number(selected);
    for (const button of caseButtons) button.setAttribute("aria-pressed", String(button.dataset.exCase === preset && formFillingMiles === null));
    const profileName = preset ? "Case " + preset : "Edited conditions";
    find("current").textContent = formFillingMiles === null ? profileName : profileName + " · venue scenario";
    find("breakdown").hidden = invalid;
    if (invalid) {
      find("recommendations").innerHTML = '<p class="ex-empty">Enter a valid travel limit to update the shortlist.</p>';
      find("venue-outcome").textContent = "";
      find("status").textContent = "Waiting for a valid travel limit.";
      return;
    }
    const result = matchExercise(profile, {formFillingMiles});
    const outcome = venueOutcome(result);
    find("venue-outcome").textContent = outcome;
    find("recommendations").innerHTML = recommended(result.recommendations);
    for (const key of ["pending", "other", "excluded"]) {
      find(key + "-count").textContent = String(result[key].length);
      find(key).innerHTML = reviewed(result[key], key);
    }
    find("baseline").innerHTML = `<div><h3>Simple filter</h3>${titleList(result.baseline)}</div>
      <div><h3>With preferences</h3>${titleList(result.recommendations)}</div>`;
    const top = result.recommendations[0];
    find("status").textContent = `${find("current").textContent}. ${result.recommendations.length} recommended. ${top ? "First, " + top.role.title + ". " : ""}${result.pending.length} awaiting confirmation. ${outcome}`;
  }

  function loadCase(event) {
    const button = event.target.closest("[data-ex-case]");
    if (!button) return;
    putProfile(form, exerciseProfile(button.dataset.exCase));
    venue.querySelector('input[value="unknown"]').checked = true;
    find("welcome").hidden = true;
    find("workspace").hidden = false;
    update();
  }

  function handleNumber(event) {
    if (event.target.name === "maxMiles") update();
  }

  function preventSubmit(event) {
    event.preventDefault();
  }

  const cases = main.querySelector(".ex-cases");
  cases.addEventListener("click", loadCase);
  venue.addEventListener("change", update);
  form.addEventListener("change", update);
  form.addEventListener("input", handleNumber);
  form.addEventListener("submit", preventSubmit);
  return () => {
    cases.removeEventListener("click", loadCase);
    venue.removeEventListener("change", update);
    form.removeEventListener("change", update);
    form.removeEventListener("input", handleNumber);
    form.removeEventListener("submit", preventSubmit);
  };
}
