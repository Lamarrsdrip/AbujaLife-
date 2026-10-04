# Anonymous public preview

The browser preview begins with five short character cards and a live 3D avatar, then opens your local resident. Returning players resume their life. No hosting account, API key, or game signup is required. It uses the same client screens as the full game and an isolated browser adapter; it never connects to the production resident database.

The preview includes an original 3D world and characters, direct walking and running, mobile joystick control, camera follow, owned-car driving, compact animated journeys, sixteen venue types, six walkable homes and persistent furniture placement. Eight branded vehicles have seven selectable colours. The equipped gym, mosque, church, club, games lounge and Jabi-only lake add activities to the city. Okrika Marketplace sells clothing and eighteen furniture items, including richer home upgrades. Cars, clothes, furniture and home walkthrough cards use original 3D previews; no competitor assets are included.

Use the Pro Max-inspired fictional phone for free game-Naira top-ups and transaction history. Try property ownership, simulated investment rent, resale and the dice game with this balance. Game Naira has no cash value: there is no real payment, withdrawal or connected payment provider. The preview's chance outcome is generated locally; the full server independently validates and persists its own die results and economy operations.

Progress stays in this browser. **Start fresh** resets only preview progress. Shared multiplayer, messages or money transfers to other residents, and public events require the full Node server. The preview does not create a fake recipient to demonstrate transfers. Ambient traffic and city NPCs are labeled simulations, never registered residents or online totals.

Desktop: WASD or arrows to move, Shift to run, E to interact nearby. Mobile: drag the joystick and use the contextual action button. Tap any clear ground to walk there or select a door to approach it. Park your car before entering a place. The four tabs are **Play**, **Places**, **My Life** and **Phone**; open the garage, furnishing, homes and work from My Life. A correctly completed starter restaurant shift makes the ₦28,000 pre-owned Toyota Corolla affordable from the ₦26,000 starting balance.

For a richer lifestyle, tour and buy or rent a Jabi apartment, Guzape terrace or Maitama villa, then travel to the new home. Place an air conditioner or upgrade your bed and sofa; an owned inverter reduces weekly home service bills by 15%. Some items are decorative, including the pool table, drinks trolley and artwork. Investments use deliberately compressed game timing and scaled virtual prices, not real Abuja property quotations or investment forecasts.

## Build

From the repository, with Node 24 or later:

```sh
npm ci --ignore-scripts --cache /workspace/.cache/abujalife-npm
npm run preview:build
```

The build first bundles the pinned Three.js renderer locally, then reads public catalogues, bundles the UI and writes a self-contained `preview/index.html`. It has no external JavaScript or CSS dependencies. Models and textures are authored in code and use WebGL; a vector fallback preserves controls if WebGL is unavailable. The optional geographic map fetches OpenStreetMap tiles; an unavailable map source leaves the location catalogue usable.

## Open publicly

After pushing the generated file to the public repository, use the exact published commit:

```
https://rawcdn.githack.com/Lamarrsdrip/AbujaLife-/COMMIT_SHA/preview/index.html
```

RawGitHack serves repository HTML through its global CDN without registration. If its safety confirmation appears, tap **Open the page** once. Pinning the commit makes each preview reproducible. The repository source can be checked at the corresponding `raw.githubusercontent.com` URL.

The address is public and does not depend on the viewer being in Nigeria. A visitor in the UK can open the same link; availability still depends on their browser, network and the CDN. Open it directly in Safari or Chrome if an embedded browser restricts WebGL. Choose **Start fresh** to see the new onboarding from an existing preview visit; this resets that browser's local preview progress.

A public static preview does not expose the development server, provide shared multiplayer, or merge the rebuild into `main`. Cloud environment network rules may prevent the cloud machine from checking the CDN even while the public source is reachable; report that limitation separately from browser tests.
