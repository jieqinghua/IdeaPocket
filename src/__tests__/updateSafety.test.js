import { prepareUpdateSafety } from '../lib/updateSafety';

const queue = () => ({ idle: jest.fn().mockResolvedValue(undefined) });

test('更新前等待两条保存队列并创建安全备份', async () => {
  const noteQueue = queue();
  const themeQueue = queue();
  const createBackup = jest.fn().mockResolvedValue({ directoryUri: 'file:///backup' });

  await expect(prepareUpdateSafety({
    ready: true,
    noteQueue,
    themeQueue,
    getSaveFailure: () => null,
    createBackup,
  })).resolves.toEqual({ directoryUri: 'file:///backup' });

  expect(noteQueue.idle).toHaveBeenCalled();
  expect(themeQueue.idle).toHaveBeenCalled();
  expect(createBackup).toHaveBeenCalled();
});

test('最近一次保存失败时阻止备份和更新', async () => {
  const createBackup = jest.fn();
  await expect(prepareUpdateSafety({
    ready: true,
    noteQueue: queue(),
    themeQueue: queue(),
    getSaveFailure: () => new Error('disk full'),
    createBackup,
  })).rejects.toThrow('已取消更新');
  expect(createBackup).not.toHaveBeenCalled();
});

test('应用未完成本地数据读取时阻止更新', async () => {
  await expect(prepareUpdateSafety({
    ready: false,
    noteQueue: queue(),
    themeQueue: queue(),
    getSaveFailure: () => null,
    createBackup: jest.fn(),
  })).rejects.toThrow('还没有读取完成');
});
