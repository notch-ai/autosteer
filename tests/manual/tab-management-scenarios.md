# Tab Management Manual Test Scenarios 

**Purpose**: Manual validation of tab management functionality including per-project tab persistence, cross-project isolation, and tab restoration flows.

**Prerequisites**:
- Desktop app installed and running
- At least 2 projects configured in the app
- Terminal access for cleanup between tests

---

## Test Scenario 1: Per-Project Tab State Persistence

**Objective**: Verify that each project maintains its own active tab selection that persists across project switches.

### Setup
1. Open desktop app
2. Ensure 2+ projects are available: Project A and Project B
3. Each project should have 3+ agents

### Test Steps

#### Step 1: Set Active Tab in Project A
1. Select Project A from project list
2. Create 3 new tabs (Cmd+T or click "New Tab")
3. Name tabs: "Alpha", "Beta", "Gamma"
4. Click on "Beta" tab (middle tab)
5. **Verify**: Beta tab is highlighted/active

#### Step 2: Switch to Project B
1. Select Project B from project list
2. Create 2 new tabs
3. Name tabs: "Delta", "Epsilon"
4. Click on "Epsilon" tab
5. **Verify**: Epsilon tab is highlighted/active

#### Step 3: Return to Project A
1. Select Project A from project list
2. **Verify**: "Beta" tab is automatically selected (NOT "Alpha")
3. **Verify**: All 3 tabs from Step 1 are still present

#### Step 4: Restart App
1. Quit desktop app completely (Cmd+Q)
2. Relaunch desktop app
3. Select Project A
4. **Verify**: "Beta" tab is still selected after app restart

### Expected Results
- ✅ Active tab selection persists when switching between projects
- ✅ Active tab selection survives app restarts
- ✅ Each project maintains independent active tab state

### Failure Scenarios
- ❌ Switching back to Project A selects first tab ("Alpha") instead of last selected ("Beta")
- ❌ After app restart, active tab is lost and first tab is selected
- ❌ Active tab state is shared across projects (changing in Project A affects Project B)

---

## Test Scenario 2: Cross-Project Tab Isolation

**Objective**: Verify that tabs are completely isolated between projects - creating/deleting tabs in one project doesn't affect another.

### Setup
1. Open desktop app
2. Create 3 projects: Project X, Project Y, Project Z
3. All projects should start with 0 tabs (fresh state)

### Test Steps

#### Step 1: Create Tabs in Project X
1. Select Project X
2. Create 5 tabs
3. **Verify**: Project X shows 5 tabs

#### Step 2: Create Tabs in Project Y
1. Select Project Y (DO NOT close Project X)
2. Create 3 tabs
3. **Verify**: Project Y shows exactly 3 tabs (not 8)

#### Step 3: Verify Project X Unchanged
1. Switch back to Project X
2. **Verify**: Project X still shows 5 tabs (unchanged)

#### Step 4: Delete Tabs in Project Y
1. Select Project Y
2. Delete 2 tabs (click X on tab)
3. **Verify**: Project Y now shows 1 tab

#### Step 5: Verify Project X Still Unchanged
1. Switch to Project X
2. **Verify**: Project X still shows 5 tabs (no tabs deleted)

#### Step 6: Verify Project Z Empty
1. Switch to Project Z
2. **Verify**: Project Z shows 0 tabs (or default system tabs only)

### Expected Results
- ✅ Tab counts are independent per project
- ✅ Creating tabs in one project doesn't affect other projects
- ✅ Deleting tabs in one project doesn't affect other projects
- ✅ Project tab state is maintained when switching between projects

### Failure Scenarios
- ❌ Tab count increases in Project Y when tabs are created in Project X
- ❌ Tabs from Project X appear in Project Y
- ❌ Deleting tab in Project Y removes tab from Project X

---

## Test Scenario 3: Tab Restoration After Deletion

**Objective**: Verify correct auto-selection behavior when the active tab is deleted.

