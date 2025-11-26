# Tab Management Manual Test Scenarios 

## Overview

This document provides manual test scenarios for validating tab management functionality across projects. These tests complement the automated integration tests and should be executed before release.

**Test Date**: _____________________
**Tester**: _____________________
**Environment**: _____________________
**Build Version**: _____________________

---

## Pre-Test Setup

1. **Environment**: Clean installation of autosteer
2. **Projects Required**: Create 3 test projects:
   - `project-alpha` (will have 5 agent tabs)
   - `project-beta` (will have 3 agent tabs)
   - `project-gamma` (will have max 10 agent tabs)
3. **Config File**: Delete `~/.autosteer/config.json` for clean state
4. **Session Manifests**: Clear `~/.autosteer/session_manifests/` directory

---

## Scenario 1: Delete Tab at Max Capacity

**Objective**: Verify that deleting a tab when at max capacity (10 tabs) allows creating a new tab and auto-selects the next available tab.

### Setup
1. Open `project-gamma`
2. Create 10 agent tabs (reach MAX_TABS limit)
3. Verify "New Tab" button is disabled
4. Select the 5th tab (middle tab)

### Test Steps
1. Click the "X" button on the 5th tab (active tab)
2. Observe which tab becomes active
3. Verify tab count in UI
4. Click "New Tab" button
5. Verify new tab is created
6. Count total tabs

### Expected Results
- [ ] After deletion, tab count shows 9/10
- [ ] 6th tab (previously next to deleted tab) becomes active
- [ ] "New Tab" button becomes enabled
- [ ] New tab is created successfully
- [ ] Final tab count is 10/10
- [ ] New tab is auto-selected (active)

### Actual Results
_[Fill in during testing]_

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 2: Switch Projects and Verify Tabs

**Objective**: Verify that switching between projects maintains separate tab states and the correct active tab is preserved.

### Setup
1. Open `project-alpha`
2. Create 5 agent tabs
3. Select the 3rd tab
4. Note the session name of the active tab

### Test Steps
1. Switch to `project-beta` using project selector
2. Verify tab count in `project-beta`
3. Create 3 agent tabs in `project-beta`
4. Select the 2nd tab in `project-beta`
5. Note the active tab session name
6. Switch back to `project-alpha`
7. Check which tab is active
8. Verify tab count in `project-alpha`

### Expected Results
- [ ] `project-alpha` initially has 5 tabs with 3rd tab active
- [ ] Switching to `project-beta` shows 0 tabs initially
- [ ] After creating 3 tabs in `project-beta`, count is 3/10
- [ ] 2nd tab in `project-beta` is active after selection
- [ ] Returning to `project-alpha` shows 5 tabs
- [ ] 3rd tab in `project-alpha` is still active (preserved)
- [ ] No tabs from `project-beta` appear in `project-alpha`

### Actual Results
_[Fill in during testing]_

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 3: Create New Tabs After Deletion

**Objective**: Verify that after deleting tabs, new tabs can be created and the system correctly manages capacity.

### Setup
1. Open `project-alpha` (should have 5 tabs from Scenario 2)
2. Verify current tab count

### Test Steps
1. Delete the 1st tab
2. Check tab count (should be 4/10)
3. Delete the last tab (now 4th position)
4. Check tab count (should be 3/10)
5. Click "New Tab" button
6. Verify new tab session name
7. Click "New Tab" button again
8. Verify second new tab session name
9. Check final tab count

### Expected Results
- [ ] After first deletion, count is 4/10
- [ ] After second deletion, count is 3/10
- [ ] New tabs can be created (button is enabled)
- [ ] First new tab has unique session name (e.g., "Swift River")
- [ ] Second new tab has different unique name (e.g., "Quiet Forest")
- [ ] Final count is 5/10
- [ ] All tabs are functional and selectable

### Actual Results
_[Fill in during testing]_

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 4: Verify activeTabId Persistence

**Objective**: Verify that the activeTabId is persisted to config and restored correctly across app restarts.

### Setup
1. Open `project-alpha`
2. Verify you have 5 tabs from previous tests

### Test Steps
1. Select the 4th tab
2. Note the session name of the 4th tab
3. Check the file `~/.autosteer/config.json` (in terminal or file browser)
4. Locate the `activeTabId` field for `project-alpha`
5. Verify it matches the 4th tab's ID
6. **Quit the application completely**
7. **Restart the application**
8. Open `project-alpha`
9. Check which tab is active

### Expected Results
- [ ] `config.json` contains `activeTabId` for `project-alpha`
- [ ] The ID matches the 4th tab's ID
- [ ] After restart, `project-alpha` opens with 4th tab active
- [ ] All 5 tabs are still present
- [ ] No data loss occurred

### Actual Results
_[Fill in during testing]_

**Config File Contents**:
```json
[Paste relevant section here]
```

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 5: Test Auto-Select Behavior

**Objective**: Verify that when no active tab is persisted, the system auto-selects the first tab.

### Setup
1. Manually edit `~/.autosteer/config.json`
2. Remove the `activeTabId` field for `project-beta`
3. Save the file

### Test Steps
1. Open `project-beta` (should have 3 tabs from Scenario 2)
2. Observe which tab is active
3. Verify no errors in console (View > Developer > Developer Tools)
4. Select the 3rd tab
5. Switch to `project-alpha` and back to `project-beta`
6. Verify the 3rd tab is now persisted and restored

### Expected Results
- [ ] First tab is auto-selected when opening `project-beta`
- [ ] No console errors
- [ ] Application functions normally
- [ ] After manual selection, the 3rd tab is active
- [ ] Switching projects and returning restores 3rd tab
- [ ] `config.json` now has `activeTabId` for `project-beta`

