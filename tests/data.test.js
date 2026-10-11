import test from 'node:test';import assert from 'node:assert/strict';import {people} from '../src/data.js';
test('collection extensible au-delà de 30 personnalités',()=>assert.ok(people.length>=70));
test('pas de noms dupliqués',()=>assert.equal(new Set(people.map(p=>p[0])).size,people.length));
test('fiches complètes',()=>people.forEach(p=>{assert.equal(p.length,7);assert.ok(p.every(Boolean))}));
