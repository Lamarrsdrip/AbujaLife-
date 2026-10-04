import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryStore } from './store.js';
import { Ledger, PaymentReceiptVerifier, grantTopup } from './economy.js';
import { performLifeAction } from './life.js';
import { completeJobShift } from './jobs.js';
import { purchaseVirtualItem, okrikaHandoff } from './market.js';
import { sendMessage } from './social.js';
import { acquireProperty } from './property.js';
import { purchaseVehicle, driveVehicle } from './vehicles.js';
import { openBusiness, runBusinessCycle } from './business.js';
import { requestFriend, acceptFriend, blockPlayer } from './socialGraph.js';
import { listActiveEvents, joinEvent } from './worldEvents.js';
import { nominateMayor, voteMayor } from './election.js';
import { heartbeatPresence, nearbyPlayers } from './presence.js';
import { bookCityAd } from './ads.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const readData = name => JSON.parse(fs.readFileSync(path.resolve(here, '../../../data/abuja', name), 'utf8'));
export const createApp = (options = {}) => ({
  store: options.store ?? new MemoryStore(), ledger: options.ledger ?? new Ledger(),
  verifier: options.verifier ?? new PaymentReceiptVerifier({ allowDevReceipts: options.allowDevReceipts ?? false }),
  districts: readData('districts.json'), jobs: readData('jobs.json'), catalog: readData('catalog.json'), landmarks: readData('landmarks.json'),
  vehicles: readData('vehicles.json'), businesses: readData('businesses.json'), properties: readData('properties.json'), roads: readData('roads.json'), events: readData('events.json'), npcArchetypes: readData('npc_archetypes.json'),
  okrikaBaseUrl: options.okrikaBaseUrl ?? 'https://okrika.store',
  grantTopup, performLifeAction, completeJobShift, purchaseVirtualItem, okrikaHandoff, sendMessage,
  acquireProperty, purchaseVehicle, driveVehicle, openBusiness, runBusinessCycle, requestFriend, acceptFriend, blockPlayer,
  listActiveEvents, joinEvent, nominateMayor, voteMayor, heartbeatPresence, nearbyPlayers, bookCityAd
});
