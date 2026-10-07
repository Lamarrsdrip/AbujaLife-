YOU ARE NOW THE FINAL ENGINEER RESPONSIBLE FOR COMPLETING ABUJALIFE END TO END.

Repository:
Lamarrsdrip/AbujaLife-

USE YOUR HIGHEST AVAILABLE REASONING.

THIS IS ONE COMPLETE PRODUCTION INTEGRATION + GAMEPLAY QA + DEPLOYMENT TASK.

DO NOT SKIP ANY PART.

DO NOT JUST FINISH THE LAST ERROR YOU SEE.

DO NOT TRUST THAT PREVIOUS AGENTS FINISHED THEIR WORK.

DO NOT ASSUME MAIN OR ANY BRANCH SHA IN THIS HANDOVER IS STILL CURRENT.

DO NOT PUSH PARTIAL OR RED CODE TO MAIN.

DO NOT BUILD NEW SYSTEMS ON TOP OF EXISTING WORK WHEN THE EXISTING ARCHITECTURE CAN BE FIXED.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Multiple agents have already worked on this task.

ChatGPT built a large integration branch and PR #48.

Grok/SuperGrok then attempted to finish the final V4 browser acceptance but its usage stopped before completing or merging.

THEREFORE:

YOU MUST TAKE OVER BOTH JOBS.

You must:

1. Inspect all current GitHub state.
2. Recover/preserve all valid work already completed.
3. Finish PR #48 and any later Grok branch changes if they exist.
4. Fix every real game bug found.
5. Correct stale tests only where the actual product behavior is legitimate.
6. Build the NEWEST finished main locally.
7. Actually play the game extensively like a real gamer.
8. Audit every major system visually and functionally.
9. Fix anything else you find.
10. Run the complete automated verification.
11. Re-check latest main.
12. Safely merge/push all verified fixes.
13. Deploy the final main to the Windows VPS.
14. Test the deployed production build.

NO PARTIAL COMPLETION.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRST — DISCOVER THE REAL CURRENT STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Repository:
Lamarrsdrip/AbujaLife-

Known old main before this integration began:

c223a17092b26e594fe94b55225eb03ec072a385

DO NOT ASSUME THIS IS CURRENT.

Known integration branch:

fix/full-platform-integration-2026-10-07

Known PR:

PR #48

Title:
Complete AbujaLife platform integration: voice, phone, homes, world and release QA

At an earlier handoff the branch was around:

d864a5ba154b5851032bc41d42b62a3f2ea3340d

BUT Grok may have made further commits after this.

DO NOT TRUST THIS SHA EITHER.

FIRST DO ALL OF THIS:

git fetch –all –prune

Inspect:

* origin/main
* PR #48
* fix/full-platform-integration-2026-10-07
* any branch/commit Grok created after takeover
* latest commits
* latest GitHub Actions
* PR comments if relevant
* failed V4 artifacts/logs
* whether PR #48 remains draft
* whether PR #48 is mergeable
* whether main moved

Create a clear before-state:

MAIN_SHA=
PR48_HEAD=
LATEST_BRANCH=
PR48_STATE=
LATEST_CI=

Do not delete another agent’s valid work.

Do not blindly start again from old main.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT THROW AWAY EXISTING INTEGRATION WORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The integration work already includes or attempted to include:

* production voice-media storage fix
* proper Windows shared media directory
* phone handset hardware/frame restoration
* phone overlay behavior
* property-scoped furnishing
* Abuja property market expansion
* new landmark sizing
* more authored venue interiors
* driving/world scenery improvements
* realtime/multiplayer work
* Jackpot clock consistency
* release QA improvements
* V4 browser acceptance improvements
* other audit fixes

Inspect all commits carefully and preserve valid changes.

If Grok modified the same branch after ChatGPT:

PRESERVE THOSE VALID CHANGES TOO.

Do not reset/revert simply because the branch has many commits.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — VOICE NOTE PRODUCTION STORAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

There was a real production voice-note error:

EPERM: operation not permitted, mkdir

with release-relative paths similar to:

