import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { adDetailsModel, safeAdLink } from '../app/ad-details.js';
import { buildStreetBillboards } from '../app/world-billboards.js';
import { buildCity } from '../app/world-city-base.js';
import { VENUES, venueAvailable } from '../src/shared/life.mjs';

const image = 'data:image/png;base64,AAAA';
const read = file => fs.readFileSync(new URL(`../app/${file}`, import.meta.url), 'utf8');

test('advert details show only safe, approved content', () => {
  const view = adDetailsModel({ title: 'Mama Put Kitchen', sponsor: 'Mama Put Ltd', body: 'Hot amala daily.', link: 'https://www.mamaput.example/menu', imageDataUrl: image });
  assert.equal(view.title, 'Mama Put Kitchen'); assert.equal(view.sponsor, 'Mama Put Ltd'); assert.equal(view.image, image);
  assert.equal(view.link, 'https://www.mamaput.example/menu'); assert.equal(view.cta, 'Visit mamaput.example'); assert.equal(view.eyebrow, 'SPONSORED');
  for (const bad of ['javascript:alert(1)', 'http://plain.example', 'data:text/html,x', '', null, 'not a url']) assert.equal(safeAdLink(bad), null, String(bad));
  const hostile = adDetailsModel({ title: 'x', link: 'javascript:alert(1)', imageDataUrl: 'https://tracker.example/pixel.png' });
  assert.equal(hostile.link, null); assert.equal(hostile.image, null, 'remote images never load in the sheet');
  assert.equal(adDetailsModel({ title: 'x', imageDataUrl: 'data:image/svg+xml;base64,AAAA' }).image, null);
  const house = adDetailsModel({ campaignType: 'house', title: 'AbujaLife', body: 'Advertise with us', domain: 'abujacity.life', email: 'ads@abujacity.life', link: 'https://abujacity.life' });
  assert.equal(house.eyebrow, 'ABUJALIFE'); assert.equal(house.contact, 'abujacity.life · ads@abujacity.life');
  const vacant = adDetailsModel(null); assert.equal(vacant.vacant, true); assert.equal(vacant.link, null); assert.ok(vacant.title);
});

test('a tap ray picks the billboard it hits and the advert showing on it', async () => {
  const id = 'lugbe', scene = buildCity({ profile: { district: id, home: { district: id } }, place: { id }, venues: VENUES.filter(venue => venueAvailable(venue.id, id)) });
  const layout = scene.fabric.billboards.slice(0, 3), state = { active: [] };
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }) }) });
  const boards = buildStreetBillboards(THREE, layout, { now: () => 0, readAds: () => state, makeCanvas: canvas, decode: async () => ({ width: 640, height: 320 }) });
  boards.group.updateMatrixWorld(true);
  const faces = []; boards.group.traverse(node => { if (node.geometry?.type === 'PlaneGeometry') faces.push(node); });
  const rayAt = (face, fromFront = true) => { const centre = face.getWorldPosition(new THREE.Vector3()), normal = new THREE.Vector3(0, 0, 1).transformDirection(face.matrixWorld), origin = centre.clone().addScaledVector(normal, fromFront ? 400 : -400); return new THREE.Raycaster(origin, centre.clone().sub(origin).normalize()); };
  boards.update();
  const empty = boards.pick(rayAt(faces[1])); assert.equal(empty.boardId, layout[1].id); assert.equal(empty.ad, null, 'the house panel reports no advert');
  state.active = [0, 1, 2].map(i => ({ txRef: `c${i}`, title: `Brand ${i}`, slots: ['billboard-01'], startAt: 0, endAt: 9e12, imageDataUrl: image }));
  boards.update(); await new Promise(resolve => setImmediate(resolve)); boards.update();
  for (const [index, face] of faces.entries()) { const hit = boards.pick(rayAt(face)); assert.equal(hit.boardId, layout[index].id); assert.equal(hit.ad.txRef, `c${index}`, 'the advert on screen is the advert opened'); }
  assert.equal(boards.pick(rayAt(faces[0], false)), null, 'the back of a board is not an advert');
  assert.equal(boards.pick(new THREE.Raycaster(new THREE.Vector3(0, 5000, 0), new THREE.Vector3(0, 1, 0))), null, 'a tap on the sky hits nothing');
  boards.dispose(); assert.equal(boards.pick(rayAt(faces[0])), null);
});

test('street taps and the Map card both open the advert sheet', () => {
  const sim = read('world-simulator.js'), pickAt = sim.indexOf('pickBillboard?.('), walkAt = sim.indexOf('const p=toWorld(e);if(furnitureMode)');
  assert.ok(pickAt > 0 && pickAt < walkAt, 'a billboard tap is handled before tap-to-walk'); assert.ok(sim.includes("openAdDetails(board.ad,{source:'street'})") && sim.includes("from './ad-details.js'"));
  assert.ok(read('world-3d.js').includes('pickBillboard(clientX,clientY)')); assert.ok(read('world-3d-scenes.js').includes('pickBillboard:raycaster=>streetBoards?.pick(raycaster)'));
  const map = read('outside-city-v4.js'); assert.ok(map.includes('data-outside-action="ad-details"') && map.includes("case'ad-details':if(selected?.campaign)openAdDetails(selected.campaign") && map.includes("from './ad-details.js'"), 'the Map carries the sheet itself, on any page that mounts it');
  assert.ok(read('index.html').includes('/ad-details.css'));
  const sheet = read('ad-details.js'); assert.ok(sheet.includes('rel="noopener noreferrer sponsored"') && sheet.includes("'abj:open-ad-studio'"));
});
