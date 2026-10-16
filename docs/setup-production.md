# Setup checklist for the PO

One-time setup of GitHub, the two Supabase projects and Vercel (backlog v0.1.0 items 5, 10, 13–15;
decisions T3, T4, D4, D5). Do the sections in order: Vercel needs the Supabase keys, and Supabase needs
the Vercel URLs.

**Secrets never go into chat, issues, commits or the repository.** Paste them only into the GitHub,
Supabase and Vercel settings screens named below. Note them in your password manager.

## 1. GitHub repository

### 1.1 Branches and merge buttons

- [ ] `main` and `dev` exist on GitHub (`dev` branched from `main`).
- [ ] **Default branch:** Settings → General → Default branch → click the ⇄ button → choose `main` →
      Update → confirm.
- [ ] **Merge buttons:** Settings → General → section **Pull Requests**:
  - tick **Allow merge commits** (for `dev` → `main` and the back-merge);
  - tick **Allow squash merging**, and set "Default commit message" to **Pull request title** (work
    branches into `dev`, and the release PR);
  - untick **Allow rebase merging**;
  - tick **Automatically delete head branches** (`main` and `dev` are protected and are never deleted).

### 1.2 Actions

- [ ] Settings → Actions → General → **Workflow permissions** → choose **Read and write permissions**
      and tick **Allow GitHub Actions to create and approve pull requests** → Save. release-please and
      the back-merge workflow need this to open PRs.

### 1.3 Rulesets (protect `main` and `dev`)

- [ ] Settings → Rules → Rulesets → **New ruleset** ▾ → **Import a ruleset** → choose
      `.github/rulesets/main.json` from the repository (download it from GitHub first: open the file →
      ⋯ → Download) → check the preview → **Create**.
- [ ] Repeat with `.github/rulesets/dev.json`.

Both rulesets: no deletion, no force pushes, a pull request is required (no approvals, you work alone),
and these status checks must pass: `Lint and format`, `Typecheck`, `Test`, `Build`, `Branch name`,
`PR title`, `Commit messages`, `Database`. `dev` allows squash (work branches) and merge commits
(back-merge); `main` allows merge commits (`dev` → `main`) and squash (the release PR).

Repository admins (you) may **bypass the rules only when merging a pull request**, never for direct
pushes. You need this for PRs that GitHub Actions opens (release and back-merge PRs): GitHub does not run
CI on them, so their checks never report. On such a PR, tick "Merge without waiting for requirements to
be met (bypass rules)" and merge. To get CI on those PRs instead, do the optional step 1.5.

### 1.4 Environments for database deploys

The **Database deploy** workflow applies migrations: to `cycling-hub-dev` on a merge into `dev`, to
`cycling-hub-prod` on a merge into `main` after your approval. The values come from section 2; come back
here when you have them.

- [ ] Settings → Environments → **New environment** → name `dev` → **Configure environment**.
  - Deployment branches and tags → **Selected branches and tags** → **Add deployment branch or tag
    rule** → `dev` → Add rule.
  - Environment secrets → **Add environment secret**, three times (values from the **dev** project):

    | Name                    | Value                                                  |
    | ----------------------- | ------------------------------------------------------ |
    | `SUPABASE_ACCESS_TOKEN` | your Supabase access token (2.5)                       |
    | `SUPABASE_DB_PASSWORD`  | the database password of `cycling-hub-dev` (2.1)       |
    | `SUPABASE_PROJECT_REF`  | the project ID of `cycling-hub-dev` (2.2)              |

- [ ] Settings → Environments → **New environment** → name `production` → **Configure environment**.
  - Tick **Required reviewers** → add yourself → untick **Prevent self-review** (you merge and you
    approve) → **Save protection rules**. This is the approval gate for production migrations.
  - Deployment branches and tags → **Selected branches and tags** → add rule `main`.
  - Add the same three secrets, with the values of **`cycling-hub-prod`**.

When a production deploy waits: Actions → the **Database deploy** run → **Review deployments** → tick
`production` → **Approve and deploy**.

### 1.5 Optional: CI on release and back-merge PRs

- [ ] Create a fine-grained token: your avatar → Settings → Developer settings → Personal access tokens →
      Fine-grained tokens → **Generate new token**. Name `cycling-hub-release-please`, expiry one year,
      Repository access → Only select repositories → this repository. Permissions → Repository
      permissions: **Contents** read and write, **Pull requests** read and write, **Issues** read and
      write. Generate and copy it.
- [ ] Repository Settings → Secrets and variables → Actions → **New repository secret** → name
      `RELEASE_PLEASE_TOKEN`, paste the token → Add secret.

With this token release-please and the back-merge workflow open PRs as you, so CI runs on them and you no
longer need the bypass. When the token expires, the workflows fall back to the built-in token.

## 2. Supabase: two projects

Create both projects the same way: `cycling-hub-dev` (dev and previews) and `cycling-hub-prod`
(production). Free projects pause after about a week without use; open the dashboard to resume one.

### 2.1 Create the project

