import { test, expect } from '@playwright/experimental-ct-react';
import { DiffViewer } from '@/features/shared/components/git/DiffViewer';

test.describe('DiffViewer Visual Regression', () => {
  const mockStructuredPatch = [
    {
      oldStart: 1,
      oldLines: 5,
      newStart: 1,
      newLines: 6,
      lines: [
        ' context line 1',
        ' context line 2',
        '-removed line',
        '+added line 1',
        '+added line 2',
        ' context line 3',
      ],
    },
    {
      oldStart: 10,
      oldLines: 3,
      newStart: 11,
      newLines: 4,
      lines: [' context line 4', '-old content', '+new content', '+extra line'],
    },
  ];

  test('@visual renders file creation diff', async ({ mount, page }) => {
    const newContent = `import React from 'react';

export const HelloWorld = () => {
  return <div>Hello World</div>;
};`;

    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer
          filePath="src/components/HelloWorld.tsx"
          type="create"
          newContent={newContent}
        />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(component.locator('text=src/components/HelloWorld.tsx')).toBeVisible();
    await expect(component.locator('[data-testid="diff-content"]')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-create.png');
  });

  test('@visual renders file edit diff with old and new content', async ({ mount, page }) => {
    const oldContent = `export const HelloWorld = () => {
  return <div>Hello</div>;
};`;

    const newContent = `export const HelloWorld = () => {
  return <div>Hello World</div>;
};`;

    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer
          filePath="src/components/HelloWorld.tsx"
          type="edit"
          oldContent={oldContent}
          newContent={newContent}
        />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(component.locator('[data-testid="diff-line"]').first()).toBeVisible();
    await expect(page).toHaveScreenshot('diff-edit.png');
  });

  test('@visual renders structured patch diff', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer
          filePath="src/components/Example.tsx"
          type="edit"
          structuredPatch={mockStructuredPatch}
        />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(component.locator('text=@@ -1,5 +1,6 @@')).toBeVisible();
    await expect(component.locator('text=@@ -10,3 +11,4 @@')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-structured-patch.png');
  });

  test('@visual addition lines have correct styling', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="test.ts" type="edit" structuredPatch={mockStructuredPatch} />
      </div>
    );

    const additionLine = component.locator('text=+added line 1').first();
    await expect(additionLine).toBeVisible();

    // Check for addition styling (green background)
    const additionContainer = additionLine.locator('..');
    await expect(additionContainer).toHaveClass(/bg-\[#0d2818\]/);
    await expect(additionContainer).toHaveClass(/border-\[#3fb950\]/);

    await expect(page).toHaveScreenshot('diff-addition-styling.png');
  });

  test('@visual deletion lines have correct styling', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="test.ts" type="edit" structuredPatch={mockStructuredPatch} />
      </div>
    );

    const deletionLine = component.locator('text=-removed line').first();
    await expect(deletionLine).toBeVisible();

    // Check for deletion styling (red background)
    const deletionContainer = deletionLine.locator('..');
    await expect(deletionContainer).toHaveClass(/bg-\[#2d0a0a\]/);
    await expect(deletionContainer).toHaveClass(/border-\[#f85149\]/);

    await expect(page).toHaveScreenshot('diff-deletion-styling.png');
  });

  test('@visual context lines have neutral styling', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="test.ts" type="edit" structuredPatch={mockStructuredPatch} />
      </div>
    );

    const contextLine = component.locator('text= context line 1').first();
    await expect(contextLine).toBeVisible();

    await expect(page).toHaveScreenshot('diff-context-styling.png');
  });

  test('@visual line numbers render correctly', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="test.ts" type="edit" structuredPatch={mockStructuredPatch} />
      </div>
    );

    // Check line numbers are visible
    const lineNumbers = component.locator('[data-testid="diff-line-number"]');
    await expect(lineNumbers.first()).toBeVisible();

    await expect(page).toHaveScreenshot('diff-line-numbers.png');
  });

  test('@visual hunk headers render correctly', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="test.ts" type="edit" structuredPatch={mockStructuredPatch} />
      </div>
    );

    // Verify both hunk headers
    await expect(component.locator('text=@@ -1,5 +1,6 @@')).toBeVisible();
    await expect(component.locator('text=@@ -10,3 +11,4 @@')).toBeVisible();

    await expect(page).toHaveScreenshot('diff-hunk-headers.png');
  });

  test('@visual file path header renders correctly', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer
          filePath="src/components/ComplexPath/DeepNested/File.tsx"
          type="create"
          newContent="const x = 1;"
        />
      </div>
    );

    await expect(
      component.locator('text=src/components/ComplexPath/DeepNested/File.tsx')
    ).toBeVisible();
    await expect(page).toHaveScreenshot('diff-file-path-header.png');
  });

  test('@visual empty diff renders gracefully', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="empty.ts" type="edit" structuredPatch={[]} />
      </div>
    );

    await expect(component.locator('text=empty.ts')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-empty.png');
  });

  test('@visual multiple hunks render correctly', async ({ mount, page }) => {
    const largeStructuredPatch = [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        lines: [' line 1', '-old line 2', '+new line 2', '+added line 3', ' line 4'],
      },
      {
        oldStart: 20,
        oldLines: 2,
        newStart: 21,
        newLines: 3,
        lines: [' line 20', '+added line 21', ' line 22'],
      },
      {
        oldStart: 50,
        oldLines: 4,
        newStart: 52,
        newLines: 2,
        lines: [' line 50', '-removed line 51', '-removed line 52', ' line 53'],
      },
    ];

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="large-file.ts" type="edit" structuredPatch={largeStructuredPatch} />
      </div>
    );

    await expect(component.locator('text=@@ -1,3 +1,4 @@')).toBeVisible();
    await expect(component.locator('text=@@ -20,2 +21,3 @@')).toBeVisible();
    await expect(component.locator('text=@@ -50,4 +52,2 @@')).toBeVisible();

    await expect(page).toHaveScreenshot('diff-multiple-hunks.png');
  });

  test('@visual long lines wrap correctly', async ({ mount, page }) => {
    const longLineContent = `const veryLongVariableName = "This is a very long string that should wrap if the container is not wide enough to display it in a single line without horizontal scrolling";`;

    const component = await mount(
      <div style={{ width: '600px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="long-line.ts" type="create" newContent={longLineContent} />
      </div>
    );

    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('diff-long-lines.png');
  });

  test('@visual custom className applies correctly', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer
          filePath="test.ts"
          type="create"
          newContent="const x = 1;"
          className="custom-diff-viewer"
        />
      </div>
    );

    await expect(component.locator('.custom-diff-viewer')).toBeVisible();
  });

  test('@visual scrollable content renders correctly', async ({ mount, page }) => {
    const longContent = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');

    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="long-file.ts" type="create" newContent={longContent} />
      </div>
    );

    await expect(component).toBeVisible();

    // Check that ScrollArea component is present
    const scrollArea = component.locator('[data-radix-scroll-area-viewport]');
    await expect(scrollArea).toBeVisible();

    await expect(page).toHaveScreenshot('diff-scrollable.png');
  });

  test('renders diff lines correctly', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117' }}>
        <DiffViewer filePath="test.ts" type="edit" structuredPatch={mockStructuredPatch} />
      </div>
    );

    const diffLines = component.locator('[data-testid="diff-line"]');
    await expect(diffLines).toHaveCount(10); // Total lines across both hunks
  });

  test('applies border styling to container', async ({ mount }) => {
    const component = await mount(
      <DiffViewer filePath="test.ts" type="create" newContent="const x = 1;" />
    );

    // Check for rounded border
    const container = component.locator('.rounded-md.border.border-border');
    await expect(container).toBeVisible();
  });

  test('@visual all states showcase', async ({ mount, page }) => {
    await mount(
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          padding: '2rem',
          background: '#0d1117',
        }}
      >
        <div>
          <h3 style={{ color: 'white', marginBottom: '10px' }}>Create Mode</h3>
          <DiffViewer filePath="create.ts" type="create" newContent="const hello = 'world';" />
        </div>
        <div>
          <h3 style={{ color: 'white', marginBottom: '10px' }}>Edit Mode</h3>
          <DiffViewer
            filePath="edit.ts"
            type="edit"
            oldContent="const x = 1;"
            newContent="const x = 2;"
          />
        </div>
        <div>
          <h3 style={{ color: 'white', marginBottom: '10px' }}>Structured Patch</h3>
          <DiffViewer filePath="patch.ts" type="edit" structuredPatch={mockStructuredPatch} />
        </div>
        <div>
          <h3 style={{ color: 'white', marginBottom: '10px' }}>Empty Diff</h3>
          <DiffViewer filePath="empty.ts" type="edit" structuredPatch={[]} />
        </div>
      </div>
    );

    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('diff-all-states-showcase.png', { fullPage: true });
  });

  test('@visual dark theme consistency', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', background: '#0d1117', padding: '20px' }}>
        <DiffViewer filePath="theme-test.ts" type="edit" structuredPatch={mockStructuredPatch} />
      </div>
    );

    await expect(component).toBeVisible();

    // Verify dark theme colors are applied
    const additionLine = component.locator('text=+added line 1');
    await expect(additionLine).toBeVisible();

    const deletionLine = component.locator('text=-removed line');
    await expect(deletionLine).toBeVisible();

    await expect(page).toHaveScreenshot('diff-dark-theme.png');
  });
});