C:\services\abujalife\releases<release-id>.local

or malformed variants such as:

C:|services|abujalife|releases|…

This is architecturally wrong.

VERSIONED RELEASE DIRECTORIES MUST BE READ-ONLY APPLICATION CODE.

Never store:

* voice notes
* uploaded media
* thumbnails
* caches
* generated files
* ffmpeg output
* temporary processing output
* persistent runtime state

inside:

C:\services\abujalife\releases<release>

Production media must live in persistent shared storage, e.g.:

C:\services\abujalife\shared\media\chat

or the canonical equivalent already added by the integration branch.

Inspect:

deploy/windows/runtime.mjs
apiEnvironment()
production startup
ChatMediaStore
CHAT_MEDIA_DIR
all .local references
mkdir/mkdirSync
writeFile
uploads
audio
voice
media
cache
temp/tmp
thumbnail
ffmpeg

Ensure the API/service account can create/write/read the shared directory.

It must survive:

* deployment
* rollback
* release promotion
* API restart
* Windows restart

Test real voice-note flow:

record
→ stop
→ preview
→ play
→ pause
→ cancel/delete
→ record again
→ send
→ server persists
→ recipient receives
→ recipient plays
→ reload conversation
→ audio still works
→ logout/login
→ audio still works

Verify:

* no raw EPERM shown to users
* failed storage never appears successful
* no duplicate voice messages
* correct MIME
* no corrupt files
* retry state makes sense
* no .local created in a release directory

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — REAL IN-GAME PHONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The AbujaLife Phone must feel like a PHYSICAL PHONE INSIDE THE GAME.

NOT a normal fullscreen website.

Required:

* visible handset body
* bezel
* rounded hardware shell
* rounded screen clipping
* internal margins
* virtual status bar
* virtual Dynamic Island/notch where appropriate
* internal home indicator
* device depth/shadow
* premium proportions

There are TWO devices:

1. user’s actual iPhone/Android
2. AbujaLife virtual phone

Do not confuse real safe areas with the virtual handset.

The whole virtual phone must fit inside the actual mobile viewport.

Opening Phone must be an overlay.

DO NOT unmount the game world.

World must stay mounted behind it:

* player position
* 3D scene
* camera
* building/interior
* vehicle
* multiplayer
* residents
* realtime connection
* current session

Opening/closing Phone must never:

* reload the page
* reset world
* move player
* lose vehicle
* disconnect realtime
* cause white flash
* rebuild entire scene

Phone apps must remain INSIDE the handset:

* Messages
* Contacts
* Calls
* Map
* City Story
* Ride
* Jobs
* Wallet
* Earn
* Camera
* Social
* Visits
* Send Naira
* voice messages
* other existing apps

Navigation should remain internal:

Phone Home
→ Messages
→ Conversation
→ Back
→ Messages
→ Home

Test:

* desktop
* 320x568
* 360x800
* 390x844
* 430x932
* iPhone-like Safari/WebKit
* PWA layout
* Android-like Chrome viewport
* keyboard open
* keyboard close

Typing must NOT squeeze the handset into a tiny rectangle.

Input and latest message must remain visible.

IMPORTANT REGRESSION:

A previous handset caption/backdrop intercepted the Put Away button.

Make sure all handset controls have correct pointer hitboxes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — HOME FURNITURE DUPLICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fix furniture systematically.

Architecture includes:

* authored/base furnishing
* owned furniture
* furnitureLayout
* storedFurniture
* property-specific placement

There must be ONE coherent source of truth.

Furniture from Home A must not automatically appear in Home B.

Player-owned items physically placed in another property are unavailable in the active home’s scene unless intentionally moved/stored/re-placed.

Test:

Home A
→ buy/move to Home B
→ Home C
→ return A
→ return B

No duplicates.

Test:

buy sofa in A
→ place sofa
→ move B
→ sofa must not magically appear in B

Test:

store sofa
→ move B
→ intentionally place sofa
→ now it may appear there

Base furniture and owned furniture must never render as two copies of the same intended object.

Audit existing adoption logic for:

