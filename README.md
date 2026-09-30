<p align="center">
  <img src="https://raw.githubusercontent.com/vespperhq/word-add-in/main/assets/vespper-cat.svg" alt="Vespper" width="160">
</p>

# Vespper Examples

Complete examples for building document-editing agents with Vespper.

Each example lives in its own repository and is included here as a Git submodule.
Use the examples to read documents, search their contents, and apply precise
tracked changes through [Vespper](https://docs.vespper.com).

## Usage

First, [sign up for Vespper](https://app.vespper.com), then create a key on the
[API keys page](https://app.vespper.com/keys).

Clone the collection and follow the README inside the example you want to run:

```bash
git clone --recurse-submodules https://github.com/vespperhq/examples.git
cd examples
```

If you already cloned this repository, initialize the submodules with:

```bash
git submodule update --init --recursive
```

To update an existing checkout:

```bash
git pull --ff-only
git submodule update --init --recursive
```

Each example keeps credentials in a local `.env` file. Never commit that file or
expose its values in frontend code.

## Examples

- [word-add-in](https://github.com/vespperhq/word-add-in) — a Microsoft Word add-in with a React task pane, a Mastra agent, streamed tracked changes, selected-text context, and pasted-image support.

## Automatic updates

The standalone repositories are the source of truth. The **Update example
submodules** workflow checks every submodule registered in `.gitmodules` every
five minutes and commits changed pointers directly to this repository's `main`
branch. No workflow, deploy key, or personal access token is needed in the
individual example repositories.

GitHub can delay scheduled runs, so updates may take longer than five minutes.
You can also run the workflow manually from the Actions tab. An existing local
checkout still needs the pull and submodule-update commands above; automation
updates GitHub, not files on your computer.

### Adding an example

Create and push its standalone public repository, then add it to this collection:

```bash
git submodule add -b main https://github.com/vespperhq/your-example.git your-example
# Add the example to the list above.
git add .gitmodules README.md your-example
git commit -m "Add your-example"
git push
```

Use the example's actual branch name if it differs from `main`. The existing
workflow automatically discovers the new submodule and follows its configured
branch; no automation changes are required. Ordinary directories are not
repositories and are not synchronized. Private submodules would require separate
read credentials; the built-in token can read this repository and public repos.

### Contributing

Make code changes in the relevant standalone repository. To work inside a
submodule checkout, switch to a branch before committing:

```bash
cd word-add-in
git switch main
git pull --ff-only
```

Push changes normally; this collection's workflow updates the pointer for you.

### Maintaining the automation

The workflow uses the built-in `GITHUB_TOKEN` with `contents: write`. It runs on
changes to `.gitmodules` or the automation, on its schedule, and on manual runs.
It updates top-level submodule pointers; any nested dependencies remain at the
versions committed by their owning example repository.

The sync script retries concurrent pushes without force-pushing and publishes no
partial update if fetching an example fails. It only creates a commit when a
pointer changes, or after 30 days without a commit to keep the scheduled workflow
active in this public repository. The script resets its checkout on retries and
must only run in a disposable GitHub Actions checkout.

Automatic commits require write access to `main`. If branch protection is added,
update the workflow to use the corresponding approved write path.

## Learn more

- [Vespper documentation](https://docs.vespper.com)
- [Vespper dashboard](https://app.vespper.com)
- [API keys](https://app.vespper.com/keys)
