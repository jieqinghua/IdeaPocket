export async function prepareUpdateSafety({
  ready,
  noteQueue,
  themeQueue,
  getSaveFailure,
  createBackup,
}) {
  if (!ready) throw new Error('本地笔记还没有读取完成');
  await Promise.all([noteQueue.idle(), themeQueue.idle()]);
  const saveFailure = getSaveFailure();
  if (saveFailure) {
    const error = new Error('最近的笔记或主题尚未安全保存，已取消更新');
    error.cause = saveFailure;
    throw error;
  }
  return createBackup();
}