* bed
* sofa
* dining table

and extend safely where necessary.

Existing users’ old furniture data must remain compatible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — PROPERTIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The old catalogue had only around six homes.

The integration branch expanded this.

VERIFY the finished catalogue has roughly 18–25 or more meaningful Abuja properties and that all actually work.

Areas can include:

* Garki
* Gudu
* Apo
* Durumi
* Wuye
* Utako
* Jabi
* Mabushi
* Wuse
* Wuse 2
* Gwarinpa
* Life Camp
* Jahi
* Kado
* Katampe
* Katampe Extension
* Dawaki
* Kubwa
* Lokogoma
* Galadimawa
* Lugbe
* Games Village
* Asokoro
* Maitama
* Guzape
* Gaduwa
* Dakwo
* Karmo
* Mpape where suitable

Only use valid atlas/location IDs.

Property classes should vary:

Entry:

* studio
* self-contained
* one-bedroom

Mid:

* 2-bedroom flat
* serviced apartment
* estate apartment

Upper:

* 3-bedroom
* terrace
* townhouse
* penthouse
* detached duplex

Luxury:

* Asokoro residence
* Maitama villa
* Guzape hillside duplex
* Katampe luxury home
* Life Camp estate home

Verify each has valid:

* ID
* district
* layoutId
* bedrooms
* bathrooms
* floor area
* rent
* buy price
* bills
* service charge
* comfort
* tier
* features
* description

No duplicate IDs.

No invalid location references.

No broken viewing.

No economy calculation regressions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 5 — PROPERTY FURNISHING QUALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Purchased homes should feel appropriately furnished.

More expensive homes should feel more premium.

Do NOT achieve this by simply spawning more random furniture.

Rooms should make sense.

Bedroom:

* bed
* wardrobe
* bedside table
* optional lamps
* mirror/decor where appropriate

Living:

* sofa
* coffee table
* TV/media area
* rug
* accent chair/plant where appropriate

Kitchen:

* cabinetry
* fridge
* dining
* island/bar for premium homes

High tier:

* study
* larger lounge
* terrace/balcony
* luxury decor
* outdoor/patio where applicable

Keep player movement/walkability.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 6 — LANDMARK SIZE AND WORLD SCALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A confirmed visual issue:

Some newly added Abuja landmarks were physically much smaller than the older city buildings.

Old buildings/hotel/residence looked full-size.

New landmarks sometimes looked like miniature props.

FIX THIS.

Walk around the game and compare landmark scale visually.

Do not simply multiply everything blindly.

Use coherent physical proportions and neighboring context.

New landmarks must feel like part of the same playable city.

Important landmarks include:

* Airport
* City Gate
* National Stadium
* Magicland
* Jabi Lake
* Jabi Lake Mall
* Banex
* Farm City
* Federal High Court
* World Trade Centre / twin towers
* CBN
* National Christian Centre
* ICC
* Eagle Square
* Aso Rock
* National Mosque
* National Assembly
* Transcorp Hilton
* Millennium Park
* INEC
* EFCC

MAP coordinates can remain geographically oriented.

WORLD rendering should prioritize playable spacing/coherent visual city scale.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 7 — INTERIORS MUST NOT BE GENERIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A prior audit confirmed many landmark interiors were effectively:

existing generic template
+
different building name

Examples included:
airport/CBN/INEC → generic estate-office-like template
conference centre → cinema-like template

Improve this properly through the existing interior architecture.

DO NOT build a second interior engine.

Each important landmark should visibly communicate its real purpose.

Examples:

AIRPORT:

* check-in/service counters
* waiting
* terminal circulation
* boarding/travel feel

TRANS CORP/HOTEL:

* lobby
* reception
* lounge
* dining
* guest context
* pool/spa if supported

STADIUM:

* sports/training/match context

MAGICLAND:

* rides
* games
* arcade
* entertainment

BANEX:

* gadget/tech market
* repairs
* device stalls

ICC:

* conference
* meeting
* auditorium

INEC:

* information
* registration
* civic process

COURT:

* court/civic/legal environment

CBN:

