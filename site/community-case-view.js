import { escapeText as e } from "./html.js";
import { exerciseProfile } from "./exercise-engine.js";
import { matchCommunityCase } from "./community-case.js";

export function discoverCaseFromHash(hash) {
  return /^#discover-case-([ab])$/i.exec(hash)?.[1].toUpperCase() ?? null;
}

function roleRow({role, fit, reasons}) {
  return '<li><div class="community-case-role"><button type="button" data-detail="' + e(role.id)
    + '">' + e(role.title) + '</button><span>' + e(fit) + '</span></div><p>'
    + e(role.organisation) + ' · ' + e(role.area) + '</p><ul>'
    + reasons.map(reason => '<li>' + e(reason) + '</li>').join('') + '</ul></li>';
}

function options(choices, selected) {
  return choices.map(([value, label]) => '<option value="' + e(value) + '"'
    + (value === selected ? ' selected' : '') + '>' + e(label) + '</option>').join('');
}

function controls(profile) {
  return '<details class="community-case-controls"><summary>Change the volunteer’s conditions</summary>'
    + '<form id="community-case-form"><label class="field">Participation<select name="mode">'
    + options([['either','Online or in person'],['in-person','In person only'],['online','Online only']], profile.mode)
    + '</select></label><label class="field">Maximum travel (miles)<input type="number" name="maxMiles" required min="0" step="any" value="'
    + e(profile.maxMiles) + '"></label><label class="field">Available on<select name="days">'
    + options([['weekdays','Weekdays'],['weekends','Weekends'],['any','Any day']], profile.days.length === 7 ? 'any' : profile.days.includes('Mon') ? 'weekdays' : 'weekends')
    + '</select></label><label class="field">Time of day<select name="period">'
    + options([['evening','Evening'],['daytime','Daytime'],['any','Any time']], profile.period)
    + '</select></label><button class="secondary" type="submit">Update shortlist</button></form></details>';
}

export function profileFromCommunityForm(caseId, formData) {
  const profile = exerciseProfile(caseId);
  const days = {weekdays: profile.days, weekends: ['Sat','Sun'], any: [...profile.days, 'Sat', 'Sun']};
  return {...profile, mode: formData.get('mode'), period: formData.get('period'),
    days: days[formData.get('days')], maxMiles: Number(formData.get('maxMiles'))};
}

export function renderCommunityCases(roles, caseId, profile = null) {
  const links = ['A','B'].map(id => '<a class="' + (id === caseId ? 'primary' : 'secondary')
    + '" href="#discover-case-' + id.toLowerCase() + '"' + (id === caseId ? ' aria-current="true"' : '')
    + '>Case ' + id + '</a>').join('');
  let content = '';
  if (caseId) {
    profile ??= exerciseProfile(caseId);
    const {recommendations, pending} = matchCommunityCase(roles, profile);
    const period = {daytime:'daytime',evening:'evenings',any:'any time'}[profile.period];
    const mode = {'in-person':'in person only', either:'online or in person', online:'online only'}[profile.mode];
    const days = profile.days.length === 7 ? 'Any day' : profile.days.includes('Mon') ? 'Weekdays' : 'Weekends';
    const summary = [days, period, mode, 'up to ' + profile.maxMiles + ' miles'].join(' · ');
    content = '<div id="community-case-results"><h3 tabindex="-1" id="community-case-shortlist">Case ' + caseId + ' community shortlist</h3>'
      + '<p class="community-case-summary">' + e(summary) + '</p><p>Prefers one-to-one work and digital support. Safeguarding clearance for a new role is unconfirmed.</p>'
      + controls(profile)
      + (recommendations.length ? '<p>Up to three confirmed matches, ranked by the number of evidenced interests. Ties are alphabetical.</p>'
        + '<ol class="community-case-list">' + recommendations.map(roleRow).join('') + '</ol>'
        : '<p>No role with a stated interest match meets all the current requirements.</p>')
      + (pending.length ? '<details class="community-case-pending"><summary>Needs confirmation (' + pending.length + ')</summary><ul class="community-case-list">'
        + pending.map(roleRow).join('') + '</ul></details>' : '')
      + '<p class="community-case-source">Distances use the fictional case volunteer’s starting point. '
      + '<a href="#exercise">Compare the seven interview roles</a>.</p></div>';
  }
  return '<section id="community-cases" aria-labelledby="community-case-heading"><div class="community-case-head"><div>'
    + '<h2 tabindex="-1" id="community-case-heading">Try a volunteer case</h2><p>Run the interview conditions against '
    + roles.length + ' fictional community roles.</p></div><div class="community-case-links">' + links + '</div></div>' + content + '</section>';
}

export function communityRoleFacts(role) {
  const facts = role.caseFacts;
  if (!facts) return '';
  const slots = facts.slots.map(slot => slot.day + ' ' + slot.period).join(', ') || 'Ask the host for session details';
  const miles = role.mode === 'remote' ? 'No travel needed' : Number.isFinite(facts.distanceMiles)
    ? facts.distanceMiles + (facts.distanceMiles === 1 ? ' mile' : ' miles') : 'Awaiting confirmation';
  const clearance = {'none-listed':'None listed', required:'Role-specific clearance required', unknown:'Awaiting confirmation'};
  return [['Session times',slots],['Distance from the fictional case volunteer',miles],['Safeguarding requirement',clearance[facts.clearance]]]
    .map(([name,value]) => '<div><dt>' + e(name) + '</dt><dd>' + e(value) + '</dd></div>').join('');
}
