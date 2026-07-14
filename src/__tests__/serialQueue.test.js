import { createSerialQueue } from '../lib/serialQueue';

test('保存任务严格按顺序执行', async () => {
  const events = [];
  let releaseFirst;
  const queue = createSerialQueue(async (value) => {
    events.push(`start:${value}`);
    if (value === 1) await new Promise((resolve) => (releaseFirst = resolve));
    events.push(`end:${value}`);
  });

  queue.enqueue(1);
  queue.enqueue(2);
  await Promise.resolve();
  expect(events).toEqual(['start:1']);
  releaseFirst();
  await queue.idle();
  expect(events).toEqual(['start:1', 'end:1', 'start:2', 'end:2']);
});

test('一次失败会报告错误但不会阻塞后续保存', async () => {
  const errors = [];
  const completed = [];
  const queue = createSerialQueue(async (value) => {
    if (value === 1) throw new Error('disk full');
    completed.push(value);
  }, (error) => errors.push(error.message));

  queue.enqueue(1);
  queue.enqueue(2);
  await queue.idle();
  expect(errors).toEqual(['disk full']);
  expect(completed).toEqual([2]);
});