* institutional/banking environment

MOSQUE:

* mosque

CHURCH:

* church

MALL:

* retail

FARM CITY:

* restaurant/social

Spaces must be organized and walkable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 8 — DRIVING MUST FEEL LIKE DRIVING THROUGH ABUJA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Confirmed prior problem:

The journey scene was effectively rendering route graphics while returning things such as:

traffic: []
buildings: []
objects: []

This makes driving feel detached from the actual outside World.

FIX DRIVING EXPERIENCE.

Driving should feel like traversing the Abuja world.

The player should see:

* roads
* surrounding buildings
* recognizable landmarks when relevant
* roadside environment
* route turns
* scenery moving relative to vehicle
* coherent destination approach

Do not use one generic fake road for every journey.

Vehicle ownership/state logic should remain authoritative.

If a player drives somewhere with their car:

the car should not randomly remain behind while player walks home.

Test vehicle continuity thoroughly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 9 — WORLD DISAPPEARANCE / REMOUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Previously reported severe issue:

While simply playing:

world visible
→ entire 3D scene disappears
→ pale background appears
→ world returns

THIS MUST NOT HAPPEN.

Find root cause if still reproducible.

Potential areas:

* navigation remount
* WebGL layer replacement
* state transition
* viewport resize
* phone overlay
* scene reconstruction
* React/DOM-like rerender equivalents
* renderer lifecycle
* PWA focus changes

DO NOT mask with a loading screen/fade/spinner.

Fix underlying scene lifecycle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 10 — MULTIPLAYER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Public streets:

Other residents should appear as lightweight live name/@name tags.

Do NOT render every remote resident as a full avatar body on public streets.

Inside exact shared venue/home:

render full resident avatars + head labels.

Test with two sessions:

* street
* same venue
* different venue
* own home
* accepted home visitor
* blocked resident
* private presence
* entering/leaving
* realtime movement

No cross-building leakage.

Use ONE authoritative presence architecture.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 11 — LIVE STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

* resident count
* online now
* here now
* visits today
* total visits

One resident with multiple realtime connections should not count as multiple visible residents if grouping already exists.

Stats must make logical sense.

Historical tracked visits may have started after early users existed, so preserve any legitimate baseline handling rather than fabricating historical events.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 12 — JACKPOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Earlier audit found the UI countdown depended on device Date.now() while backend already provides server time.

The integration work attempted to anchor countdown to serverTime.

VERIFY IT.

A phone with incorrect time must not display an incorrect authoritative countdown.

Test:

* serverTime
* countdown
* reload
* multiple clients
* round transition
* result
* wallet updates
* payout flow where applicable

Also reconcile documentation/product messaging.

There was a contradiction between:

UI/backend supporting Jackpot withdrawal

and documentation saying:

“Naira here is game money with no withdrawal facility.”

Do not leave contradictory user/operator messaging.

If Jackpot winnings are legitimately withdrawable, document that precisely without implying the entire game-wallet balance is freely cash-withdrawable unless that is actually true.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 13 — REALTIME SCALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prior audit found the realtime server explicitly had a roughly:

5,000 simultaneous SSE client limit per Node process

with in-memory live client/zone maps.

That is NOT a millions-of-concurrent-users design.

Inspect what integration work already attempted here.

Do not introduce reckless complexity.

But at minimum:

* document/enforce sane limits
* avoid accidental fanout explosions
* ensure reconnect behavior is bounded
* prevent duplicate connections
* avoid O(N global residents) rendering
* ensure proper cleanup
* ensure zone-scoped fanout
* ensure deploy/restart works cleanly

If practical existing architecture supports horizontal fanout cleanly, finish it.

If not, do NOT pretend it is 100M ready.

Report remaining concurrency limitation honestly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 14 — GROK’S UNFINISHED V4 FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THIS SECTION IS CRITICAL.

GROK RAN OUT OF USAGE WHILE INVESTIGATING THESE.

DO NOT BLINDLY APPLY GROK’S SPECULATIVE FIXES.

REPRODUCE EACH ONE AND DECIDE:

