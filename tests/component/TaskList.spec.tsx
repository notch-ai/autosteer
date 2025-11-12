import { test, expect } from '@playwright/experimental-ct-react';
import { TaskList } from '@/features/shared/components/tasks/TaskList';
import { Task } from '@/types/todo';

test.describe('TaskList Visual Regression', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      content: 'Complete Phase 3 implementation',
      status: 'in_progress',
      activeForm: 'Completing Phase 3 implementation',
    },
    {
      id: 'task-2',
      content: 'Write comprehensive tests',
      status: 'completed',
      activeForm: 'Writing comprehensive tests',
    },
    {
      id: 'task-3',
      content: 'Update documentation',
      status: 'pending',
      activeForm: 'Updating documentation',
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electron = {
        ipc: {
          invoke: async () => ({ success: true }),
          on: () => () => {},
        },
      };
    });
  });

  test('@visual renders task list with multiple tasks', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ padding: '20px', background: '#1e1e1e', width: '600px' }}>
        <TaskList tasks={mockTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(component.locator('text=Complete Phase 3 implementation')).toBeVisible();
    await expect(component.locator('text=Write comprehensive tests')).toBeVisible();
    await expect(component.locator('text=Update documentation')).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-multiple.png');
  });

  test('@visual renders empty state', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ padding: '20px', background: '#1e1e1e', width: '600px' }}>
        <TaskList tasks={[]} onToggleTask={() => {}} />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-empty.png');
  });

  test('@visual renders task with pending status', async ({ mount, page }) => {
    const pendingTasks: Task[] = [
      {
        id: 'task-1',
        content: 'Pending task example',
        status: 'pending',
        activeForm: 'Working on pending task',
      },
    ];

    const component = await mount(
      <div style={{ padding: '20px', background: '#1e1e1e', width: '600px' }}>
        <TaskList tasks={pendingTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component.locator('text=○')).toBeVisible();
    await expect(component.locator('text=Pending task example')).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-pending.png');
  });

  test('@visual renders task with in_progress status', async ({ mount, page }) => {
    const inProgressTasks: Task[] = [
      {
        id: 'task-1',
        content: 'In progress task example',
        status: 'in_progress',
        activeForm: 'Working on in progress task',
      },
    ];

    const component = await mount(
      <div style={{ padding: '20px', background: '#1e1e1e', width: '600px' }}>
        <TaskList tasks={inProgressTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component.locator('text=🔄')).toBeVisible();
    await expect(component.locator('text=In progress task example')).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-in-progress.png');
  });

  test('@visual renders task with completed status', async ({ mount, page }) => {
    const completedTasks: Task[] = [
      {
        id: 'task-1',
        content: 'Completed task example',
        status: 'completed',
        activeForm: 'Working on completed task',
      },
    ];

    const component = await mount(
      <div style={{ padding: '20px', background: '#1e1e1e', width: '600px' }}>
        <TaskList tasks={completedTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component.locator('text=✓')).toBeVisible();
    await expect(component.locator('text=Completed task example')).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-completed.png');
  });

  test('renders all task items correctly', async ({ mount }) => {
    const component = await mount(<TaskList tasks={mockTasks} onToggleTask={() => {}} />);

    const taskItems = component.locator('div > div > div');
    await expect(taskItems).toHaveCount(3);
  });

  test('displays correct status icons', async ({ mount }) => {
    const component = await mount(<TaskList tasks={mockTasks} onToggleTask={() => {}} />);

    await expect(component.locator('text=🔄')).toBeVisible();
    await expect(component.locator('text=✓')).toBeVisible();
    await expect(component.locator('text=○')).toBeVisible();
  });

  test('@visual renders long task content', async ({ mount, page }) => {
    const longContentTasks: Task[] = [
      {
        id: 'task-1',
        content:
          'This is a very long task description that should wrap properly and display correctly in the task list component without breaking the layout or causing any visual issues',
        status: 'pending',
        activeForm: 'Working on long task',
      },
    ];

    const component = await mount(
      <div style={{ padding: '20px', background: '#1e1e1e', width: '600px' }}>
        <TaskList tasks={longContentTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-long-content.png');
  });

  test('@visual renders mixed status tasks', async ({ mount, page }) => {
    const component = await mount(
      <div
        style={{
          padding: '20px',
          background: '#1e1e1e',
          width: '600px',
          height: '400px',
        }}
      >
        <TaskList tasks={mockTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-mixed-status.png');
  });

  test('handles task with special characters', async ({ mount }) => {
    const specialCharTasks: Task[] = [
      {
        id: 'task-1',
        content: 'Task with special chars: @#$%^&*()',
        status: 'pending',
        activeForm: 'Working on special task',
      },
    ];

    const component = await mount(<TaskList tasks={specialCharTasks} onToggleTask={() => {}} />);

    await expect(component.locator('text=Task with special chars: @#$%^&*()')).toBeVisible();
  });

  test('@visual renders task list in dark theme', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ padding: '20px', background: '#0d1117', width: '600px' }}>
        <TaskList tasks={mockTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-dark-theme.png');
  });

  test('task list renders without errors', async ({ mount }) => {
    const component = await mount(<TaskList tasks={mockTasks} onToggleTask={() => {}} />);

    await expect(component).toBeVisible();
  });

  test('@visual renders single task', async ({ mount, page }) => {
    const singleTask: Task[] = [
      {
        id: 'task-1',
        content: 'Single task example',
        status: 'in_progress',
        activeForm: 'Working on single task',
      },
    ];

    const component = await mount(
      <div style={{ padding: '20px', background: '#1e1e1e', width: '600px' }}>
        <TaskList tasks={singleTask} onToggleTask={() => {}} />
      </div>
    );

    await expect(component.locator('text=Single task example')).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-single.png');
  });

  test('@visual renders many tasks (10+)', async ({ mount, page }) => {
    const manyTasks: Task[] = Array.from({ length: 15 }, (_, i) => ({
      id: `task-${i + 1}`,
      content: `Task number ${i + 1}`,
      status: (i % 3 === 0
        ? 'completed'
        : i % 3 === 1
          ? 'in_progress'
          : 'pending') as Task['status'],
      activeForm: `Working on task ${i + 1}`,
    }));

    const component = await mount(
      <div
        style={{
          padding: '20px',
          background: '#1e1e1e',
          width: '600px',
          height: '800px',
        }}
      >
        <TaskList tasks={manyTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-many-tasks.png');
  });

  test('component unmounts cleanly', async ({ mount }) => {
    const component = await mount(<TaskList tasks={mockTasks} onToggleTask={() => {}} />);

    await expect(component).toBeVisible();
    await component.unmount();
  });

  test('@visual all states showcase', async ({ mount, page }) => {
    const showcaseTasks: Task[] = [
      {
        id: 'pending-1',
        content: 'Pending: Design new feature',
        status: 'pending',
        activeForm: 'Designing new feature',
      },
      {
        id: 'pending-2',
        content: 'Pending: Review pull request',
        status: 'pending',
        activeForm: 'Reviewing pull request',
      },
      {
        id: 'in-progress-1',
        content: 'In Progress: Implement authentication',
        status: 'in_progress',
        activeForm: 'Implementing authentication',
      },
      {
        id: 'in-progress-2',
        content: 'In Progress: Write unit tests',
        status: 'in_progress',
        activeForm: 'Writing unit tests',
      },
      {
        id: 'completed-1',
        content: 'Completed: Fix bug in login flow',
        status: 'completed',
        activeForm: 'Fixing bug in login flow',
      },
      {
        id: 'completed-2',
        content: 'Completed: Update documentation',
        status: 'completed',
        activeForm: 'Updating documentation',
      },
    ];

    const component = await mount(
      <div
        style={{
          padding: '20px',
          background: '#1e1e1e',
          width: '700px',
          height: '500px',
        }}
      >
        <TaskList tasks={showcaseTasks} onToggleTask={() => {}} />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('task-list-all-states.png');
  });
});
