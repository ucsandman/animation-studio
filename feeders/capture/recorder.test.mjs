import test from 'node:test';
import assert from 'node:assert/strict';
import {Recorder} from './recorder.mjs';

const fakeLocator = (box) => ({
  boundingBox: async () => box,
  click: async () => {},
});

test('records steps and clicks with monotonic relative timestamps', async () => {
  const r = new Recorder();
  r.start();
  r.step('intro');
  await r.click(fakeLocator({x: 100, y: 200, width: 50, height: 20}), 'open view');
  const tel = r.finish({width: 1600, height: 1000});

  assert.equal(tel.viewport.width, 1600);
  assert.ok(tel.durationMs >= 0);
  const types = tel.events.map((e) => e.type);
  assert.deepEqual(types, ['step', 'step', 'click']); // intro, click label, click
  const click = tel.events[2];
  assert.equal(click.x, 125); // box center
  assert.equal(click.y, 210);
  assert.ok(tel.events.every((e) => e.t >= 0 && e.t <= tel.durationMs));
});

test('click throws loudly when the locator has no bounding box', async () => {
  const r = new Recorder();
  r.start();
  await assert.rejects(() => r.click(fakeLocator(null)), /bounding box/);
});

test('using the recorder before start() throws', () => {
  const r = new Recorder();
  assert.throws(() => r.step('x'), /start/);
});

test('records an explicit focus region with rounded center and size', () => {
  const r = new Recorder();
  r.start();
  r.focusAt(930.4, 379.6, {w: 1000, h: 560});
  const tel = r.finish({width: 1720, height: 1000});
  assert.deepEqual(
    {...tel.events[0], t: 0},
    {type: 'focus', t: 0, x: 930, y: 380, w: 1000, h: 560},
  );
});

test('focusAt before start() throws', () => {
  const r = new Recorder();
  assert.throws(() => r.focusAt(1, 2), /start/);
});