A. real product/game bug
B. stale test assumption
C. race/readiness problem

Then fix the correct layer.

━━━━━━━━━━━━━━━━━━━━
GROK FINDING A — SLEEP AFTER WORK
━━━━━━━━━━━━━━━━━━━━

V4 passed its earlier checks then failed after work when returning home.

Grok observed:

* sleep target appears
* then disappears/remounts
* physical() snapshots an empty marker list
* scene/WebGL may remount between wait and interaction

Grok locally reproduced:

work
→ clock jump
→ return home
→ sleep

and later stated:

“Sleep after work succeeded.”

VERIFY THIS YOURSELF.

Do not create test hacks around a real remount.

If home is remounting incorrectly, fix product lifecycle.

If only the locator is stale because WebGL legitimately remounted, fix the acceptance helper to reacquire the current live interaction target.

Use the REAL game interaction path.

━━━━━━━━━━━━━━━━━━━━
GROK FINDING B — NIGHTLIFE NAVIGATION
━━━━━━━━━━━━━━━━━━━━

Grok then found nightlife checks were using old UI assumptions.

Old test expected:

[data-nav-places]

but that control is no longer in current navigation.

Grok discovered several conflicting paths while investigating:

* Places control removed
* Outside may open city map
* city map lists landmarks
* nightlife clubs may exist as street/walk targets
* map overlay can cover controls
* public World/outside distinction matters

DO NOT simply restore old UI solely for the test.

First understand the actual intended current gameplay journey.

A normal player must have a clear, usable way to discover/reach clubs.

Make sure nightlife is reachable intuitively from CURRENT game UX.

━━━━━━━━━━━━━━━━━━━━
GROK FINDING C — TOKYO / NIGHTCLUB DOORS
━━━━━━━━━━━━━━━━━━━━

Grok found possible production problems:

* Tokyo drawn as a street target
* Tokyo may lack a proper homeDistrict/district mapping
* building may render but door may refuse entry
* two Tokyo markers may exist: building art and interaction door
* off-camera interaction can fail
* destination/navigation path may not connect correctly

It also observed:

“Bear Barn was entered. Tokyo never opened a travel form…”

REPRODUCE.

Tokyo and every nightlife venue must have one coherent interaction path.

If the player is already in the same district:
walk/enter appropriately.

If elsewhere:
travel should make sense.

No dead decorative door that appears clickable but does nothing.

━━━━━━━━━━━━━━━━━━━━
GROK FINDING D — CAGE / MAGIC CITY
━━━━━━━━━━━━━━━━━━━━

Grok reported:

“Cage and Magic City are drawn on every street but only enterable in their own districts.”

VERIFY THIS.

If true, it is a real UX/world coherence bug.

A venue should not visually appear as an enterable building everywhere if it is only legitimate in one location.

Either:

* render it only where it exists

OR

* if the representation intentionally links to another district, make that interaction clearly start legitimate travel.

Do not leave fake doors.

━━━━━━━━━━━━━━━━━━━━
GROK FINDING E — DESTINATIONS CONTROL
━━━━━━━━━━━━━━━━━━━━

Grok went through several observations:

* Destinations button sometimes expected but missing
* map overlay sometimes covers it
* public World vs Outside scene differ
* street may have walk targets instead
* travel form can be opened through another path

Establish ONE clean player-facing travel/navigation contract.

A player should understand:

Where am I?
How do I leave?
How do I reach another place?
How do I walk into nearby venues?
How do I drive/taxi somewhere else?

Do not maintain multiple contradictory navigation affordances.

━━━━━━━━━━━━━━━━━━━━
GROK FINDING F — SAME-DISTRICT TAXI
━━━━━━━━━━━━━━━━━━━━

Grok observed:

“Same-district taxi never starts a trip — the player is already inside.”

Determine intended behavior.

If destination is nearby/same street:

walking should probably be offered/used.

Do not fabricate a moving taxi journey if there is no trip.

But UI must still clearly complete the requested navigation.

