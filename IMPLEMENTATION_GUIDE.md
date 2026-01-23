# LARA Implementation Guide

This guide documents the complete implementation status of LARA (Learning Assessment & Response Assistant) based on client requirements from Renee Yeowell and the v3 Implementation Plan.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Design Principles](#core-design-principles)
3. [Implementation Status](#implementation-status)
4. [Demo Features](#demo-features)
5. [User Flows](#user-flows)
6. [Feature Details](#feature-details)
7. [V3 Alignment Checklist](#v3-alignment-checklist)
8. [Production Roadmap](#production-roadmap)

---

## Executive Summary

### What is LARA?
LARA is a **teacher-controlled formative feedback system** that uses AI to generate personalized, actionable feedback for student work. The system is designed around Hattie & Timperley's Three Questions framework:

| Question | Purpose |
|----------|---------|
| **Where am I going?** | Clear task goal and success criteria |
| **How am I going?** | Anchored feedback on current progress |
| **Where to next?** | Specific, actionable improvement steps |

### Key Differentiators
- **Teacher-Initiated AI**: AI never runs automatically; teachers control every generation
- **Session-Based Students**: No persistent student accounts; ephemeral, privacy-respecting
- **Cost-Conscious Design**: Visible usage limits, batch preview, tier-based caps
- **Soft Validation**: Warn & log approach, not blocking (except safety issues)

---

## Core Design Principles

### 1. Teacher-Initiated AI Only
The most critical design principle: **AI feedback is never automatically triggered**.

**What this means:**
- When a student submits work, it goes to "Needs Review" status
- Teacher sees pending submissions on their dashboard
- Teacher must click "Generate Feedback" or "Generate All" to trigger AI
- Cost preview shown before batch operations

**Why:**
- Prevents runaway AI costs from mass student submissions
- Gives teachers oversight before feedback reaches students
- Ensures intentional, not accidental, AI spending

### 2. Session-Based Student Architecture
Students don't have persistent accounts.

**How it works:**
- Student enters task code (e.g., "ABC-123")
- Student enters their display name
- System creates session-scoped ID
- Data expires after task completion (24-48 hour TTL in production)

**Benefits:**
- Privacy-first: no long-term student data storage
- Simplicity: no login friction for students
- Compliance: minimal data retention

### 3. Soft Validation Strategy
Most validation issues are warnings, not blocks.

| Validation Type | Action | Example |
|-----------------|--------|---------|
| **Hard Block** | Prevent submission | Ability praise ("You're so smart") |
| **Hard Block** | Prevent submission | Peer comparison ("Better than others") |
| **Soft Warning** | Allow, show warning | Very short submission |
| **Soft Warning** | Allow, show warning | Possibly off-topic |

**Teacher sees:** All warnings in dashboard for review before generating feedback

### 4. AI Cost Management
First-class design constraint with visible limits.

**Tier Structure:**
| Tier | Monthly AI Calls | Best For |
|------|-----------------|----------|
| Starter | 200 | Single classroom trial |
| Classroom | 800 | Full classroom deployment |
| Multi-Class | 2,400 | Multiple sections/subjects |

**Cost Visibility:**
- Dashboard shows: "125 / 200 AI credits used this month"
- Before batch: "This will use 15 credits. Proceed?"
- After action: "Generated 15 feedbacks. 60 credits remaining."

---

## Implementation Status

### Current Demo (localStorage-based)

| Feature | Status | Location |
|---------|--------|----------|
| Teacher Authentication | ✅ Complete | `lib/auth.ts`, `TeacherLogin.tsx` |
| Task Creation | ✅ Complete | `CreateTaskForm.tsx` |
| Task Code Generation | ✅ Complete | `lib/taskCodes.ts` |
| Task Status (Active/Inactive) | ✅ Complete | `TaskList.tsx`, `store.ts` |
| Folder Management | ✅ Complete | `FolderManagement.tsx`, `store.ts` |
| Student Entry Flow | ✅ Complete | `StudentEntry.tsx` |
| Timer & Confetti | ✅ Complete | `StudentEntry.tsx` |
| Feedback Display | ✅ Complete | `FeedbackView.tsx` |
| Next Step Selection | ✅ Complete | `FeedbackView.tsx`, `store.ts` |
| Teacher Dashboard | ✅ Complete | `TeacherDashboard.tsx` |
| Teacher Review/Edit | ✅ Complete | `TeacherReviewView.tsx` |
| LARA Branding | ✅ Complete | All components |
| AI Integration (Mock) | ✅ Complete | `lib/feedback.ts` |

### Production Requirements (Not Yet Implemented)

| Feature | Status | Notes |
|---------|--------|-------|
| Teacher-Initiated AI | ⚠️ Demo simulates | Real: requires "Generate" button |
| Backend API | ❌ Not started | See `BACKEND_SCHEMA.md` |
| PostgreSQL Database | ❌ Not started | Teacher/Task persistence |
| Redis Sessions | ❌ Not started | Student ephemeral data |
| WebSocket Real-time | ❌ Not started | Live dashboard updates |
| Claude API Integration | ❌ Not started | Replace mock feedback |
| Usage Tracking | ❌ Not started | Tier enforcement |
| Batch Generation | ❌ Not started | Multi-student feedback |
| Soft Validation | ❌ Not started | Warn & log system |

---

## Demo Features

### Teacher Flow

#### 1. Landing Page
- Choose "Teacher Login" or "Demo Mode"
- Demo mode skips authentication for quick testing

#### 2. Teacher Login
- Email/password authentication
- Sign up for new accounts
- Data persists per teacher (localStorage keyed by teacher ID)

#### 3. Dashboard ("Sessions" Tab)
- Current task display with status (Live/Inactive)
- Task code with copy-to-clipboard
- Quick activate/deactivate toggle
- Student progress table with status badges
- "Review" button for submitted work

#### 4. All Tasks Tab
- Left sidebar: Folder management
  - Create new folders with colors
  - Filter tasks by folder
  - Edit/delete folders
- Task list with:
  - Status badge (Live/Inactive)
  - Folder indicator
  - Student count and stats
  - Context menu for:
    - Activate/Deactivate toggle
    - Move to folder

#### 5. Create Task Tab
- Title and prompt fields
- Success criteria (add multiple)
- Auto-generates unique task code on save

#### 6. Students Tab
- List view of all students
- Status and submission info
- Quick navigation to review

#### 7. Class Insights Tab
- Aggregated feedback patterns
- Common growth areas
- Completion statistics

### Student Flow

#### 1. Entry Options
- Direct: Student enters from demo landing page
- Task Code: Student receives link with `?taskCode=ABC123`

#### 2. Join with Name
- Enter display name
- See task prompt and success criteria

#### 3. Writing Phase
- Timer starts automatically
- Text area with character count
- "Submit" button with send icon

#### 4. Submission Confirmation
- Confetti animation
- Waiting message: "LARA is preparing personalized feedback for you"
- Polling for feedback ready status

#### 5. Feedback View
- Goal section (Where am I going?)
- Strengths with anchors (How am I going? - positive)
- Growth areas with anchors (How am I going? - growth)
- Next Steps with CTA buttons (Where to next?)

#### 6. Next Step Selection
- Student picks one improvement action
- Selection recorded in store
- Revision view shown

---

## User Flows

### Happy Path: Complete Session

```
Teacher                              Student
   │                                    │
   ├─→ Create Task ────────────────────→│
   │   (generates ABC-123)              │
   │                                    │
   ├─→ Share Task Code ────────────────→│
   │                                    │
   │                                    ├─→ Enter Code
   │                                    │
   │                                    ├─→ Enter Name "Alex"
   │                                    │
   │←──── [Student Joined] ─────────────┤
   │                                    │
   │                                    ├─→ Write Response
   │                                    │
   │                                    ├─→ Submit Work
   │                                    │
   │←──── [Needs Review] ───────────────┤
   │                                    │
   ├─→ Click "Review"                   │
   │                                    │
   ├─→ Review AI Feedback               │
   │   (edit if needed)                 │
   │                                    │
   ├─→ Click "Approve & Send"           │
   │                                    │
   │←──── [Feedback Ready] ─────────────┤
   │                                    │
   │                                    ├─→ View Feedback
   │                                    │
   │                                    ├─→ Select Next Step
   │                                    │
   │←──── [Student Continuing] ─────────┤
   │                                    │
   └────────────────────────────────────┘
```

### Task Management Flow

```
Teacher creates task
       │
       ▼
  Task is "Active"
  (students can join)
       │
       ├──→ Students submit work
       │
       ▼
  Teacher wants to pause
       │
       ▼
  Click "Deactivate"
       │
       ▼
  Task is "Inactive"
  (new students blocked)
       │
       ├──→ Existing students can still view feedback
       │
       ▼
  Ready to resume?
       │
       ▼
  Click "Activate"
       │
       ▼
  Task is "Active" again
```

### Folder Organization Flow

```
Teacher has many tasks
       │
       ▼
  Create folders:
  - "Term 1 Writing"
  - "Essay Practice"
  - "Archived"
       │
       ▼
  Move tasks to folders:
  - Task menu → "Move to folder" → Select folder
       │
       ▼
  Filter by folder:
  - Click folder in sidebar
  - See only tasks in that folder
       │
       ▼
  Delete folder:
  - Tasks move to "No Folder"
```

---

## Feature Details

### Task Codes
- Format: 6 characters, alphanumeric (e.g., "ABC123")
- Display format: "ABC-123" (with hyphen)
- Unique per teacher
- Used for student entry URL: `?taskCode=ABC123`

### Task Status
- **Active**: Students can join and submit
- **Inactive**: New students blocked, existing data preserved

### Folder System
- Teachers can create unlimited folders
- Each folder has: name, optional description, color
- Tasks can be in one folder or no folder
- Folders are teacher-specific

### Timer
- Starts when student enters writing phase
- Displays MM:SS format
- Stored with submission for engagement metrics

### Confetti
- Triggers on successful submission
- Brand-colored particles
- 3-second duration
- Non-intrusive celebration

### Feedback Structure
```typescript
{
  goal: string,           // Task purpose reminder
  strengths: [            // What's working
    {
      type: 'task' | 'process' | 'self_reg',
      text: string,
      anchors: string[]   // Quotes from work
    }
  ],
  growthAreas: [          // What needs improvement
    { type, text, anchors }
  ],
  nextSteps: [            // Actionable improvements
    {
      actionVerb: string,
      target: string,
      successIndicator: string,
      ctaText: string,
      actionType: 'revise' | 'improve_section' | 'reupload' | 'rehearse'
    }
  ]
}
```

---

## V3 Alignment Checklist

Based on `LARA_Implementation_Plan_v3.pdf` and `Renee_Assessment_v3_Complete.pdf`:

### MVP1 Scope Boundary

| Requirement | Demo Status | Production Notes |
|-------------|-------------|------------------|
| Teacher-initiated AI only | ⚠️ Simulated | Needs "Generate" button |
| Session-based students | ✅ Aligned | Task code entry works |
| No persistent student accounts | ✅ Aligned | localStorage per session |
| 25-student rush scenario | ⚠️ Not tested | Needs batch generation |
| Three-Question Guarantee | ✅ Aligned | Feedback structure complete |
| Soft validation (warn & log) | ❌ Not implemented | Production feature |
| Hard blocks (ability praise) | ❌ Not implemented | Production feature |
| Teacher-visible usage indicator | ❌ Not implemented | Production feature |
| Tier-ready architecture | ✅ Documented | See BACKEND_SCHEMA.md |

### Technical Requirements

| Requirement | Status |
|-------------|--------|
| React 18 with TypeScript | ✅ |
| Zustand state management | ✅ |
| Tailwind CSS styling | ✅ |
| Brand color compliance | ✅ |
| Mobile responsive | ✅ |
| WebSocket for real-time | ❌ Production |
| Claude Haiku 4.5 | ❌ Production |
| Redis for sessions | ❌ Production |
| PostgreSQL for persistence | ❌ Production |

### Branding Compliance

| Check | Status |
|-------|--------|
| "LARA" instead of "AI" in student-facing text | ✅ |
| Brand colors (no purple gradients) | ✅ |
| Professional, educator-appropriate tone | ✅ |
| No overused sparkle icons | ✅ |

---

## Production Roadmap

### Phase 1: Backend Foundation (2-3 weeks)
1. Set up NestJS project with TypeScript
2. Configure PostgreSQL with Prisma
3. Implement teacher authentication (OAuth)
4. Create task CRUD endpoints
5. Set up Redis for session storage

### Phase 2: Core Flow (2-3 weeks)
1. Student join endpoint with task code validation
2. Submission storage in Redis
3. WebSocket server for real-time updates
4. Teacher dashboard aggregation endpoint

### Phase 3: AI Integration (1-2 weeks)
1. Anthropic Claude API setup
2. Feedback generation endpoint (teacher-triggered)
3. Usage tracking and tier enforcement
4. Batch generation with preview

### Phase 4: Validation & Polish (1-2 weeks)
1. Implement soft validation (warn & log)
2. Hard block conditions (ability praise, peer comparison)
3. Error handling and edge cases
4. Performance optimization

### Phase 5: Migration (1 week)
1. Replace localStorage calls with API
2. Add authentication flow to frontend
3. Implement WebSocket subscriptions
4. Testing and QA

---

## File Reference

### Core Files
- `App.tsx` - Main application router and state management
- `types.ts` - TypeScript interfaces for all data structures
- `lib/store.ts` - Zustand store with all state actions
- `lib/auth.ts` - Authentication utilities
- `lib/taskCodes.ts` - Task code generation and validation
- `lib/feedback.ts` - Mock feedback generation

### Teacher Components
- `components/teacher/TeacherDashboard.tsx` - Main teacher view
- `components/teacher/TeacherLogin.tsx` - Login/signup form
- `components/teacher/TaskList.tsx` - Task list with actions
- `components/teacher/FolderManagement.tsx` - Folder CRUD
- `components/teacher/CreateTaskForm.tsx` - Task creation
- `components/teacher/TeacherReviewView.tsx` - Feedback review/edit
- `components/teacher/TaskSelector.tsx` - Task dropdown
- `components/teacher/StudentList.tsx` - Student table
- `components/teacher/ClassInsightsView.tsx` - Analytics

### Student Components
- `components/student/StudentEntry.tsx` - Entry, writing, submission
- `components/student/FeedbackView.tsx` - Feedback display

### Layout Components
- `components/layout/DashboardLayout.tsx` - Teacher layout wrapper
- `components/layout/Sidebar.tsx` - Navigation sidebar
- `components/layout/MobileBottomNav.tsx` - Mobile navigation

### UI Components
- `components/ui/Button.tsx` - Button component
- `components/ui/Card.tsx` - Card component

### Documentation
- `BACKEND_SCHEMA.md` - Full backend specification
- `IMPLEMENTATION_GUIDE.md` - This document

---

## Contact & Support

For questions about implementation or client requirements, refer to:
- LARA_Implementation_Plan_v3.pdf - Complete technical specification
- Renee_Assessment_v3_Complete.pdf - Client feedback on v2/v3 alignment

---

*Last Updated: January 2026*
*Version: Demo v2.1 / Spec v3.0*
