# UI Manual Testing Plan - Healthcare Claims IDP System

This document provides comprehensive instructions for manually testing the Web UI functionality of the Healthcare Claims Intelligent Document Processing system.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Test Environment Setup](#2-test-environment-setup)
3. [Navigation and Layout Testing](#3-navigation-and-layout-testing)
4. [Dashboard Testing](#4-dashboard-testing)
5. [Document Upload Testing](#5-document-upload-testing)
6. [Claims List Testing](#6-claims-list-testing)
7. [Claim Detail Testing](#7-claim-detail-testing)
8. [Review Queue Testing](#8-review-queue-testing)
9. [Review Detail Testing](#9-review-detail-testing)
10. [System Health Page Testing](#10-system-health-page-testing)
11. [Real-time WebSocket Testing](#11-real-time-websocket-testing)
12. [Error Handling Testing](#12-error-handling-testing)
13. [Responsive Design Testing](#13-responsive-design-testing)
14. [Test Data](#14-test-data)
15. [Bug Reporting Template](#15-bug-reporting-template)

---

## 1. Prerequisites

### Required Software
- Node.js 18+ installed
- Modern browser (Chrome 100+, Firefox 100+, Safari 15+, Edge 100+)
- Browser Developer Tools access (F12)

### Environment Variables
Ensure the following are configured:
```bash
# Backend (.env file in root)
ANTHROPIC_API_KEY=your-claude-api-key
PORT=3000
API_KEY=dev-api-key

# Frontend (.env in src/ui/)
VITE_API_KEY=dev-api-key
```

### Test Documents
Use sample documents located in `test-data/`:
- `claim-diabetes-routine.png` - Standard claim
- `claim-high-value.png` - High-value claim
- `claim-hypertension.png` - Routine claim
- `claim-respiratory.png` - Complex claim
- `claim-urgent-cardiac.png` - Urgent priority claim

---

## 2. Test Environment Setup

### Starting the Backend Server

```bash
# From project root
npm install
npm run build
npm run start:server
# Server runs on http://localhost:3000
```

### Starting the Frontend Development Server

```bash
# From src/ui directory
cd src/ui
npm install
npm run dev
# UI runs on http://localhost:5173
```

### Verifying Setup

| Check | Expected Result |
|-------|-----------------|
| Backend health | `GET http://localhost:3000/api/health` returns `{ "status": "healthy" }` |
| Frontend loads | `http://localhost:5173` shows Dashboard |
| WebSocket connects | Green "Connected" indicator in header |

---

## 3. Navigation and Layout Testing

### TC-NAV-001: Header Layout
**Steps:**
1. Navigate to `http://localhost:5173`
2. Observe the header section

**Expected Results:**
- [ ] "Claims IDP" logo with FileText icon visible on left
- [ ] Navigation links visible: Dashboard, Upload, Review Queue, System Health
- [ ] WebSocket connection indicator (green dot + "Connected") visible on right
- [ ] Settings gear icon visible

### TC-NAV-002: Desktop Navigation
**Steps:**
1. Click each navigation link in order: Dashboard → Upload → Review Queue → System Health
2. Observe URL changes and active state

**Expected Results:**
- [ ] Dashboard: URL is `/`, link shows active state (blue border-bottom)
- [ ] Upload: URL is `/upload`, link shows active state
- [ ] Review Queue: URL is `/review`, link shows active state
- [ ] System Health: URL is `/health`, link shows active state
- [ ] Previous link loses active state when new link is clicked

### TC-NAV-003: Mobile Navigation
**Steps:**
1. Resize browser window to < 768px width (or use DevTools mobile emulation)
2. Click hamburger menu icon (three lines)
3. Click each navigation item

**Expected Results:**
- [ ] Hamburger menu icon appears on mobile
- [ ] Desktop nav links hidden on mobile
- [ ] Mobile menu expands with full navigation
- [ ] Active link shows left border highlight
- [ ] Menu closes after clicking a link
- [ ] X icon replaces hamburger when menu is open

### TC-NAV-004: Logo Click Navigation
**Steps:**
1. Navigate to `/upload`
2. Click the "Claims IDP" logo

**Expected Results:**
- [ ] User is navigated to Dashboard (`/`)

---

## 4. Dashboard Testing

### TC-DASH-001: Stats Cards Display
**Steps:**
1. Navigate to Dashboard (`/`)
2. Observe the stats cards row

**Expected Results:**
- [ ] "Total Claims" card with FileText icon shows count
- [ ] "Pending Review" card with Clock icon shows count
- [ ] "System Health" card with CheckCircle icon shows status
- [ ] "Urgent Queue" card with AlertCircle icon shows urgent count
- [ ] All cards have proper icons and styling

### TC-DASH-002: Quick Actions Panel
**Steps:**
1. On Dashboard, locate "Quick Actions" card on the right
2. Click each action link

**Expected Results:**
- [ ] "Upload New Document" link navigates to `/upload`
- [ ] "Review Queue (N)" link navigates to `/review` with count shown
- [ ] "System Health" link navigates to `/health`
- [ ] Hover states show background change

### TC-DASH-003: Recent Activity Display
**Steps:**
1. On Dashboard, locate "Recent Activity" section
2. Upload a document and observe changes

**Expected Results:**
- [ ] Empty state shows "No recent activity" when no events
- [ ] After upload, shows real-time status change events
- [ ] Events show type (status change, error, etc.)
- [ ] Events show claim ID
- [ ] Maximum of 5 recent events displayed

### TC-DASH-004: Upload Button
**Steps:**
1. On Dashboard, click "Upload Document" button in header

**Expected Results:**
- [ ] Navigates to `/upload` page
- [ ] Button shows Upload icon + "Upload Document" text

---

## 5. Document Upload Testing

### TC-UPLOAD-001: Upload Area Display
**Steps:**
1. Navigate to `/upload`
2. Observe the upload area

**Expected Results:**
- [ ] "Upload Document" heading displayed
- [ ] Dashed border upload zone visible
- [ ] Upload icon centered in zone
- [ ] "Drop your document here" text displayed
- [ ] "or click to browse" text displayed
- [ ] "Select File" button visible
- [ ] Supported formats note: "PNG, JPEG, TIFF, PDF (max 10MB)"

### TC-UPLOAD-002: Drag and Drop Upload
**Steps:**
1. Navigate to `/upload`
2. Drag a valid file (e.g., `claim-diabetes-routine.png`) over the upload area
3. Drop the file

**Expected Results:**
- [ ] Upload zone border color changes on drag enter (blue highlight)
- [ ] File is accepted on drop
- [ ] File info displayed: name and size
- [ ] X button appears to remove file
- [ ] Priority selection buttons appear

### TC-UPLOAD-003: Click to Browse Upload
**Steps:**
1. Navigate to `/upload`
2. Click "Select File" button
3. Select a valid file from file picker

**Expected Results:**
- [ ] Native file picker opens
- [ ] After selection, file info displayed
- [ ] Priority selection and submit buttons appear

### TC-UPLOAD-004: File Validation - Invalid Type
**Steps:**
1. Navigate to `/upload`
2. Attempt to upload an invalid file type (e.g., `.txt`, `.doc`)

**Expected Results:**
- [ ] Error message displayed: "Invalid file type. Please upload PNG, JPEG, TIFF, or PDF files."
- [ ] Error message has red styling with AlertCircle icon
- [ ] File is not accepted

### TC-UPLOAD-005: File Validation - File Too Large
**Steps:**
1. Navigate to `/upload`
2. Attempt to upload a file larger than 10MB

**Expected Results:**
- [ ] Error message displayed: "File too large. Maximum size is 10MB."
- [ ] Error message has red styling
- [ ] File is not accepted

### TC-UPLOAD-006: Priority Selection
**Steps:**
1. Navigate to `/upload`
2. Upload a valid file
3. Click each priority button: Normal, High, Urgent

**Expected Results:**
- [ ] Default priority is "Normal"
- [ ] Clicking "Normal" shows blue styling
- [ ] Clicking "High" shows orange styling
- [ ] Clicking "Urgent" shows red styling
- [ ] Only one priority selected at a time

### TC-UPLOAD-007: Submit Upload
**Steps:**
1. Navigate to `/upload`
2. Upload a valid file
3. Select priority "Normal"
4. Click "Upload & Process"

**Expected Results:**
- [ ] Button shows loading spinner with "Processing..."
- [ ] Button is disabled during upload
- [ ] Success message "Document uploaded successfully!" appears
- [ ] User is redirected to claim detail page (`/claims/:id`)

### TC-UPLOAD-008: Cancel Upload
**Steps:**
1. Navigate to `/upload`
2. Upload a valid file
3. Click "Cancel" button

**Expected Results:**
- [ ] Selected file is removed
- [ ] Upload area returns to initial state
- [ ] Any error messages are cleared

### TC-UPLOAD-009: Remove Selected File
**Steps:**
1. Navigate to `/upload`
2. Upload a valid file
3. Click X button next to file name

**Expected Results:**
- [ ] File is removed
- [ ] Upload area returns to initial state

---

## 6. Claims List Testing

### TC-CLAIMS-001: Claims List Display
**Steps:**
1. Navigate to Dashboard
2. Locate "Claims" section

**Expected Results:**
- [ ] "Claims" heading with total count in parentheses
- [ ] Refresh button visible
- [ ] Filters button visible
- [ ] Table with columns: Claim ID, Status, Priority, Created, Progress

### TC-CLAIMS-002: Empty State
**Steps:**
1. Ensure no claims exist in system
2. Navigate to Dashboard

**Expected Results:**
- [ ] Search icon displayed
- [ ] "No claims found" message
- [ ] "Upload Document" button visible

### TC-CLAIMS-003: Claims Table Data
**Steps:**
1. Upload at least one claim
2. Navigate to Dashboard

**Expected Results:**
- [ ] Claim ID displayed as clickable link
- [ ] Status badge with appropriate color
- [ ] Priority badge (Normal=gray, High=orange, Urgent=red)
- [ ] Created time shown as relative time (e.g., "2 minutes ago")
- [ ] Progress dots show extraction/validation/adjudication status

### TC-CLAIMS-004: Refresh Button
**Steps:**
1. On Dashboard claims list
2. Click Refresh button

**Expected Results:**
- [ ] Button shows spinning animation during refresh
- [ ] Button is disabled during refresh
- [ ] Claims list updates with latest data

### TC-CLAIMS-005: Filter Panel Toggle
**Steps:**
1. On Dashboard claims list
2. Click Filters button

**Expected Results:**
- [ ] Filter panel expands below header
- [ ] Status dropdown visible with options: All, Received, Parsing, Extracting, etc.
- [ ] Priority dropdown visible with options: All, Urgent, High, Normal
- [ ] "Clear filters" link visible
- [ ] Button shows active state when filters open

### TC-CLAIMS-006: Status Filtering
**Steps:**
1. Open filter panel
2. Select "Completed" from Status dropdown

**Expected Results:**
- [ ] Claims list shows only completed claims
- [ ] Page resets to 1
- [ ] Total count updates

### TC-CLAIMS-007: Priority Filtering
**Steps:**
1. Open filter panel
2. Select "Urgent" from Priority dropdown

**Expected Results:**
- [ ] Claims list shows only urgent priority claims
- [ ] Page resets to 1

### TC-CLAIMS-008: Clear Filters
**Steps:**
1. Apply status and priority filters
2. Click "Clear filters" link

**Expected Results:**
- [ ] All filters reset to default
- [ ] Claims list shows all claims
- [ ] Page resets to 1

### TC-CLAIMS-009: Pagination
**Steps:**
1. Create 15+ claims
2. Navigate to Dashboard

**Expected Results:**
- [ ] Page count shown (e.g., "Showing page 1 of 2")
- [ ] Previous/Next buttons visible
- [ ] Previous disabled on page 1
- [ ] Next enabled when more pages exist
- [ ] Clicking Next shows page 2
- [ ] Next disabled on last page

### TC-CLAIMS-010: Claim Link Navigation
**Steps:**
1. Click on any Claim ID in the list

**Expected Results:**
- [ ] Navigates to `/claims/:id`
- [ ] Claim detail page loads

---

## 7. Claim Detail Testing

### TC-DETAIL-001: Header Display
**Steps:**
1. Navigate to a claim detail page (`/claims/:id`)
2. Observe header section

**Expected Results:**
- [ ] Back arrow button visible on left
- [ ] Claim ID displayed as heading
- [ ] Creation time shown (relative time)
- [ ] Status badge on right
- [ ] Priority badge on right

### TC-DETAIL-002: Back Navigation
**Steps:**
1. On claim detail page
2. Click back arrow button

**Expected Results:**
- [ ] Navigates back to Dashboard (`/`)

### TC-DETAIL-003: Claim Overview Card
**Steps:**
1. On claim detail page
2. Observe "Claim Overview" card

**Expected Results:**
- [ ] Document ID displayed
- [ ] Status with badge
- [ ] Priority with badge
- [ ] Created date/time
- [ ] Updated date/time

### TC-DETAIL-004: Processing History Card
**Steps:**
1. On claim detail page
2. Observe "Processing History" card

**Expected Results:**
- [ ] Each processing stage listed with icon
- [ ] Green checkmark for completed stages
- [ ] Yellow clock for in-progress stages
- [ ] Red alert for failed stages
- [ ] Timestamp for each stage
- [ ] Error message displayed for failed stages

### TC-DETAIL-005: Extracted Data Card
**Steps:**
1. Navigate to a completed claim
2. Observe "Extracted Data" card

**Expected Results:**
- [ ] Overall confidence score indicator
- [ ] Patient Information section:
  - [ ] Name (First Last)
  - [ ] DOB
  - [ ] Member ID
- [ ] Provider Information section:
  - [ ] Name
  - [ ] NPI

### TC-DETAIL-006: Service Lines Table
**Steps:**
1. Navigate to a completed claim with service lines
2. Scroll to service lines section

**Expected Results:**
- [ ] Table with columns: #, Date, Code, Description, Amount
- [ ] Each service line displays correct data
- [ ] Footer shows total charges
- [ ] Amounts formatted as currency (e.g., $150.00)

### TC-DETAIL-007: Validation Results Card
**Steps:**
1. Navigate to a claim with validation errors/warnings
2. Observe "Validation Results" card

**Expected Results:**
- [ ] Valid/Invalid status badge
- [ ] Error/warning count summary
- [ ] Errors section (red background):
  - [ ] Field name
  - [ ] Error message
- [ ] Warnings section (yellow background):
  - [ ] Field name
  - [ ] Warning message

### TC-DETAIL-008: Adjudication Decision Card
**Steps:**
1. Navigate to an adjudicated claim
2. Observe "Adjudication Decision" card

**Expected Results:**
- [ ] Decision badge (Approved=green, Denied=red, Partial=yellow)
- [ ] Approved amount in green
- [ ] Denied amount in red
- [ ] Reasoning section with explanation

### TC-DETAIL-009: Claim Not Found
**Steps:**
1. Navigate to a non-existent claim: `/claims/invalid-id-xyz`

**Expected Results:**
- [ ] "Claim not found" error message in red
- [ ] "Back to Dashboard" button visible
- [ ] Button navigates to `/`

### TC-DETAIL-010: Loading State
**Steps:**
1. Navigate to a claim detail page (slow network simulation)

**Expected Results:**
- [ ] Loading spinner visible
- [ ] "Loading claim..." text displayed

---

## 8. Review Queue Testing

### TC-REVIEW-001: Review Queue Header
**Steps:**
1. Navigate to `/review`
2. Observe header

**Expected Results:**
- [ ] "Review Queue" heading
- [ ] "Claims pending human review" subtitle
- [ ] Refresh button visible

### TC-REVIEW-002: Stats Cards Display
**Steps:**
1. Navigate to `/review`
2. Observe stats cards

**Expected Results:**
- [ ] "Pending Review" card with count
- [ ] "Urgent" card with urgent count
- [ ] "Avg Wait Time" card with time in minutes
- [ ] "Avg Confidence" card with percentage

### TC-REVIEW-003: Empty Queue State
**Steps:**
1. Ensure no claims pending review
2. Navigate to `/review`

**Expected Results:**
- [ ] Green checkmark icon
- [ ] "No claims pending review" message
- [ ] "All caught up! Check back later." subtitle

### TC-REVIEW-004: Queue Table Display
**Steps:**
1. Create claims that require review (low confidence)
2. Navigate to `/review`

**Expected Results:**
- [ ] Table columns: Claim ID, Patient, Priority, Waiting, Issues, Confidence, Actions
- [ ] Claim ID with document type subtitle
- [ ] Patient name with total charges
- [ ] Priority badge
- [ ] Waiting time (relative)
- [ ] Issue badges (errors in red, warnings in yellow)
- [ ] Confidence percentage indicator
- [ ] "Review" button in Actions column

### TC-REVIEW-005: Review Button Navigation
**Steps:**
1. In review queue, click "Review" button for a claim

**Expected Results:**
- [ ] Navigates to `/review/:claimId`
- [ ] Review detail page loads

### TC-REVIEW-006: Refresh Button
**Steps:**
1. On review queue
2. Click Refresh button

**Expected Results:**
- [ ] Spinning animation during refresh
- [ ] Data updates with latest queue items

### TC-REVIEW-007: Queue Pagination
**Steps:**
1. Create 15+ claims pending review
2. Navigate to `/review`

**Expected Results:**
- [ ] Page info shown (e.g., "Page 1 of 2")
- [ ] Previous/Next buttons functional
- [ ] Page updates correctly

---

## 9. Review Detail Testing

### TC-REVDET-001: Header Display
**Steps:**
1. Navigate to `/review/:id`
2. Observe header

**Expected Results:**
- [ ] Back arrow navigates to `/review`
- [ ] "Review: [Claim ID]" heading
- [ ] Creation timestamp
- [ ] Priority badge

### TC-REVDET-002: Extracted Data Display
**Steps:**
1. On review detail page
2. Observe extracted data section

**Expected Results:**
- [ ] Overall confidence indicator
- [ ] Patient card with Name, DOB, Member ID
- [ ] Provider card with Name, NPI
- [ ] Service lines table with totals

### TC-REVDET-003: Validation Issues Display
**Steps:**
1. On review detail for claim with validation issues

**Expected Results:**
- [ ] "Validation Issues" heading
- [ ] Errors section with red AlertCircle icon
- [ ] Error count shown (e.g., "Errors (3)")
- [ ] Each error shows field and message
- [ ] Warnings section with yellow AlertTriangle icon
- [ ] Warning count shown

### TC-REVDET-004: Approve Action
**Steps:**
1. On review detail page
2. Click "Approve Claim" button

**Expected Results:**
- [ ] Button has green styling with CheckCircle icon
- [ ] Confirmation dialog appears
- [ ] Dialog title: "Confirm Approval"
- [ ] Reason textarea available (optional)
- [ ] Cancel and Confirm buttons visible

### TC-REVDET-005: Reject Action
**Steps:**
1. On review detail page
2. Click "Reject Claim" button

**Expected Results:**
- [ ] Button has red styling with XCircle icon
- [ ] Confirmation dialog appears
- [ ] Dialog title: "Confirm Rejection"
- [ ] Reason textarea available

### TC-REVDET-006: Request Correction Action
**Steps:**
1. On review detail page
2. Click "Request Correction" button

**Expected Results:**
- [ ] Button has blue styling with Edit icon
- [ ] Confirmation dialog appears
- [ ] Dialog title: "Confirm Correction Request"
- [ ] Reason textarea available

### TC-REVDET-007: Submit Review with Reason
**Steps:**
1. Click any review action button
2. Enter a reason in textarea
3. Click "Confirm"

**Expected Results:**
- [ ] Button shows "Submitting..."
- [ ] Button is disabled during submission
- [ ] On success, navigates to `/review`
- [ ] Claim removed from review queue

### TC-REVDET-008: Cancel Review Dialog
**Steps:**
1. Open review confirmation dialog
2. Click "Cancel" button

**Expected Results:**
- [ ] Dialog closes
- [ ] No action taken
- [ ] Reason text cleared

### TC-REVDET-009: Confidence Scores Display
**Steps:**
1. On review detail page
2. Observe "Confidence Scores" card

**Expected Results:**
- [ ] Overall score with indicator
- [ ] Patient score
- [ ] Provider score
- [ ] Services score
- [ ] Scores color-coded (green ≥90%, yellow ≥70%, red <70%)

### TC-REVDET-010: Review Submission Error
**Steps:**
1. Simulate API error (disconnect backend)
2. Attempt to submit review

**Expected Results:**
- [ ] Error message displayed in red
- [ ] User remains on page
- [ ] Can retry submission

### TC-REVDET-011: Claim Not Found or Not Pending
**Steps:**
1. Navigate to `/review/completed-claim-id`

**Expected Results:**
- [ ] Error message: "Claim not found or not pending review"
- [ ] "Back to Review Queue" button visible

---

## 10. System Health Page Testing

### TC-HEALTH-001: Page Header
**Steps:**
1. Navigate to `/health`

**Expected Results:**
- [ ] "System Health" heading
- [ ] "Monitor system status and performance" subtitle
- [ ] Refresh button visible

### TC-HEALTH-002: Overall Status Banner
**Steps:**
1. Navigate to `/health` with healthy system

**Expected Results:**
- [ ] Green background when healthy
- [ ] Green CheckCircle icon
- [ ] "System healthy" text in green
- [ ] Last checked timestamp

### TC-HEALTH-003: Unhealthy Status Banner
**Steps:**
1. Simulate unhealthy service
2. Navigate to `/health`

**Expected Results:**
- [ ] Red background when unhealthy
- [ ] Red AlertCircle icon
- [ ] Status text in red

### TC-HEALTH-004: Stats Cards
**Steps:**
1. Navigate to `/health`
2. Observe stats cards

**Expected Results:**
- [ ] Uptime card with Server icon (format: Xh Ym)
- [ ] Memory Used card with Cpu icon (in MB)
- [ ] Memory Total card with HardDrive icon (in MB)
- [ ] Memory % card with Activity icon (percentage)

### TC-HEALTH-005: Component Status
**Steps:**
1. Navigate to `/health`
2. Observe "Component Status" section

**Expected Results:**
- [ ] Each component has status card
- [ ] Healthy components show green styling
- [ ] Component name capitalized and spaced
- [ ] Additional metrics shown per component

### TC-HEALTH-006: API Information
**Steps:**
1. Navigate to `/health`
2. Observe "API Information" section

**Expected Results:**
- [ ] API Base URL: `/api`
- [ ] WebSocket: `/socket.io`
- [ ] Health Endpoint: `/api/health`
- [ ] Detailed Health: `/api/health/detailed`

### TC-HEALTH-007: Refresh Button
**Steps:**
1. On health page
2. Click Refresh button

**Expected Results:**
- [ ] Button shows spinning animation
- [ ] Health data refreshes
- [ ] Timestamp updates

### TC-HEALTH-008: Error State
**Steps:**
1. Stop backend server
2. Navigate to `/health`

**Expected Results:**
- [ ] Red AlertCircle icon
- [ ] "Error loading health status" message
- [ ] Error details shown
- [ ] "Retry" button visible and functional

---

## 11. Real-time WebSocket Testing

### TC-WS-001: Connection Indicator
**Steps:**
1. Open application
2. Observe connection indicator in header

**Expected Results:**
- [ ] Green dot when connected
- [ ] "Connected" text shown
- [ ] Red dot when disconnected
- [ ] "Disconnected" text when not connected

### TC-WS-002: Real-time Status Updates
**Steps:**
1. Open two browser tabs
2. Tab 1: Stay on Dashboard
3. Tab 2: Upload a new document

**Expected Results:**
- [ ] Tab 1 shows real-time claim in list
- [ ] Status changes update without refresh
- [ ] Recent Activity shows new events

### TC-WS-003: Claim Subscription
**Steps:**
1. Open claim detail page
2. In another tab/tool, trigger status change for that claim

**Expected Results:**
- [ ] Detail page updates in real-time
- [ ] Processing history updates
- [ ] Status badge updates

### TC-WS-004: Reconnection Behavior
**Steps:**
1. Connect to application
2. Temporarily stop WebSocket server
3. Restart WebSocket server

**Expected Results:**
- [ ] Indicator shows "Disconnected" when down
- [ ] Automatically reconnects when available
- [ ] Indicator returns to "Connected"

---

## 12. Error Handling Testing

### TC-ERR-001: Network Error on Claims Load
**Steps:**
1. Disconnect network or stop API
2. Navigate to Dashboard

**Expected Results:**
- [ ] Error message displayed
- [ ] "Retry" button visible
- [ ] Clicking Retry attempts reload

### TC-ERR-002: Upload API Error
**Steps:**
1. Navigate to Upload
2. Upload file with API disconnected

**Expected Results:**
- [ ] Error message below upload area
- [ ] Red styling with AlertCircle icon
- [ ] User can try again

### TC-ERR-003: 404 Claim Not Found
**Steps:**
1. Navigate to `/claims/non-existent-id`

**Expected Results:**
- [ ] "Claim not found" message
- [ ] Back to Dashboard button

### TC-ERR-004: Review Submission Failure
**Steps:**
1. Open review detail
2. Disconnect API
3. Try to submit review

**Expected Results:**
- [ ] Error message in confirmation dialog
- [ ] Dialog remains open
- [ ] Can retry after reconnecting

### TC-ERR-005: Health Check Failure
**Steps:**
1. Stop backend
2. Navigate to `/health`

**Expected Results:**
- [ ] Error state displayed
- [ ] Error message shown
- [ ] Retry button functional

---

## 13. Responsive Design Testing

### TC-RESP-001: Mobile Layout (< 768px)
**Steps:**
1. Set viewport to 375x667 (iPhone SE)
2. Test all pages

**Expected Results:**
- [ ] Header collapses to hamburger menu
- [ ] Stats cards stack vertically
- [ ] Tables scroll horizontally
- [ ] Forms are full width
- [ ] Buttons remain accessible

### TC-RESP-002: Tablet Layout (768px - 1024px)
**Steps:**
1. Set viewport to 768x1024 (iPad)
2. Test all pages

**Expected Results:**
- [ ] Header navigation visible
- [ ] 2-column grid layouts
- [ ] Cards resize appropriately

### TC-RESP-003: Desktop Layout (> 1024px)
**Steps:**
1. Set viewport to 1920x1080
2. Test all pages

**Expected Results:**
- [ ] Full navigation visible
- [ ] 3-4 column grids
- [ ] Maximum content width maintained

### TC-RESP-004: Touch Interactions
**Steps:**
1. Use touch device or emulation
2. Test all interactive elements

**Expected Results:**
- [ ] Buttons have adequate touch targets (44x44px min)
- [ ] Hover states work on touch
- [ ] Drag and drop works for upload

---

## 14. Test Data

### Sample Claims for Testing

| File | Type | Expected Priority | Expected Issues |
|------|------|------------------|-----------------|
| `claim-diabetes-routine.png` | CMS-1500 | Normal | None |
| `claim-high-value.png` | CMS-1500 | High | May need review |
| `claim-hypertension.png` | CMS-1500 | Normal | None |
| `claim-respiratory.png` | CMS-1500 | Normal | Possible validation warnings |
| `claim-urgent-cardiac.png` | CMS-1500 | Urgent | May need review |

### Creating Test Scenarios

**High Confidence Claim (Auto-approved):**
- Upload `claim-diabetes-routine.png` with Normal priority
- Should process automatically without review

**Low Confidence Claim (Needs Review):**
- Upload document with poor image quality or handwritten fields
- Should route to review queue

**Urgent Priority:**
- Upload `claim-urgent-cardiac.png` with Urgent priority
- Should appear with red Urgent badge

---

## 15. Bug Reporting Template

When reporting bugs found during testing, use this template:

```markdown
## Bug Report

**Test Case ID:** TC-XXX-NNN
**Date:** YYYY-MM-DD
**Tester:** Name
**Browser/Version:** Chrome 120 / Firefox 121 / etc.

### Summary
Brief description of the issue

### Steps to Reproduce
1. Step one
2. Step two
3. Step three

### Expected Result
What should happen

### Actual Result
What actually happened

### Screenshots/Videos
Attach any relevant media

### Console Errors
Paste any browser console errors

### Severity
- [ ] Critical - Blocks functionality
- [ ] High - Major feature broken
- [ ] Medium - Feature works with issues
- [ ] Low - Minor cosmetic issue

### Environment
- OS: Windows 11 / macOS 14 / Linux
- Screen resolution: 1920x1080
- Network: Online / Offline
```

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backend server running on port 3000
- [ ] Frontend dev server running on port 5173
- [ ] API key configured
- [ ] Test data files available
- [ ] Browser DevTools ready

### Test Execution Order
1. [ ] Navigation and Layout (TC-NAV-*)
2. [ ] Dashboard (TC-DASH-*)
3. [ ] Document Upload (TC-UPLOAD-*)
4. [ ] Claims List (TC-CLAIMS-*)
5. [ ] Claim Detail (TC-DETAIL-*)
6. [ ] Review Queue (TC-REVIEW-*)
7. [ ] Review Detail (TC-REVDET-*)
8. [ ] System Health (TC-HEALTH-*)
9. [ ] WebSocket (TC-WS-*)
10. [ ] Error Handling (TC-ERR-*)
11. [ ] Responsive Design (TC-RESP-*)

### Post-Test Activities
- [ ] Document all bugs found
- [ ] Take screenshots of issues
- [ ] Record any performance concerns
- [ ] Note accessibility issues
- [ ] Update test results spreadsheet

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-15 | Claude | Initial test plan creation |
