#!/usr/bin/env bash
# Run from the verified source checkout on main. This key can write only to the private mirror.
set -euo pipefail
: "${ADMIN_PUBLISH_KEY:?Private dashboard publish key is missing}"
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
umask 077
printf '%s\n' "$ADMIN_PUBLISH_KEY" > "$stage/publish-key"
unset ADMIN_PUBLISH_KEY
printf '%s\n' 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' > "$stage/known_hosts"
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=$stage/known_hosts -i $stage/publish-key"
mirror="$stage/mirror"
git clone --quiet --depth 1 git@github.com:rongsenzhang/common-hours-admin.git "$mirror"
mkdir -p "$mirror/data" "$mirror/site"
cp site/data/{catalog,evaluation,semantic,host-questions}.json "$mirror/data/"
cp site/{style.css,icons.js,engine.js} "$mirror/site/"
cp -R admin "$mirror/"
cp -R site/assets "$mirror/site/"
cp package.json "$mirror/package.json"
if [[ -d .devcontainer ]]; then cp -R .devcontainer "$mirror/"; fi
node admin/export-dashboard.mjs --data-dir "$mirror/data" --output "$mirror/README.md"
git -C "$mirror" config user.name 'Common Hours release'
git -C "$mirror" config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git -C "$mirror" add README.md data admin site package.json
if [[ -d "$mirror/.devcontainer" ]]; then git -C "$mirror" add .devcontainer; fi
if ! git -C "$mirror" diff --cached --quiet; then
  git -C "$mirror" commit --quiet -m "Refresh staff workspace for ${GITHUB_SHA:0:8}"
  git -C "$mirror" push --quiet origin HEAD:main
fi
