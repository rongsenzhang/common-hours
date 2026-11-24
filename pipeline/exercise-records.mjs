// Project the same seven source records used by the panel into the catalogue.
import { exerciseEvidence, exerciseRoles } from "../site/exercise-engine.js";

const themes = {
  "digital-access-buddy": "digital",
  "community-cafe-host": "food",
  "youth-reading-mentor": "learning",
  "food-parcel-packer": "food",
  "conversation-partner": "learning",
  "form-filling-volunteer": "digital",
  "digital-skills-facilitator": "digital",
};

const rows = exerciseRoles.map(role => {
  const [slot, setting] = role.whenWhere.split(" · ");
  const miles = /^(\d+(?:\.\d+)?) miles?$/.exec(setting);
  const online = setting === "online";
  if (!online && !miles && setting !== "in person, distance not recorded") {
    throw new Error("Unrecognised exercise setting for " + role.id);
  }
  if (!themes[role.id] || !["Verified safeguarding clearance", "None listed"].includes(role.requirement)) {
    throw new Error("Check the exercise catalogue mapping for " + role.id);
  }
  const evidence = exerciseEvidence(role);
  return {
    id: role.id, title: role.title, activity: role.activity, theme: themes[role.id], slot,
    time: /^(Sat|Sun) /.test(slot) ? "weekend" : "weekday",
    mode: online ? "remote" : "onsite", distanceMiles: miles ? Number(miles[1]) : null,
    clearance: role.requirement === "Verified safeguarding clearance" ? "required" : "none-listed",
    individualEvidence: evidence.individual, digitalEvidence: evidence.digital,
  };
});

process.stdout.write(JSON.stringify(rows));
