"""Deployed sync smoke check using a fresh isolated QA device, not learner data."""
import argparse
import json
import uuid
from urllib.error import HTTPError
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base', required=True)
parser.add_argument('--expected-version', default='1.5.4')
args = parser.parse_args()
base = args.base.rstrip('/')
device = f"qa-sync-{uuid.uuid4()}"


def call(path, body=None, expected=200):
    request = Request(base + path, data=json.dumps(body).encode() if body is not None else None,
                      headers={'Content-Type': 'application/json'})
    try:
        response = urlopen(request, timeout=20)
    except HTTPError as error:
        response = error
    with response:
        assert response.status == expected, (path, response.status)
        return json.load(response)


version = call('/api/health')['version']
assert version == args.expected_version
catalog = call('/api/v1/catalog')
assert len(catalog['lessons']) == 24
assert len(catalog['conversations']) == 5
assert all(len(scene['translations']) == len(scene['lines']) for scene in catalog['dialogues'])
progress = {'deviceId': device, 'revision': 1, 'xp': 15, 'stars': 2, 'streak': 1,
            'completedLessons': [], 'learnedWords': ['hello'],
            'mastery': {'q-apple': {'level': 1, 'attempts': 1, 'correct': 1, 'lastSeen': 100, 'dueAt': 200}}}
call('/api/v1/progress', progress)
call('/api/v1/progress', {**progress, 'revision': 2, 'stars': 1})
call('/api/v1/progress', progress, expected=409)
answer = {'deviceId': device, 'requestId': str(uuid.uuid4()), 'questionId': 'q-apple', 'answerIndex': 1}
assert call('/api/v1/practice/answer', answer) == call('/api/v1/practice/answer', answer)
report = call(f'/api/v1/report/{device}')
stored = call(f'/api/v1/progress/{device}')
assert report['attempts'] == 1
assert stored['stars'] == 1 and stored['revision'] == 2
assert stored['mastery'] == progress['mastery']
print(json.dumps({'version': version, 'answerRetryCount': report['attempts'], 'oldSnapshotRejected': True,
                  'feedingStarsPersisted': stored['stars'], 'masterySync': 'ok', 'dialogueTranslations': 'ok', 'qaDevice': device}))
