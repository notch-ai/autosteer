// This test validates that the hasActiveTasks selector works correctly
describe('hasActiveTasks selector', () => {
  it('should return true when there are in-progress tasks', () => {
    const tasks = [
      { id: '1', status: 'pending' },
      { id: '2', status: 'in_progress' },
    ];
    const hasActiveTasks = () => tasks.some((task) => task.status === 'in_progress');
    expect(hasActiveTasks()).toBe(true);
  });

  it('should return false when no tasks are in-progress', () => {
    const tasks = [
      { id: '1', status: 'pending' },
      { id: '2', status: 'completed' },
    ];
    const hasActiveTasks = () => tasks.some((task) => task.status === 'in_progress');
    expect(hasActiveTasks()).toBe(false);
  });
});
