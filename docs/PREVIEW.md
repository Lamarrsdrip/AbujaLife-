# Anonymous public preview

The browser preview begins with five short character cards and a live 3D avatar, then opens your local resident. Returning players resume their life. No hosting account, API key, or game signup is required. It uses the same client screens as the full game and an isolated browser adapter; it never connects to the production resident database.

The preview includes an original 3D world and characters, direct walking and running, mobile joystick control, camera follow, owned-car driving, compact animated journeys, nineteen venue types, six home-layout families and persistent furniture placement. Eight branded vehicles have seven selectable colours. The equipped gym, mosque, church, games lounge and Jabi-only lake add activities to the city. Tokyo, Cage, Magic City and Bear Barn are authored nightlife settings using player-provided names; availability varies by district and their addresses, layouts and prices are not verified real business listings. Okrika Marketplace sells clothing and eighteen furniture items, including richer home upgrades. Cars, clothes, furniture and home walkthrough cards use original 3D previews; no competitor assets are included.

A fresh preview resident randomly receives a permanent **Nepo** or **Lapo** origin, with equal odds: Nepo starts with ₦1,000,000 and a gifted Jabi, Guzape or Maitama home; Lapo starts with ₦100,000 and a starter home in Lugbe, Kubwa, Nyanya, Bwari or Gwagwalada. Existing saved visits retain their progress. Home Studio changes wall and floor finishes and lets you drag, resize, rotate, remove and undo room dividers while keeping usable routes clear.

Use the Pro Max-inspired fictional phone for free local game-Naira top-ups and transaction history. Try property ownership, simulated investment rent, resale and the dice game with this balance. The former balance, daily demonstration-fund, stake and rent-accrual business ceilings are removed; exact integer arithmetic and affordability still apply. The preview accepts no real payment and provides no withdrawal. The full server separately supports administrator-configured, independently verified Flutterwave checkout; no live merchant payment has been tested.

Borrowing is optional: the fictional LAPO-style game loan requires consent to a one-time 5% fee, due after 28 real days, with early or partial repayment. It has no affiliation with LAPO Microfinance Bank. Preview loan and dice outcomes are saved locally; the full server validates its own economy operations and random die results.

The phone browser offers official X and TikTok links. Xshare captures an actual 3D PNG of your home and saved design, lets you edit the caption, opens the installed X app composer with a resident referral link when available, and uses the native share sheet for WhatsApp Status. A new account created from a resident link is automatically connected to that resident as a friend after server validation.

You can also publish your own photos, posts and 24-hour statuses through the preview's Okrika social screens. They stay on this device, with local likes and comments; other people opening the public link cannot see them. The full server stores and shares actual residents' content and applies blocking, expiry and moderation rules.

Progress stays in this browser. **Start fresh** resets only preview progress. Shared multiplayer, messages or money transfers to other residents, consented home visits and public events require the full Node server. The preview does not create a fake recipient or home visitor. Ambient traffic and city NPCs are labeled simulations, never registered residents or online totals.

Desktop: WASD or arrows to move, Shift to run, E to interact nearby. Mobile: drag the joystick and use the contextual action button. Tap any clear ground to walk there or select a door to approach it. Park your car before entering a place. The four tabs are **Play**, **Places**, **My Life** and **Phone**; open the garage, furnishing, homes, Home Studio and work from My Life.

For a richer lifestyle, tour and buy or rent a Jabi apartment, Guzape terrace or Maitama villa, then travel to the new home. Place an air conditioner or upgrade your bed and sofa; an owned inverter reduces weekly home service bills by 15%. Some items are decorative, including the pool table, drinks trolley and artwork. Investments use deliberately compressed game timing and scaled virtual prices, not real Abuja property quotations or investment forecasts.

Day and night follow actual **Africa/Lagos** time. Office and bank jobs open Monday–Friday; hospitality schedules include appropriate weekends. The allowance is two global shifts per Abuja day, one in each available shift slot. DJ sessions run Wednesday, Friday and Saturday, 20:00–02:00 Abuja time, with opt-in original audio and moving simulated dancers. Seasonal weather is explicitly generated game atmosphere, not a measured forecast; Open-Meteo access was also blocked here.

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

A public static preview does not expose the development server, provide shared multiplayer, or merge the rebuild into `main`. The account-free Cloudflare Quick Tunnel API returned proxy CONNECT 403, so no public Node-server tunnel was created. Without a reachable public Node backend, this link remains a device-local preview. See [ADMIN_PAYMENTS.md](ADMIN_PAYMENTS.md) for the shared-server and payment setup boundaries. Cloud environment network rules may also prevent the cloud machine from checking the CDN even while the public source is reachable; report that limitation separately from browser tests.