### Actual Results
_[Fill in during testing]_

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 6: Cross-Project Isolation Verification

**Objective**: Verify complete isolation between projects - tabs, agents, and state are not shared.

### Setup
1. Have all three projects with tabs:
   - `project-alpha`: 5 tabs
   - `project-beta`: 3 tabs
   - `project-gamma`: 10 tabs (max)

### Test Steps
1. Open `project-alpha`
2. Count and note session names of all tabs
3. Switch to `project-beta`
4. Count and verify session names
5. Verify none of `project-alpha`'s tabs appear
6. Switch to `project-gamma`
7. Count tabs (should be 10)
8. Delete 2 tabs in `project-gamma`
9. Switch to `project-alpha`
10. Verify tab count is still 5
11. Switch to `project-beta`
12. Verify tab count is still 3
13. Switch back to `project-gamma`
14. Verify tab count is 8 (deletions persisted)

### Expected Results
- [ ] Each project maintains its own tab count
- [ ] No session names overlap across projects
- [ ] Deletions in one project don't affect others
- [ ] `project-alpha`: Always 5 tabs
- [ ] `project-beta`: Always 3 tabs
- [ ] `project-gamma`: 8 tabs after deletions
- [ ] Active tab is independently maintained per project

### Actual Results

| Project | Expected Tabs | Actual Tabs | Session Names | Active Tab |
|---------|---------------|-------------|---------------|------------|
| alpha   | 5             |             |               |            |
| beta    | 3             |             |               |            |
| gamma   | 8             |             |               |            |

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 7: System Tabs (Terminal, Changes) Behavior

**Objective**: Verify that system tabs (Terminal, Changes) are always present and function correctly.

### Setup
1. Open any project (e.g., `project-alpha`)

### Test Steps
1. Count total tabs including system tabs
2. Identify Terminal tab (should be second-to-last)
3. Identify Changes tab (should be last)
4. Click on Terminal tab
5. Verify terminal interface loads
6. Click on Changes tab
7. Verify changes interface loads
8. Try to close Terminal tab (via X button)
9. Try to close Changes tab (via X button)
10. Create new agent tab
11. Verify system tabs remain in place

### Expected Results
- [ ] Terminal and Changes tabs always present
- [ ] System tabs appear after agent tabs
- [ ] Terminal tab shows terminal interface
- [ ] Changes tab shows git changes interface
- [ ] System tabs cannot be closed (no X button)
- [ ] System tabs persist across project switches
- [ ] Creating new agent tabs doesn't affect system tabs

### Actual Results
_[Fill in during testing]_

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 8: Rapid Switching Stress Test

**Objective**: Verify system stability when rapidly switching between projects and tabs.

### Setup
1. Have all three projects ready with multiple tabs

### Test Steps
1. Rapidly switch between projects (alpha → beta → gamma → alpha) 10 times
2. In each project, click on different tabs rapidly
3. Monitor console for errors
4. Monitor memory usage (Activity Monitor / Task Manager)
5. Verify UI remains responsive
6. Check final state of each project

### Expected Results
- [ ] No console errors during rapid switching
- [ ] UI remains responsive throughout
- [ ] Memory usage is stable (no memory leaks)
- [ ] Each project maintains correct tab state
- [ ] Active tabs are preserved correctly
- [ ] No visual glitches or frozen UI

### Actual Results

**Console Errors**: ☐ None ☐ Found (describe below)

**Memory Usage**:
- Start: _______ MB
- After test: _______ MB
- Difference: _______ MB

**UI Responsiveness**: ☐ Good ☐ Sluggish ☐ Frozen

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 9: Edge Case - Empty Project

**Objective**: Verify behavior when switching to a project with no agents/tabs.

### Setup
1. Create a new project `project-delta` with no agents

### Test Steps
1. Switch to `project-delta`
2. Observe tab UI
3. Verify only system tabs (Terminal, Changes) are present
4. Click "New Tab" button
5. Verify new tab is created
6. Switch to another project and back
7. Verify the created tab persists

### Expected Results
- [ ] Empty project shows only Terminal and Changes tabs
- [ ] Agent tab count shows 0/10
- [ ] "New Tab" button is enabled
- [ ] New tab can be created successfully
- [ ] Tab persists across project switches
- [ ] No errors or crashes

### Actual Results
_[Fill in during testing]_

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Scenario 10: Config File Corruption Recovery

**Objective**: Verify system handles corrupted config gracefully.

### Setup
1. Have multiple projects with tabs
2. Quit the application
3. Manually corrupt `~/.autosteer/config.json` (add invalid JSON)

### Test Steps
1. Start the application
2. Observe startup behavior
3. Check console for error messages
4. Try to open a project
5. Verify application creates new valid config

### Expected Results
- [ ] Application starts without crashing
- [ ] Error logged but handled gracefully
- [ ] New valid config file is created
- [ ] Projects open with default state (first tab selected)
- [ ] User can continue working normally

### Actual Results
_[Fill in during testing]_

**Status**: ☐ Pass ☐ Fail ☐ Blocked

---

## Summary

### Overall Test Results

**Total Scenarios**: 10
**Passed**: _____
**Failed**: _____
**Blocked**: _____

### Critical Issues Found

1. _[List any critical issues]_

### Non-Critical Issues Found

1. _[List any non-critical issues]_

### Recommendations

_[Any recommendations for improvement]_

---

## Sign-Off

**Tester Signature**: _____________________ **Date**: _____________________

**Reviewer Signature**: _____________________ **Date**: _____________________

---

**Notes**:
- Take screenshots for any failed scenarios
- Document exact reproduction steps for bugs
- Check console logs for warnings/errors
- Verify `~/.autosteer/config.json` after each scenario if needed
