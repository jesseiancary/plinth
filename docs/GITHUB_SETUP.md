# GitHub Repository Setup Guide

This guide walks through setting up the GitHub repository with branch protection and CI/CD.

---

## Part 1: Create GitHub Repository

### Option A: Using GitHub CLI (Recommended)

```bash
# Make sure you're in the project root
cd /home/jesse/source/plinth

# Create the repository (public or private)
gh repo create plinth --public --source=. --remote=origin

# Push initial commit
git push -u origin main
```

### Option B: Using GitHub Web UI

1. Go to https://github.com/new
2. Repository name: `plinth`
3. Description: "Production-grade multi-tenant SaaS starter"
4. Visibility: Public (or Private if you prefer)
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

Then push your local repository:

```bash
# Add the remote
git remote add origin https://github.com/YOUR_USERNAME/plinth.git

# Push to GitHub
git push -u origin main
```

---

## Part 2: Configure Branch Protection Rules

### Using GitHub CLI

```bash
# Enable branch protection on main
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Lint","Type Check","Test","Build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":0}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

### Using GitHub Web UI

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Branches** in the left sidebar
4. Click **Add branch protection rule**

Configure the following settings:

#### Branch Name Pattern
```
main
```

#### Protect Matching Branches

**Require a pull request before merging:**
- ✅ Enable this
- Dismiss stale pull request approvals when new commits are pushed: ✅
- Required approving reviews: 0 (you can increase this if working with a team)

**Require status checks to pass before merging:**
- ✅ Enable this
- ✅ Require branches to be up to date before merging
- Add the following status checks (they'll appear after the first CI run):
  - `Lint`
  - `Type Check`
  - `Test`
  - `Build`

**Require conversation resolution before merging:**
- ✅ Enable this (optional but recommended)

**Do not allow bypassing the above settings:**
- ✅ Enable this (prevents admins from bypassing)

**Restrict who can push to matching branches:**
- ⬜ Leave disabled (unless you have specific users/teams)

**Allow force pushes:**
- ⬜ Disabled (default)

**Allow deletions:**
- ⬜ Disabled (default)

Click **Create** to save the rule.

---

## Part 3: Configure Repository Settings

### General Settings

1. Go to **Settings** → **General**

**Features:**
- ✅ Issues
- ⬜ Projects (optional)
- ✅ Wikis (optional)
- ⬜ Sponsorships (disable unless needed)
- ⬜ Discussions (optional)

**Pull Requests:**
- ✅ Allow merge commits
- ✅ Allow squash merging (recommended)
- ⬜ Allow rebase merging (optional)
- ✅ Always suggest updating pull request branches
- ✅ Automatically delete head branches (keeps repo clean)

### Secrets and Variables

If you plan to use Codecov for coverage reports:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `CODECOV_TOKEN`
4. Value: [Get from https://codecov.io after setting up your project]
5. Click **Add secret**

---

## Part 4: Verify CI Setup

### Push a Test Branch

```bash
# Create a test branch
git checkout -b test/ci-setup

# Make a small change (add a comment to README)
echo "" >> README.md
echo "<!-- CI test -->" >> README.md

# Commit and push
git add README.md
git commit -m "test(ci): verify GitHub Actions workflow"
git push -u origin test/ci-setup
```

### Create a Pull Request

Using GitHub CLI:
```bash
gh pr create --title "Test CI Setup" --body "Verifying GitHub Actions workflow runs correctly"
```

Or via web UI:
1. Go to your repository on GitHub
2. Click **Pull requests** tab
3. Click **New pull request**
4. Base: `main` ← Compare: `test/ci-setup`
5. Click **Create pull request**

### Check CI Status

1. In the PR, scroll down to the **Checks** section
2. You should see the following jobs running:
   - ✅ Lint
   - ✅ Type Check
   - ✅ Test
   - ✅ Validate OpenAPI Spec
   - ✅ Build

**Note:** Some jobs will fail initially because dependencies aren't installed yet. This is expected at this stage of the project.

Once all checks pass (or you've addressed any setup issues), you can:
- Merge the PR if you want to keep the change
- Close the PR without merging if it was just a test

---

## Part 5: Add Status Badge to README

After the first successful CI run, add a status badge to your README:

```markdown
[![CI](https://github.com/YOUR_USERNAME/plinth/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/plinth/actions/workflows/ci.yml)
```

Add this near the top of your [README.md](../README.md) file, just below the title.

---

## Troubleshooting

### CI Jobs Failing

**Missing dependencies:**
- Wait until Phase 1 when we install npm packages
- For now, you can disable the workflow temporarily by adding this to the top of `.github/workflows/ci.yml`:
  ```yaml
  # Temporarily disabled until dependencies are installed
  on:
    workflow_dispatch:  # Only run manually
  ```

**PostgreSQL connection issues:**
- The test job includes a PostgreSQL service container
- Make sure the `DATABASE_URL` environment variable is set correctly in the workflow

**Prisma Client not generated:**
- The workflow includes a step to run `pnpm --filter api db:generate`
- This requires the Prisma schema to exist (coming in Phase 1)

### Branch Protection Blocking You

If you're working alone and branch protection is too restrictive:

1. Go to **Settings** → **Branches**
2. Edit the `main` branch protection rule
3. Uncheck "Do not allow bypassing the above settings"
4. This allows admins (you) to bypass the rules when needed

### Status Checks Not Appearing

Status checks only appear in the dropdown after they've run at least once. Options:

1. Wait for the first PR to run CI
2. Manually trigger the workflow from the **Actions** tab
3. Create the branch protection rule, then edit it later to add status checks

---

## Summary

You now have:

- ✅ GitHub repository created
- ✅ GitHub Actions CI workflow (`.github/workflows/ci.yml`)
- ✅ Branch protection rules configured
- ✅ Repository settings optimized
- ✅ Documentation for the setup process

### Next Steps

1. **Phase 1:** Install dependencies and set up Prisma
2. **After Phase 1:** CI jobs should start passing
3. **Throughout development:** All PRs will be checked by CI before merging
4. **Before each merge:** Ensure all status checks pass

---

## GitHub CLI Quick Reference

```bash
# View CI status
gh run list --branch main

# View latest run
gh run view

# Re-run failed jobs
gh run rerun

# Create PR
gh pr create --title "feat: add feature" --body "Description"

# Check PR status
gh pr status

# Merge PR (after checks pass)
gh pr merge --squash --delete-branch
```
