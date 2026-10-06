# Releasing 5echo Quackback

This repository is a standalone product: our build of
[QuackbackIO/quackback](https://github.com/QuackbackIO/quackback), released on
its own schedule and run by more than one project. Nothing in it knows who
runs it. A project that runs it pins one release, the same way it pins its
Postgres image, and moves when it chooses to.

## Branches

|        |                                                        |
| ------ | ------------------------------------------------------ |
| `dev`  | Integration. Every pull request targets it.            |
| `main` | What is released. It moves only when a release is cut. |

Upstream is followed **by release tag, never by `main`**. Their `main` is
ahead of every release and is not what we run, so **never press "Sync fork"
on `main`**: it merges upstream's `main` into ours.

## Cutting a release

1. On `dev`, set `version` in `apps/web/package.json` to the new version
   (without the `v`). It is the source of truth for the version the app shows.
2. Open a pull request `dev` → `main` and merge it with a merge commit.
3. Publish a GitHub Release on `main`, tagged `v<version>`.

Publishing does the rest:

- `docker.yml` builds the signed multi-arch image and pushes
  `ghcr.io/5echo-io/quackback:<version>` and `:latest`. The run summary prints
  the line to pin, tag and digest together.
- `release-openapi.yml` attaches `openapi.json` to the release.

A push to `main` also builds `:main`. That is the tip of `main`, not a
release, and nothing should run it.

## Versions

`v<upstream>-5echo.<n>`, for example `v0.13.2-5echo.1`:

- `<upstream>` is the upstream release this one is built on.
- `<n>` counts our releases on top of it, and starts again at 1 when the base
  moves to a new upstream release.

## Running a release

Pin it by tag **and** digest:

```yaml
image: ghcr.io/5echo-io/quackback:0.13.2-5echo.1@sha256:<digest>
```

The digest is what gets pulled; the tag is there so a person can read which
release it is. Take the line from the release's Docker run summary, or ask
the registry:

```sh
docker buildx imagetools inspect ghcr.io/5echo-io/quackback:0.13.2-5echo.1
```

The package is private. A host needs `docker login ghcr.io` as an account
with Read on it (package settings → Manage access).

## Moving to a new upstream release

```sh
git remote add upstream https://github.com/QuackbackIO/quackback.git   # once
git fetch upstream tag v0.14.0 --no-tags
git switch -c upstream/v0.14.0 origin/dev
git merge v0.14.0
```

Resolve the conflicts against our changes below, run the checks, and open the
pull request into `dev`. Read configuration (health paths, settings, workflow
triggers) **at the new tag**, not on upstream's `main`.

## What we carry on top of upstream

- **A "Source" link in place of "Powered by Quackback".** This is the
  AGPL-3.0 §13 offer of the source to the people using a modified version over
  a network. It has to stay, and this repository has to stay public.
- Unused slug props removed after that change.
- Opening a conversation from inbound email to a support address.
- Widget: host colours (`quackback:theme`) and scoped doors (`scope` on
  `quackback:open`), so one board can sit inside differently branded pages.

## CI

GitHub turns a fork's `ci.yml` off. Until it is enabled under Actions, pull
requests here run no checks, so run `bun run test`, `bun run lint` and
`bun run typecheck` before you merge.