━━━━━━━━━━━━━━━━━━━━
GROK FINDING G — NIGHTLIFE ACTIVITIES
━━━━━━━━━━━━━━━━━━━━

Grok observed:

“Club activities debit the wallet immediately. The home sleep animation is a different path, so I’ll stop requiring that progress bar on nightlife.”

VERIFY actual product behavior.

Do not require a sleep-style progress bar merely because another activity has one.

But make sure nightclub activities:

* have understandable feedback
* charge only once
* do not double debit
* finish properly
* produce any intended effect
* do not silently debit without player acknowledgement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 15 — NIGHTLIFE FULL GAMEPLAY TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After resolving Grok findings, manually play nightlife.

Test:

* Tokyo
* Bear Barn
* Cage
* Magic City
* any other clubs
* correct district
* visible entrance
* walk target
* door
* travel if needed
* entry
* exit
* music
* club activity
* wallet debit
* repeated activity
* venue hours
* Saturday/night state if time based
* return to street
* return home

No dead buttons.

No fake doors.

No stale old Places navigation.

No map overlay trapping the user.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 16 — PLAYER-GAME QA: ACTUALLY PLAY EVERYTHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After integrating/fixing the known issues, BUILD THE GAME LOCALLY.

DO NOT STOP AT AUTOMATED TESTS.

Play AbujaLife like an actual gamer.

Use at least two accounts for multiplayer.

Walk through every major system.

━━━━━━━━━━━━━━━━━━━━
AUTH
━━━━━━━━━━━━━━━━━━━━

* register
* login
* logout
* wrong password
* reload
* Welcome Back
* reconnect
* slow network
* session persistence

━━━━━━━━━━━━━━━━━━━━
ONBOARDING
━━━━━━━━━━━━━━━━━━━━

* appearance
* clothes
* hair
* goal
* origin
* starter home
* wallet
* completion persistence

━━━━━━━━━━━━━━━━━━━━
WORLD
━━━━━━━━━━━━━━━━━━━━

* walking
* camera
* zoom
* mobile joystick/touch
* buildings
* roads
* landmarks
* no scene flash
* no jitter
* no white screen
* no remount during normal gameplay

━━━━━━━━━━━━━━━━━━━━
HOME
━━━━━━━━━━━━━━━━━━━━

* enter
* leave
* sleep
* shower
* eat
* needs
* Studio
* wall
* floor
* furniture
* persistence
* second property
* property switching

━━━━━━━━━━━━━━━━━━━━
PHONE
━━━━━━━━━━━━━━━━━━━━

* hardware frame
* Messages
* Social
* Visits
* Map
* Jobs
* Ride
* Wallet
* voice notes
* keyboard
* back
* Put Away

━━━━━━━━━━━━━━━━━━━━
SOCIAL
━━━━━━━━━━━━━━━━━━━━

* Home Share
* PNG generation
* caption
* resident/home deep link
* posts
* like
* status
* 24h expiry
* second account sees content

━━━━━━━━━━━━━━━━━━━━
VISITS
━━━━━━━━━━━━━━━━━━━━

* request
* pending
* accept
* reject
* enter owner’s real home
* both avatars
* movement
* chat
* leave

━━━━━━━━━━━━━━━━━━━━
CARS
━━━━━━━━━━━━━━━━━━━━

* dealership
* buy/use vehicle
* drive
* route
* arrive
* park
* travel again
* go home
* car continuity
* exit

━━━━━━━━━━━━━━━━━━━━
WORK
━━━━━━━━━━━━━━━━━━━━

* select job
* shift
* tasks
* salary
* cooldown
* WAT schedule
* morning
* afternoon
* closed hours

━━━━━━━━━━━━━━━━━━━━
LOANS
━━━━━━━━━━━━━━━━━━━━

* consent
* borrow
* debt
* repay
* persistence

━━━━━━━━━━━━━━━━━━━━
ECONOMY
━━━━━━━━━━━━━━━━━━━━

* wallet
* purchases
* home
* car
* activities
* investments if applicable
* transfers
* no duplicated charge
* no client-forged reward

