# Repository handoff

After extracting the ZIP:

```bash
cd AbujaLife-openworld-v0.2.0
npm run qa

git init
git add .
git commit -m "feat: bootstrap AbujaLife open-world foundation"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

Then open `game-unity/` in Unity 6 and run **AbujaLife → Build → Open World Vertical Slice**.

Do not commit Unity `Library/`, `Temp/`, generated builds, local `.env` files or store signing keys.