- [ ] [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** → your organization →
      Project name `cycling-hub-dev` (then `cycling-hub-prod`) → **Generate a password** for the database
      and save it in your password manager → Region: an EU region (e.g. Frankfurt) → **Create new project**.

### 2.2 Values you need later

- [ ] **Project ID** (for `SUPABASE_PROJECT_REF`): Project Settings → General → Project ID.
- [ ] **Project URL** (for `VITE_SUPABASE_URL`): click **Connect** at the top of the project, or Project
      Settings → Data API → Project URL (`https://<project-id>.supabase.co`).
- [ ] **Publishable key** (for `VITE_SUPABASE_PUBLISHABLE_KEY`): Project Settings → API Keys →
      Publishable key (starts with `sb_publishable_`). Never use the **secret** key in Vercel or the app.

### 2.3 Authentication

- [ ] Authentication → Sign In / Providers:
  - User Signups → **Allow new users to sign up**: **off** → Save. There is no sign-up in the app (A1).
  - Auth Providers → **Email**: enabled. Leave the other providers off.
- [ ] Authentication → **URL Configuration** (Vercel URLs from section 3; come back after 3.3):
  - `cycling-hub-prod`: **Site URL** = the production URL (e.g. `https://cycling-hub.vercel.app`).
    Redirect URLs → **Add URL** → the production URL followed by `/**`.
  - `cycling-hub-dev`: **Site URL** = the `dev` branch preview URL
    (`https://cycling-hub-git-dev-<your-vercel-team>.vercel.app`). Redirect URLs → add
    `https://cycling-hub-*-<your-vercel-team>.vercel.app/**` (every preview) and
    `http://localhost:5173/**` (local development).

    The password-reset email links back to these URLs; a URL that is not listed is refused.

### 2.4 The single user

- [ ] Authentication → Users → **Add user** → **Create new user** → your email address and a strong
      password → tick **Auto Confirm User** → **Create user**. Do this in both projects.

### 2.5 Access token for GitHub Actions

- [ ] Your avatar (top right) → **Account preferences** → **Access Tokens** → **Generate new token** →
      name `github-actions-cycling-hub`, expiry one year → Generate → copy it once into both GitHub
      environments (1.4). One token works for both projects.

When the token expires, the Database deploy fails at "Link the Supabase project"; generate a new one
and update the secret in both environments.

## 3. Vercel

### 3.1 Import the repository (once)

- [ ] [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → choose the repository →
      Import. Project name `cycling-hub`. Framework Preset: **Vite** (detected). Root Directory `./`.
      Build and output settings come from `vercel.json`; leave them on default.
- [ ] Before clicking Deploy, open **Environment Variables** and add the Production values from 3.2,
      then **Deploy**. Import only once: a second Vercel project on the same repository builds every push
      twice.

### 3.2 Environment variables

Settings → Environment Variables → **Add New**. Add each variable twice, once per environment:

| Key                             | Environment    | Value                                         |
| ------------------------------- | -------------- | --------------------------------------------- |
| `VITE_SUPABASE_URL`             | **Production** | Project URL of `cycling-hub-prod`             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Production** | Publishable key of `cycling-hub-prod`         |
| `VITE_SUPABASE_URL`             | **Preview**    | Project URL of `cycling-hub-dev`              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Preview**    | Publishable key of `cycling-hub-dev`          |

For Preview choose "All Preview branches". These values are public by design (they are in the app
bundle); the database is protected by RLS. Never add the Supabase secret key or the database password to
Vercel. Changed values apply to the next deployment (Deployments → ⋯ → Redeploy).

### 3.3 Git settings

- [ ] Settings → Git → **Production Branch**: `main`.
- [ ] Settings → Git → **Ignored Build Step**: set by `vercel.json` (`bash scripts/vercel-ignore-build.sh`).
      If the dashboard shows its own setting, choose **Run my Bash script** and enter
      `bash scripts/vercel-ignore-build.sh`. It builds every preview, and production only for the
      release commit, so the version in the app always matches a release.
- [ ] Settings → General → **Node.js Version**: 22.x.
- [ ] Copy the production URL (Project → Domains) and the `dev` branch URL (Deployments → filter on
      branch `dev` → the deployment → Domains) into the Supabase URL configuration (2.3).

Previews are protected by Vercel Authentication by default; sign in to Vercel on your phone to open them,
or turn it off under Settings → Deployment Protection.

## Done when

- [ ] `main` is the default branch; both rulesets are active; a test PR into `dev` shows the eight checks.
- [ ] A PR that changes `supabase/migrations` gets the `migration` label and comment; after merge the
      **Database deploy** run for `dev` is green.
- [ ] Merging `dev` into `main` makes release-please open `chore(release): release 0.1.0`; merging that
      PR creates tag `v0.1.0`, a GitHub Release, a production deployment showing v0.1.0, and a back-merge
      PR into `dev`.
- [ ] A production migration waits for your approval under Actions.
- [ ] You can sign in on the production URL; the sign-up option does not exist.