━━━━━━━━━━━━━━━━━━━━
ADMIN/SENSITIVE ACTIONS
━━━━━━━━━━━━━━━━━━━━

Ensure authorization remains server authoritative.

Do not weaken admin or financial protections for tests.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 17 — PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Earlier degraded network testing showed roughly ~60 seconds before usable under an extreme:

400ms latency
50 KB/s

connection.

Audit startup.

Look for:

* huge initial bundles
* unnecessary eager modules
* service worker install competition
* immediate loading of unused features
* oversized assets
* repeated downloads
* world assets blocking basic UI
* duplicate API requests
* duplicate realtime subscriptions

Optimize where safe.

AbujaLife should remain lightweight and responsive.

Do NOT remove game quality simply to reduce bundle size.

Use lazy loading/code splitting where appropriate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 18 — MOBILE QA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test at least:

320x568
360x800
375x812
390x844
430x932
1280x900 desktop

Check:

* horizontal overflow
* tap targets
* keyboard
* handset
* home
* map
* driving
* world
* nightlife
* property list
* chat
* voice recorder
* Social
* Visits
* Studio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 19 — QA MATRIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After final code fixes, run everything relevant.

At minimum:

npm run qa

node –test deploy/windows/runtime.test.mjs

npm run build

npm run qa:infra

Run any focused:

* chat/media tests
* voice tests
* home/furniture tests
* property catalogue tests
* multiplayer tests
* travel tests
* nightlife tests
* Jackpot tests
* Windows path tests

Then run:

* Mobile WebKit city-entry release gate
* Historical Chromium resident journey
* CURRENT V4 full-client browser acceptance

Do not remove failing tests just to become green.

Fix production if production is wrong.

Fix acceptance only if it is stale compared with legitimate current UX.

Retain browser evidence/screenshots/artifacts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 20 — V4 MUST FINISH ALL THE WAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do not stop after V4 checks 01–10.

Continue to the END.

V4 already previously passed large portions such as:

* registration
* onboarding
* needs
* Home Studio
* resident 2
* statuses
* visits
* shared chat
* loans
* work

The remaining nightlife/later-flow issues must be completed.

At the end report:

V4:
PASSED X/X
FAILED 0

If any test is intentionally skipped, explain WHY.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 21 — BEFORE MERGING MAIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fetch main AGAIN.

Compare:

origin/main
vs
your verified branch

If main moved:

integrate the latest valid work.

Do NOT force-push over another session.

Resolve conflicts intelligently.

Rerun affected tests after conflict resolution.

Then:

* mark PR ready if appropriate
* push final branch
* verify CI
* merge safely
* fetch final main
* record exact SHA

Do not leave PR #48 draft/open after its work is fully integrated.

If a new PR is cleaner because Grok diverged significantly, ensure PR #48’s complete valid work is still included and close/resolve the obsolete PR appropriately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 22 — DEPLOY FINAL MAIN TO WINDOWS VPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ONLY AFTER FINAL MAIN IS GREEN.

VPS:

IP:
173.212.249.202

Username:
Administrator

SSH port:
22

Mac SSH key:
~/.ssh/id_ed25519

From Mac:

ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes Administrator@173.212.249.202

DO NOT disable host-key verification.

If Windows opens CMD:

powershell -NoProfile -ExecutionPolicy Bypass

Application root:

C:\services\abujalife

Before deployment:

confirm exact final GitHub main SHA.

Then use the existing canonical deployment architecture.

Run:

$Root = “C:\services\abujalife”

Write-Host “=== DEPLOYING LATEST GITHUB MAIN ===”

powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$Root\shared\runtime\auto-update.ps1"
-Root $Root

Write-Host “`n=== AUTO DEPLOY STATE ===”
Get-Content “$Root\shared\state\auto-deploy.json”

Write-Host “`n=== CURRENT LIVE RELEASE ===”
Get-Content “$Root\shared\state\current.json”

