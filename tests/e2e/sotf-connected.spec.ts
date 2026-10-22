import { expect, test } from '@playwright/test';

test('a first native session survives reload and recovers a lost save reply', async ({ page, request }) => {
  test.skip(!process.env.SOTF_SYNTHETIC_HARNESS, 'Requires the isolated synthetic component server, never a live account.');
  await request.post('/__test/reset');
  await page.goto('/');
  await page.getByLabel('Where are you in the transition?').fill('Exploring over the next six months');
  await page.getByLabel('What is the most useful decision to work on?').fill('Which work gives me meaningful ownership?');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('What would you like to spend time actually doing?').fill('Resolve delivery decisions across teams');
  await page.getByLabel('What kind of working environment do you want?').fill('Decision authority and a sustainable pace');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Possibility 1').fill('Program leadership');
  await page.getByLabel('Possibility 2').fill('Operations improvement');
  await page.getByRole('button', { name: 'Confirm these starting points' }).click();
  await expect(page.getByRole('heading', { name: 'Which work gives me meaningful ownership?' })).toBeVisible();
  await page.getByRole('button', { name: 'Assess an opportunity', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Company', { exact: true }).fill('Fictional Northstar');
  await dialog.getByLabel('Role', { exact: true }).fill('Program Lead');
  await dialog.getByRole('button', { name: 'Save and examine the evidence' }).click();
  await page.getByRole('button', { name: 'Record my decision and next move' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('My decision').selectOption('investigate');
  await dialog.getByLabel('Why?', { exact: true }).fill('Decision ownership is unresolved');
  await dialog.getByLabel('Next action, or what I am deliberately pausing').fill('Ask a practitioner which decisions I would own');
  await dialog.getByLabel('What would cause me to reconsider?').fill('A specific example of decision authority');
  await request.post('/__test/lose-next-reply');
  await dialog.getByRole('button', { name: 'Confirm and save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Verify and recover the same step' }).click();
  await expect(page.getByRole('status')).toContainText('previous step was saved');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Which work gives me meaningful ownership?' })).toBeVisible();
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await expect(page.getByText('Your recorded decision', { exact: false })).toBeVisible();
  await expect(page.getByText('Next: Ask a practitioner which decisions I would own', { exact: true })).toBeVisible();
  const saved = await request.get('/api/sotf', { headers: { authorization: 'Bearer synthetic-local-session' } });
  const result = await saved.json(); expect(result.state.revision).toBe(3); expect(result.state.opportunities).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('synthetic test people stay out of relationship cards and meeting choices', async ({ page, request }) => {
  test.skip(!process.env.SOTF_SYNTHETIC_HARNESS, 'Requires the isolated synthetic component server, never a live account.');
  await request.post('/__test/reset');
  const save = async (revision: number, command: unknown, requestId: string) => {
    const response = await request.post('/api/sotf', {
      headers: { authorization: 'Bearer synthetic-local-session' },
      data: { requestId, expectedRevision: revision, userConfirmed: true, dataClass: 'ordinary_transition_operations', command }
    });
    expect(response.ok()).toBeTruthy();
  };
  await save(0, {
    type: 'start_transition', timing: 'Exploring options', question: 'Which work fits my experience?', weeklyHours: 8,
    criteria: [{ id: 'ownership', label: 'Decision ownership', dimension: 'environment', desired: 'Own meaningful decisions', confirmed: true }],
    hypotheses: [{ id: 'program', proposition: 'Program leadership', whyPromising: 'Cross-team work may fit', assumptions: [], gaps: [], nextExperiment: 'Ask a practitioner', reviewTrigger: 'After a real conversation', confidenceExplanation: 'Unverified hypothesis' }]
  }, '90000000-0000-4000-8000-000000000001');
  for (const [revision, id, name, testRecord, requestId] of [[1, 'real-person', 'Real professional contact', false, '90000000-0000-4000-8000-000000000002'], [2, 'synthetic-person', 'SOTF AI Slop Gate Test', true, '90000000-0000-4000-8000-000000000003'], [3, 'other-synthetic-person', 'Another Synthetic Contact', true, '90000000-0000-4000-8000-000000000004']] as const) {
    await save(revision, {
      type: 'save_person', person: { id, name, company: 'Fictional company', role: 'Fictional role', source: 'Synthetic browser test', overlap: '', whyNow: 'Verify owner-facing contact visibility', objective: 'Confirm real records remain visible', introductionPath: '', hypothesisIds: ['program'], testRecord }
    }, requestId);
  }
  await save(4, {
    type: 'record_meeting', meeting: { id: 'synthetic-meeting', title: 'Review an existing synthetic meeting', personId: 'synthetic-person', hypothesisIds: ['program'], kind: 'networking', startsAt: '2026-10-14T15:00:00.000Z', endsAt: '2026-10-14T15:30:00.000Z', status: 'accepted', provider: 'manual', objective: 'Test editing an existing linked meeting' }
  }, '90000000-0000-4000-8000-000000000005');

  await page.goto('/');
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Real professional contact', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SOTF AI Slop Gate Test', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Record an agreed meeting', exact: true }).click();
  const person = page.getByRole('combobox', { name: 'Person Optional', exact: true });
  await expect(person.getByRole('option', { name: 'Real professional contact', exact: true })).toHaveCount(1);
  await expect(person.getByRole('option', { name: 'SOTF AI Slop Gate Test', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const meetingCard = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Review an existing synthetic meeting', exact: true }) });
  await meetingCard.getByRole('button', { name: 'Reschedule or correct status', exact: true }).click();
  const linkedPerson = page.getByRole('combobox', { name: 'Person Optional', exact: true });
  await expect(linkedPerson.getByRole('option', { name: 'SOTF AI Slop Gate Test', exact: true })).toHaveCount(1);
  await expect(linkedPerson.getByRole('option', { name: 'Another Synthetic Contact', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Networking', exact: true }).click();
  await page.getByRole('button', { name: 'Add person', exact: true }).click();
  const savedPerson = page.getByRole('combobox', { name: 'Saved person Optional', exact: true });
  await expect(savedPerson.getByRole('option', { name: 'Real professional contact · Fictional company', exact: true })).toHaveCount(1);
  await expect(savedPerson.getByRole('option', { name: 'SOTF AI Slop Gate Test · Fictional company', exact: true })).toHaveCount(0);
  await expect(savedPerson.getByRole('option', { name: 'Another Synthetic Contact · Fictional company', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const saved = await request.get('/api/sotf', { headers: { authorization: 'Bearer synthetic-local-session' } });
  const result = await saved.json();
  expect(result.state.people.map((item: { id: string }) => item.id)).toEqual(['real-person', 'synthetic-person', 'other-synthetic-person']);
  expect(result.state.meetings.map((item: { personId?: string }) => item.personId)).toEqual(['synthetic-person']);
});
