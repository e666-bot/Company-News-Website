# Push future website changes to GitHub

Git already remembers the destination for this folder. Its local `.git` settings
name the GitHub repository as the remote `origin`, and the current branch is
`main`. You can see those settings with `git remote -v` and
`git branch --show-current`. The `git push` command uses that saved destination;
you do not need to include the repository URL each time.

Open PowerShell in this project folder:

```powershell
cd "C:\Ethan Coding\Company News Website"
```

Then run these commands:

```powershell
# 1. See which files have changed
git status

# 2. Stage all changed, added, and deleted project files
git add -A

# 3. Save the changes as a commit (edit the description in quotes)
git commit -m "Describe the website update"

# 4. Upload the commit to GitHub
git push
```

If Git says “nothing to commit,” there were no new changes to save. If `git push` says everything is up to date, the local branch already matches GitHub.

## Update the events immediately

After pushing, open the repository's **Actions** tab, choose **Update investor events**, select **Run workflow**, and confirm. The workflow also runs automatically every day. When it finishes, the JSON file in GitHub is refreshed; reload the hosted site to see the latest feed.

## First-time setup only

This project is already connected to `https://github.com/e666-bot/Company-News-Website.git` on the `main` branch. You should not need to run `git init`, `git remote add`, or `git push -u` again.

If authentication is requested, finish the GitHub sign-in prompt. Do not paste a password or access token into this file or into a command.
