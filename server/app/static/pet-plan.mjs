// Only a due review or an untried first turn is worth an unsolicited invitation.
// The companion can keep this small plan offline without reading learning records itself.
export function petInvitationPlan(missions, mastery) {
  const reviews = [];
  const newMissions = [];
  for (const scene of missions) {
    const firstTurn = scene.turns?.[0];
    if (!firstTurn) continue;
    const item = mastery[`conversation:${scene.id}:${firstTurn.id}`];
    if (!item || !item.attempts) {
      newMissions.push(scene.id);
    } else if (Number.isSafeInteger(item.dueAt) && item.dueAt > 0) {
      reviews.push({ sceneId: scene.id, dueAt: item.dueAt });
    }
  }
  reviews.sort((a, b) => a.dueAt - b.dueAt);
  return { reviewMission: reviews[0]?.sceneId || '', reviewAt: reviews[0]?.dueAt || 0,
    reviewMissions: reviews.map(item => `${item.sceneId}:${item.dueAt}`).join(','),
    newMissions: newMissions.join(',') };
}
