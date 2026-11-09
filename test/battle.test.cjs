const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.slice(html.indexOf('const CLASSES'), html.lastIndexOf('</script>'));
function setup(cls = 'warrior') {
  const timers = [], nodes = new Map();
  const document = {
    querySelectorAll: () => [],
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { style: {}, innerHTML: '', classList: { add() {} } });
      return nodes.get(id);
    }
  };
  const c = vm.createContext({ document, localStorage: { getItem: () => null }, alert() {}, console,
    setTimeout: fn => timers.push(fn) });
  vm.runInContext(script, c);
  vm.runInContext(`Math.random = () => 0; G = newGame('Hero', ${JSON.stringify(cls)});
    showScreen = id => { globalThis.screen = id; };
    updateDungeonUI = () => {}; setMsg = () => {};
    battle = { enemy: { name: 'Dummy', hp: 1000, maxHp: 1000, atk: 5, def: 0, exp: 0, gold: 7 } };`, c);
  return { c, timers, read: expr => vm.runInContext(expr, c) };
}

test('a surviving enemy acts only after the scheduled turn and commands unlock', () => {
  const { c, timers, read } = setup();
  const hp = read('G.hp');
  c.battleAction('attack');
  assert.ok(read('battle.enemy.hp') < 1000);
  assert.equal(read('G.hp'), hp);
  assert.equal(c.document.getElementById('btn-attack').disabled, true);
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.ok(read('G.hp') < hp);
  assert.equal(c.document.getElementById('btn-attack').disabled, false);
});

test('victory grants the enemy reward and returns without an enemy attack', () => {
  const { c, timers, read } = setup();
  vm.runInContext('battle.enemy.hp = 1', c);
  const gold = read('G.gold'), hp = read('G.hp');
  c.battleAction('attack');
  assert.equal(read('battle.enemy.hp'), 0);
  assert.equal(read('G.gold'), gold + 7);
  assert.equal(read('G.hp'), hp);
  timers.shift()();
  assert.equal(c.screen, 'screen-dungeon');
  assert.equal(read('G.gold'), gold + 7);
});

test('mage spell consumes its stated MP cost', () => {
  const { c, read } = setup('mage');
  const mp = read('G.mp');
  c.battleAction('magic');
  assert.equal(read('G.mp'), mp - 5);
  assert.ok(read('battle.enemy.hp') < 1000);
});

test('healing consumes one item and never exceeds maximum HP', () => {
  const { c, read } = setup();
  const qty = read('G.items[0].qty');
  vm.runInContext('G.hp = G.maxHp - 1', c);
  c.battleAction('item');
  assert.equal(read('G.hp'), read('G.maxHp'));
  assert.equal(read('G.items[0].qty'), qty - 1);
});

test('defeat clamps HP to zero, disables actions, and opens game over', () => {
  const { c, timers, read } = setup();
  vm.runInContext('G.hp = 1; battle.enemy.atk = 1000', c);
  c.enemyTurn();
  assert.equal(read('G.hp'), 0);
  assert.equal(c.document.getElementById('btn-attack').disabled, true);
  timers.shift()();
  assert.equal(c.screen, 'screen-gameover');
});
