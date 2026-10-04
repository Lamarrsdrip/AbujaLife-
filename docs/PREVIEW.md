# Anonymous public preview

The browser preview opens straight into a local resident. No hosting account, API key, or game signup is required. It uses the actual production client screens and an isolated browser adapter; it never connects to the production resident database.

The preview includes the home scene, Pro Max phone, outfit editor, virtual shopping, job decisions, and compressed journeys. Progress stays in this browser. **Start fresh** resets only preview progress. Shared multiplayer, messages to other residents, and public events require the full server. No fake residents are added.

## Build

From the repository, with Node 24 or later:

```sh
npm ci --ignore-scripts --cache /workspace/.cache/abujalife-npm
npm run preview:build
```

The build reads only public catalogues, bundles the existing UI, and writes a self-contained `preview/index.html`. It has no external JavaScript or CSS dependencies. The optional geographic map fetches OpenStreetMap tiles; an unavailable map source leaves the location catalogue usable.

## Open publicly

After pushing the generated file to the public repository, use the exact published commit:

```
https://rawcdn.githack.com/Lamarrsdrip/AbujaLife-/COMMIT_SHA/preview/index.html
```

RawGitHack serves repository HTML through its global CDN without registration. If its safety confirmation appears, tap **Open the page** once. Pinning the commit makes each preview reproducible. The repository source can be checked at the corresponding `raw.githubusercontent.com` URL.

A public static preview does not expose the development server, provide shared multiplayer, or merge the rebuild into `main`. Cloud environment network rules may prevent the cloud machine from checking the CDN even while the public source is reachable; report that limitation separately from browser tests.