### Setup
1. Open desktop app
2. Select a project with 5+ tabs
3. Active tab should be in the middle (tab #3 of 5)

### Test Steps

#### Step 1: Delete Active Tab (Middle Position)
1. Note current active tab position (e.g., tab #3: "Charlie")
2. Click X to close active tab "Charlie"
3. **Verify**: Next tab in sequence ("Delta", tab #4) becomes active
4. **Verify**: Tab count decreases by 1 (now 4 tabs)

#### Step 2: Delete Active Tab (First Position)
1. Switch to first tab ("Alpha")
2. Close "Alpha" tab
3. **Verify**: Next available tab becomes active (was "Beta", now first tab)

#### Step 3: Delete Active Tab (Last Position)
1. Switch to last tab
2. Close last tab
3. **Verify**: Previous tab becomes active (last-1)

#### Step 4: Delete Until One Tab Remains
1. Keep deleting tabs until only 1 tab remains
2. **Verify**: Cannot delete last remaining tab (delete button disabled/warning shown)

### Expected Results
- ✅ Deleting middle active tab selects next tab (to the right)
- ✅ Deleting first active tab selects next available tab
- ✅ Deleting last active tab selects previous tab
- ✅ Cannot delete last remaining tab

### Failure Scenarios
- ❌ Deleting active tab leaves no tab selected (blank state)
- ❌ Wrong tab is auto-selected after deletion
- ❌ Can delete last remaining tab (orphans the project)

---

## Test Scenario 4: Max Capacity Handling

**Objective**: Verify behavior when reaching MAX_TABS limit (10 tabs) including ability to delete and create new tabs.

### Setup
1. Open desktop app
2. Select a project with 0 tabs

### Test Steps

#### Step 1: Create Maximum Tabs
1. Create tabs until you reach MAX_TABS (10 tabs)
2. **Verify**: "New Tab" button becomes disabled OR shows warning at 10 tabs
3. Try to create an 11th tab
4. **Verify**: Warning message appears: "Maximum tabs reached (10/10)"

#### Step 2: Delete Tab at Max Capacity
1. With 10 tabs open, close any tab
2. **Verify**: Tab is successfully deleted
3. **Verify**: Tab count shows 9/10
4. **Verify**: "New Tab" button becomes enabled again

#### Step 3: Create Tab After Deletion
1. Click "New Tab" button
2. **Verify**: New tab is created successfully
3. **Verify**: Tab count returns to 10/10
4. **Verify**: "New Tab" button disabled again

#### Step 4: Switch Projects at Max Capacity
1. With Project A at 10/10 tabs, switch to Project B
2. **Verify**: Project B can create tabs independently (separate 10-tab limit)
3. Create 10 tabs in Project B
4. **Verify**: Both projects can have 10 tabs simultaneously
5. Switch back to Project A
6. **Verify**: Project A still has 10 tabs

### Expected Results
- ✅ Cannot exceed MAX_TABS (10) per project
- ✅ Can delete tabs even at max capacity
- ✅ Can create new tabs after deletion frees capacity
- ✅ Each project has independent MAX_TABS limit
- ✅ Appropriate user feedback when limit reached

### Failure Scenarios
- ❌ Can create more than 10 tabs
- ❌ Cannot delete tabs when at max capacity
- ❌ Projects share MAX_TABS limit (creating in Project A blocks Project B)
- ❌ No warning/feedback when limit is reached

---

## Test Scenario 5: System Tabs Behavior

**Objective**: Verify that system tabs (Terminal, Changes) behave correctly and cannot be closed.

### Setup
1. Open desktop app
2. Select any project

### Test Steps

#### Step 1: Verify System Tabs Present
1. Look for "Terminal" tab
2. Look for "Changes" tab
3. **Verify**: Both system tabs are always present
4. **Verify**: System tabs appear after agent tabs (to the right)

#### Step 2: Try to Close System Tabs
1. Hover over "Terminal" tab
2. **Verify**: No close button (X) appears OR close button is disabled
3. Repeat for "Changes" tab
4. **Verify**: System tabs cannot be closed

#### Step 3: Switch to System Tabs
1. Click "Terminal" tab
2. **Verify**: Terminal view is displayed
3. **Verify**: "Terminal" tab is highlighted
4. Click "Changes" tab
5. **Verify**: Changes view is displayed
6. **Verify**: "Changes" tab is highlighted

#### Step 4: Verify System Tabs Persist Across Projects
1. Switch to different project
2. **Verify**: "Terminal" and "Changes" tabs still present
3. **Verify**: System tabs are project-scoped (Terminal shows current project's terminal)

### Expected Results
- ✅ System tabs (Terminal, Changes) always present
- ✅ System tabs cannot be closed
- ✅ System tabs positioned after agent tabs
- ✅ Clicking system tabs switches view correctly
- ✅ System tabs scoped to current project

### Failure Scenarios
- ❌ System tabs can be closed
- ❌ System tabs missing in some projects
- ❌ System tab content shared across projects (not scoped)

---

## Test Scenario 6: Tab Restoration After App Crash

**Objective**: Verify tab state recovery after unexpected app termination.

### Setup
1. Open desktop app
2. Create test scenario with specific tab configuration:
   - Project A: 7 tabs, active tab = #4 ("Delta")
   - Project B: 3 tabs, active tab = #2 ("Beta")

### Test Steps

#### Step 1: Force Quit App
1. Note current state:
   - Current project: Project A
   - Active tab: "Delta" (tab #4)
2. Force quit app (kill process or Activity Monitor)
3. Do NOT use graceful shutdown (Cmd+Q)

#### Step 2: Relaunch and Verify State
1. Relaunch desktop app
2. Wait for complete initialization
3. **Verify**: Last selected project (Project A) is automatically selected
4. **Verify**: Active tab is "Delta" (tab #4) - exactly as before crash
5. **Verify**: All 7 tabs from Project A are present

#### Step 3: Verify Other Project Unchanged
1. Switch to Project B
2. **Verify**: Project B has 3 tabs
3. **Verify**: Active tab is "Beta" (tab #2)

### Expected Results
- ✅ Tab configuration survives app crash
- ✅ Active tab selection is restored correctly
- ✅ All projects maintain their tab state
- ✅ No data loss after unexpected termination

### Failure Scenarios
- ❌ Tabs are lost after crash (back to 0 tabs)
- ❌ Active tab reverts to first tab
- ❌ Some tabs missing after recovery

---

## Test Scenario 7: Auto-Select First Tab Configuration

**Objective**: Verify behavior when `autoSelectFirstTab` setting is enabled/disabled.

### Setup
1. Open desktop app
2. Navigate to Settings
3. Locate "Auto-select first tab" preference

### Test Steps

#### Part A: Auto-Select Enabled

1. **Enable** "Auto-select first tab" in settings
2. Create new project "Test Project"
3. Create first tab
4. **Verify**: First tab is automatically selected/highlighted
5. Switch to different project, then back to "Test Project"
6. **Verify**: First tab is automatically selected

#### Part B: Auto-Select Disabled

1. **Disable** "Auto-select first tab" in settings
2. Create new project "Test Project 2"
3. Create first tab
4. **Verify**: Tab exists but is NOT automatically selected
5. **Verify**: No active tab highlighting
6. Click on tab manually
7. **Verify**: Tab becomes active only after manual click

### Expected Results
- ✅ When enabled: First tab auto-selected on creation
- ✅ When disabled: No automatic tab selection
- ✅ Setting persists across app restarts
- ✅ Manual tab selection always works regardless of setting

### Failure Scenarios
- ❌ Setting has no effect (always auto-selects)
- ❌ Setting reverts after app restart

---

## Regression Testing Checklist

After any code changes to tab management, verify these don't regress:

### Core Functionality
- [ ] Can create new tabs (Cmd+T)
- [ ] Can switch between tabs (click or Cmd+1-5)
- [ ] Can close tabs (X button or Cmd+W)
- [ ] Active tab is visually highlighted
- [ ] Tab count displays correctly (N/10)

### Project Isolation
- [ ] Tabs belong to only one project
- [ ] Switching projects shows correct tabs
- [ ] No cross-project tab leakage
- [ ] Each project has independent tab limit

### Persistence
- [ ] Active tab persists across project switches
- [ ] Tab state survives app restart
- [ ] Tab configuration recovers from crash

### System Tabs
- [ ] Terminal tab always present
- [ ] Changes tab always present
- [ ] System tabs cannot be closed
- [ ] System tabs show project-specific content

### Edge Cases
- [ ] Cannot close last remaining tab
- [ ] Max tabs limit enforced (10 per project)
- [ ] Empty project shows system tabs only
- [ ] Rapid project switching doesn't corrupt state

---

## Test Data Cleanup

After manual testing, clean up test data:

```bash
# Remove test projects from config
rm -rf ~/.autosteer/config.json.backup

# Clear test session manifests
rm -rf ~/.autosteer/session_manifests/*

# Reset desktop app to clean state
# (only if needed - will lose all project data)
rm -rf ~/.autosteer/config.json
```

---

## Bug Reporting Template

If you find a bug during manual testing, use this template:

```markdown
**Bug Title**: [Concise description]

**Scenario**: [Which test scenario from above]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Screenshots/Video**:
[Attach evidence]

**Environment**:
- Desktop App Version: [version]
- OS: [macOS/Windows/Linux version]
- Project Count: [number of projects]
- Tab Count: [tabs in affected project]

**Additional Context**:
[Any other relevant information]
```

---

**Last Updated**: 2025-01-22
**Test Coverage**: 7 manual scenarios, 30+ verification points