Write-Host “`n=== API HEALTH ===”
try {
Invoke-RestMethod http://127.0.0.1:18787/health
} catch {
Write-Host “Health check failed:”
Write-Host $_
}

VERIFY:

* updater selected final main
* all deployment gates accepted it
* release promoted
* current.json points at expected SHA
* API is healthy
* shared media path exists
* voice-note path is writable
* no runtime data being written into release tree
* public site serves new release

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 23 — POST-DEPLOY PRODUCTION SMOKE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After VPS deploy, test actual public production.

At minimum:

* login
* feed/startup
* world loads
* walk
* Phone opens
* Phone closes
* voice recording/send
* home
* property
* driving
* Map
* INEC travel
* multiplayer if possible
* nightclub
* health endpoint
* no console-fatal errors
* no EPERM
* no release-relative .local
* correct live SHA

Do not equate:

“GitHub main updated”

with:

“production deployed.”

Verify both.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NON-NEGOTIABLE ENGINEERING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Do not restart from old code.
2. Do not discard valid existing work.
3. Do not hide bugs with loading screens.
4. Do not fabricate game state to satisfy browser tests.
5. Do not weaken auth/security/payment/realtime authority.
6. Do not create parallel systems.
7. Do not remove real product UI just because an old test expects something else.
8. Do not keep stale tests when current intended UX legitimately changed.
9. Do not mark complete while CI is red.
10. Do not mark complete while V4 is incomplete.
11. Do not push unverified fixes directly over main.
12. Do not deploy until final main is verified.
13. Do not stop after fixing Grok’s nightlife failure.
14. Play the entire game and continue looking for problems.
15. Think like an experienced game developer, backend engineer, QA engineer and production SRE together.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL DEFINITION OF DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DONE means ALL of these:

* production voice notes work
* persistent shared media storage
* zero release-relative runtime media writes
* real in-game phone hardware frame
* phone overlay does not remount world
* keyboard works
* Put Away works
* furniture doesn’t duplicate
* furniture is property scoped
* expensive homes feel premium
* expanded Abuja property catalogue works
* landmark scale is coherent
* interiors match venue purpose
* driving feels integrated with Abuja world
* car continuity is logical
* world does not disappear/reset
* INEC travel phone bug fixed
* multiplayer street tags correct
* full avatars inside shared venues/homes
* realtime privacy correct
* stats make sense
* Jackpot countdown authoritative
* nightlife works
* Tokyo works
* Bear Barn works
* Cage works
* Magic City works
* no fake/dead nightclub doors
* travel/navigation makes sense
* home sleep works after job flow
* social works
* status expiry works
* visits work
* loans work
* jobs work
* wallet/economy works
* mobile works
* WebKit passes
* Chromium journey passes
* V4 completes ALL checks
* Windows runtime passes
* build passes
* infra QA passes
* newest main preserved
* verified code merged
* final main SHA known
* VPS deployed to that SHA
* API healthy
* public production smoke passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When truly finished give me:

STARTING STATE

* starting main SHA
* PR #48 starting head
* any Grok commits discovered

RECOVERED WORK

* valid ChatGPT work preserved
* valid Grok work preserved

BUGS FOUND

* every genuine production bug
* every stale test assumption
* every race/readiness problem

FIXES

* files changed
* architecture changed
* why

GAMEPLAY QA

* systems personally played
* desktop
* mobile
* multiplayer
* nightlife
* home
* driving
* phone
* voice
* social
* property
* jobs
* loans
* Jackpot

AUTOMATED RESULTS

* npm run qa
* runtime
* build
* qa:infra
* WebKit
* historical Chromium
* V4 X/X

GITHUB

* final branch
* PR
* merge result
* final main SHA

VPS

* deployed release SHA
* health
* current.json
* media path
* public smoke

REMAINING LIMITATIONS

* especially any real concurrency/scale limitation that cannot truthfully be called solved

DO NOT GIVE ME A SUCCESS REPORT UNTIL THE COMPLETE JOB IS FINISHED.

TAKE OVER EVERYTHING LEFT BY CHATGPT AND GROK, FINISH IT, TEST IT LIKE A REAL PLAYER, MERGE IT SAFELY, AND DEPLOY THE FINAL VERIFIED ABUJALIFE TO THE VPS.