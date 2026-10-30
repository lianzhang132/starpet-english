import test from 'node:test';
import assert from 'node:assert/strict';
import { petInvitationPlan } from '../app/static/pet-plan.mjs';

const missions = [
  { id: 'chat-intro', turns: [{ id: 'name' }] },
  { id: 'chat-color', turns: [{ id: 'color' }] },
  { id: 'chat-animal', turns: [{ id: 'animal' }] }
];

test('invites untried first turns without repeating mastered undued topics', () => {
  assert.deepEqual(petInvitationPlan(missions, {
    'conversation:chat-intro:name': { attempts: 1, dueAt: 1000 },
    'conversation:chat-color:color': { attempts: 2, dueAt: 500 }
  }), { reviewMission: 'chat-color', reviewAt: 500,
    reviewMissions: 'chat-color:500,chat-intro:1000', newMissions: 'chat-animal' });
  assert.deepEqual(petInvitationPlan(missions, {}),
    { reviewMission: '', reviewAt: 0, reviewMissions: '', newMissions: 'chat-intro,chat-color,chat-animal' });
});

test('when all topics have been tried only a scheduled review can invite', () => {
  const plan = petInvitationPlan(missions, Object.fromEntries(missions.map(scene =>
    [`conversation:${scene.id}:${scene.turns[0].id}`, { attempts: 1, dueAt: 1000 }])));
  assert.equal(plan.newMissions, '');
  assert.equal(plan.reviewAt, 1000);
  assert.equal(plan.reviewMissions, 'chat-intro:1000,chat-color:1000,chat-animal:1000');
});
