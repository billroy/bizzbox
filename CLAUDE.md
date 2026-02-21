# BizzBox — Claude Code Project Notes

## Ports
- **5050** — Reserved for user testing. Never use this port.
- **5051** — Use this port for Claude's automated testing (`python3 app.py --port 5051`).

## DigitalOcean App Platform Deployment
- **App ID:** `413c68bd-e929-45ea-9859-b838be0c56e0`
- **Live URL:** https://bizzbox-lkbxm.ondigitalocean.app
- **Source:** `git` clone URL (not GitHub integration — no login required)

### IMPORTANT: Deploying new code
DO caches the git repo when using `repo_clone_url`. A normal `apps-update` spec
change will rebuild from the **cached** source, ignoring new commits on main.

**You MUST include `"update_all_source_versions": true`** in the update request
to force DO to re-fetch the latest code from GitHub. Example:

```json
{
  "app_id": "413c68bd-e929-45ea-9859-b838be0c56e0",
  "request": {
    "spec": { ... },
    "update_all_source_versions": true
  }
}
```

After deploying, verify the `source_commit_hash` in the deployment status matches
the expected commit on `origin/main`. If it shows an old commit, you forgot
`update_all_source_versions`.
