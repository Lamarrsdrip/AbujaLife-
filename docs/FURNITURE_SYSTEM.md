# Furniture gameplay and persistence

The home catalogue sells virtual furniture from the server's catalogue. Purchasing
an item deducts its listed game Naira price, records the economy operation and
grants owned inventory. The item stays in storage until the resident confirms a
valid placement. Cancelling arrangement does not charge again or discard a bought
item.

## Current placement record

`profile.furnitureLayout[itemId]` contains:

```json
{
  "x": 0.427,
  "y": 0.627,
  "rotation": 90,
  "propertyId": "the-residents-current-property",
  "supportId": "coffee-table"
}
```

`x` and `y` are normalized floor-centre coordinates, rounded to three decimals.
Rotation is a quarter turn. `supportId` is optional and refers to another owned,
placed item in the same property. Elevation is derived from trusted model metadata;
the client cannot provide a height, price, ownership grant or wallet balance.

The current inventory supports one owned instance per catalogue item type. It does
not yet support buying multiple identical sofas. The property association keeps
an arranged item in its saved property when the resident moves home; selecting
that owned item in the new home transfers its placement without another purchase.
Unassociated layouts from older saves retain their existing safe placement behavior.
New accepted placements render at their exact saved coordinates rather than being
silently repositioned on reload.

## Validation and supported objects

`src/shared/furniture-placement.mjs` supplies the same authored-geometry checks to
the game controls, SQLite development adapter, browser preview and production Mongo
adapter. Each backend always loads its authenticated resident and authoritative
room geometry. It checks ownership, the current property, full item bounds, walls,
other furniture, table containment, entrance clearance and routes to room activities.

Pointer-drag feedback can disable the navigation search with `checkRoutes: false`.
Confirmation and backend writes always perform the complete route check. This keeps
dragging responsive without weakening persistence validation.

Coffee tables, bedside tables, dining tables, kitchen counters and drawers expose
trusted surface heights. The catalogue includes tabletop lamps, ceramic vases,
succulents and coffee-table books. Objects resting on a support move and rotate
with it. Storing or selling the support returns its children to owned storage.
Supported objects do not create additional floor navigation obstacles.

## Durable storage and operations

Production MongoDB persists inventory in the normalized `inventory` collection,
home associations and placement in `homes`, balances in `wallets`, wallet changes
in the append-only `ledger`, and purchase/resale keys in `economy_operations`.
These changes use the existing majority-committed Mongo transactions. Replaying
the same keyed purchase or sale returns the original operation without another
debit or credit. Existing unique resident/item indexes remain unchanged.

The browser preview saves its own progress locally and does not represent shared
server ownership. The production frontend uses the authenticated API.

## Extension points

Property-scoped records and trusted support references provide the basis for
multiple homes and furniture transfers. Multiple copies of the same furniture
type should use separate inventory instance IDs and matching placement references,
with an explicit migration of legacy item IDs. Saved layout slots should reference
those owned instances rather than manufacture ownership. Neither feature is
claimed as implemented by this change.

Home visits continue to show the owner's saved furnishings read-only. Existing
sleep, shower, meal and relaxation activities remain available through the home's
authored interaction points.

## Verification

```sh
node --test tests/furniture-authority.test.mjs
TEST_MONGODB_CONFIG=/secure/path/test-mongodb.json \
  node --test tests/mongo-furniture.integration.mjs
```

The Mongo test configuration contains a private URI and must remain outside Git.
Tests cover real concurrent purchase/replay, owned-home enforcement, geometry
rejections, exact reload rendering, server-derived surface elevation, support
movement, storage/resale, separate backend connections and isolated accounts.
