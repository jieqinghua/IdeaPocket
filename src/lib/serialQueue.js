// 所有任务严格按入队顺序执行；单次失败不会阻塞后续任务。
export function createSerialQueue(run, onError = () => {}) {
  let tail = Promise.resolve();

  return {
    enqueue(value) {
      tail = tail.then(() => run(value)).catch((error) => {
        onError(error);
      });
      return tail;
    },
    idle() {
      return tail;
    },
  };
}
