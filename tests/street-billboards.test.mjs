import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STREET_BILLBOARD, boardCampaign, liveCampaigns, buildStreetBillboards } from '../app/world-billboards.js';
import { buildCity } from '../app/world-city-base.js';
import { CITY_ROADS } from '../app/world-city-fabric.js';
import { VENUES, venueAvailable } from '../src/shared/life.mjs';

const image = 'data:image/png;base64,AAAA', ad = (id, extra = {}) => ({ txRef: id, slots: ['billboard-01'], startAt: 0, endAt: 9e12, imageDataUrl: image, ...extra });
const city = id => buildCity({ profile: { district: id, home: { district: id } }, place: { id }, venues: VENUES.filter(venue => venueAvailable(venue.id, id)) });

test('street billboards stand on the pavement beside every main road, clear of doors', () => {
  for (const id of ['lugbe', 'central-area', 'maitama']) {
    const scene = city(id), boards = scene.fabric.billboards;
    assert.ok(boards.length >= 8 && boards.length <= 16, `${id} has ${boards.length} boards`);
    assert.equal(new Set(boards.map(board => board.id)).size, boards.length);
    for (const board of boards) {
      const road = CITY_ROADS.horizontal.find(([y, h]) => Math.abs(board.y - (y - 20)) < 1 || Math.abs(board.y - (y + h + 20)) < 1);
      assert.ok(road, `${id} ${board.id} is beside a main road`);
      assert.equal(board.facing, board.y < road[0] ? 1 : -1, 'the face looks at the traffic');
      assert.ok(!CITY_ROADS.vertical.some(([x, w]) => board.x > x - 30 && board.x < x + w + 30), 'not in a side road');
      assert.ok(!scene.interactables.some(point => Math.abs(point.x - board.x) < 130 && board.y > point.y - 70 && board.y < point.y + 310), 'never in front of a door');
    }
    for (const [y] of CITY_ROADS.horizontal) assert.ok(boards.filter(board => Math.abs(board.y - y) < 300).length >= 2, 'every main road carries boards');
  }
});

test('only live campaigns with a real image rotate, one per 15 seconds, offset per board', () => {
  const now = 1_000_000, state = { active: [ad('a'), ad('b'), ad('a'), ad('expired', { endAt: now - 1 }), ad('future', { startAt: now + 1 }), ad('no-image', { imageDataUrl: 'https://example.com/x.png' }), ad('off', { enabled: false })] };
  assert.deepEqual(liveCampaigns(state, now).map(row => row.txRef), ['a', 'b'], 'expired, future, disabled, remote-image and duplicate campaigns never show');
  assert.deepEqual(liveCampaigns(null, now), []); assert.equal(boardCampaign([], 0, now), null);
  const list = liveCampaigns(state, now), slot = STREET_BILLBOARD.rotateMs;
  assert.notEqual(boardCampaign(list, 0, now).txRef, boardCampaign(list, 1, now).txRef, 'neighbouring boards differ');
  assert.equal(boardCampaign(list, 0, now).txRef, boardCampaign(list, 0, now + slot - 1 - now % slot).txRef, 'steady within a slot');
  assert.notEqual(boardCampaign(list, 0, now).txRef, boardCampaign(list, 0, now + slot).txRef, 'changes on the next slot');
  const shown = new Set(); for (let i = 0; i < 6; i++) shown.add(boardCampaign(list, 0, now + i * slot).txRef); assert.equal(shown.size, 2, 'every campaign gets airtime');
});

test('boards show the house panel until a campaign decodes, then rotate with a bounded cache', async () => {
  let time = 0, decodes = 0; const state = { active: [] };
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }) }) });
  const layout = city('lugbe').fabric.billboards.slice(0, 4);
  const boards = buildStreetBillboards(THREE, layout, { now: () => time, readAds: () => state, makeCanvas: canvas, decode: async () => { decodes++; return { width: 640, height: 320 }; } });
  assert.equal(boards.diagnostics.boards, 4);
  boards.update(); assert.deepEqual(boards.diagnostics.showing, ['', '', '', ''], 'no campaigns: every board shows the advertise-here panel');
  const faces = []; boards.group.traverse(node => { if (node.geometry?.type === 'PlaneGeometry') faces.push(node); });
  assert.equal(faces.length, 4); assert.ok(faces.every(face => face.material.map), 'the house panel is a real texture');
  assert.ok(faces.every(face => Math.abs(face.scale.y / face.scale.x - STREET_BILLBOARD.aspect) < 1e-9));
  state.active = Array.from({ length: 12 }, (_, i) => ad(`c${i}`));
  boards.update(); await new Promise(resolve => setImmediate(resolve)); boards.update();
  assert.deepEqual(boards.diagnostics.showing, ['c0', 'c1', 'c2', 'c3']); assert.equal(decodes, 4);
  const before = decodes; boards.update(); boards.update(); assert.equal(decodes, before, 'nothing is re-decoded inside a slot');
  for (let slot = 1; slot <= 12; slot++) { time = slot * STREET_BILLBOARD.rotateMs; boards.update(); await new Promise(resolve => setImmediate(resolve)); boards.update(); assert.ok(boards.diagnostics.textures <= STREET_BILLBOARD.maxTextures, 'texture cache stays bounded'); }
  state.active = []; time += STREET_BILLBOARD.rotateMs; boards.update(); assert.deepEqual(boards.diagnostics.showing, ['', '', '', ''], 'when campaigns end the boards fall back, never showing a stale ad');
  boards.dispose();
});
