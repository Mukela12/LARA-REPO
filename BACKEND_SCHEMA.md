# LARA Backend Architecture & Database Schema

This document outlines the backend architecture for the Learning Assessment & Response Assistant (LARA) MVP1. The system is designed around **teacher-initiated AI**, **session-based student access**, and **cost-conscious AI usage**.

## System Overview

- **Runtime:** Node.js (v20+)
- **Framework:** NestJS with TypeScript
- **Database:** PostgreSQL (v15+) for persistent teacher data
- **Session Storage:** Redis for ephemeral student session data
- **ORM:** Prisma ORM
- **Real-time:** WebSocket (Socket.io) for live teacher dashboard updates
- **AI Integration:** Anthropic Claude API (Haiku 4.5 recommended)
- **Authentication:** OAuth 2.0 (Google/Microsoft integration for schools)

---

## Core Design Principles (MVP1)

### 1. Teacher-Initiated AI Only
- AI feedback is **never automatically generated** on student submission
- Teachers must explicitly click "Generate Feedback" or "Generate All"
- Every AI call requires teacher action and shows cost preview
- Prevents runaway costs and ensures teacher oversight

### 2. Session-Based Student Architecture
- Students do NOT have persistent accounts
- Session-scoped IDs expire after task completion
- Student data is ephemeral (Redis TTL: 24-48 hours)
- Task codes are the primary entry mechanism

### 3. Soft Validation Strategy
- **Warn & Log** approach: Most validation issues show warnings but allow submission
- **Hard blocks only for**: Ability praise, peer comparisons, content safety issues
- Teacher dashboard shows validation warnings for review

### 4. AI Cost Management
- First-class design constraint
- Teacher-visible usage indicators (current/limit)
- Tier-based limits with configurable caps
- Cost preview before batch operations

---

## Tier Architecture

| Tier | Monthly AI Calls | Target Users |
|------|-----------------|--------------|
| Starter | 200 | Single classroom trial |
| Classroom | 800 | Full classroom deployment |
| Multi-Class | 2,400 | Multiple sections/subjects |

### Tier Configuration
```typescript
interface TierConfig {
  id: 'starter' | 'classroom' | 'multi_class';
  name: string;
  monthlyAiCalls: number;
  maxStudentsPerSession: number;
  batchGenerationLimit: number;
}

const TIER_CONFIGS: Record<string, TierConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyAiCalls: 200,
    maxStudentsPerSession: 35,
    batchGenerationLimit: 10
  },
  classroom: {
    id: 'classroom',
    name: 'Classroom',
    monthlyAiCalls: 800,
    maxStudentsPerSession: 35,
    batchGenerationLimit: 25
  },
  multi_class: {
    id: 'multi_class',
    name: 'Multi-Class',
    monthlyAiCalls: 2400,
    maxStudentsPerSession: 35,
    batchGenerationLimit: 35
  }
};
```

---

## Database Schema

### 1. Teacher/User Management (PostgreSQL - Persistent)
```prisma
model Teacher {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String
  schoolId      String?

  // Tier & Usage
  tier          String    @default("starter")
  aiCallsUsed   Int       @default(0)
  aiCallsReset  DateTime  @default(now()) // Monthly reset date

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  tasks         Task[]
  folders       Folder[]
  sessions      TaskSession[]

  @@index([email])
}
```

### 2. Folder Organization (PostgreSQL - Persistent)
```prisma
model Folder {
  id            String    @id @default(uuid())
  teacherId     String
  name          String
  description   String?   @db.Text
  color         String    @default("#3b82f6")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  teacher       Teacher   @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  tasks         Task[]

  @@index([teacherId])
}
```

### 3. Task Management (PostgreSQL - Persistent)
```prisma
model Task {
  id                    String    @id @default(uuid())
  teacherId             String
  title                 String
  prompt                String    @db.Text
  taskCode              String    @unique // 6-digit alphanumeric (e.g., "ABC-123")

  // Configuration
  universalExpectations Boolean   @default(true)
  successCriteria       String[]  // JSON array of criteria strings

  // Task Management
  status                String    @default("active") // "active" | "inactive"
  folderId              String?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Relations
  teacher               Teacher   @relation(fields: [teacherId], references: [id])
  folder                Folder?   @relation(fields: [folderId], references: [id], onDelete: SetNull)
  sessions              TaskSession[]

  @@index([teacherId])
  @@index([folderId])
  @@index([status])
  @@index([taskCode])
}
```

### 4. Task Session (PostgreSQL - Persistent Metadata, Redis - Live Data)
```prisma
model TaskSession {
  id            String    @id @default(uuid())
  taskId        String
  teacherId     String

  // Session State
  isLive        Boolean   @default(false)
  startedAt     DateTime?
  endedAt       DateTime?

  // Aggregated Metrics (updated periodically)
  totalStudents Int       @default(0)
  submissions   Int       @default(0)
  feedbackSent  Int       @default(0)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  task          Task      @relation(fields: [taskId], references: [id])
  teacher       Teacher   @relation(fields: [teacherId], references: [id])

  @@index([taskId])
  @@index([teacherId])
  @@index([isLive])
}
```

### 5. AI Usage Log (PostgreSQL - Audit Trail)
```prisma
model AiUsageLog {
  id            String    @id @default(uuid())
  teacherId     String
  taskId        String?
  sessionId     String?

  // Usage Details
  operation     String    // "single_feedback" | "batch_feedback" | "validation"
  studentCount  Int       @default(1)
  tokensUsed    Int?
  model         String    // "claude-haiku-4-5-20251001"

  // Validation Results
  validationWarnings String[] // Array of warning codes
  hardBlockReason   String?   // If blocked, why

  createdAt     DateTime  @default(now())

  @@index([teacherId])
  @@index([createdAt])
}
```

---

## Redis Data Structures (Ephemeral Session Data)

### Student Session Data
```typescript
// Key: session:{sessionId}:students
// Type: Hash
interface StudentSessionData {
  [studentId: string]: {
    name: string;
    joinedAt: number;
    status: 'active' | 'submitted' | 'feedback_ready' | 'revising';
    submissionId?: string;
  };
}

// Key: session:{sessionId}:submissions:{studentId}
// Type: String (JSON)
interface StudentSubmission {
  studentId: string;
  content: string;
  timestamp: number;
  timeElapsed?: number;
  revisionCount: number;
  feedback?: FeedbackSession;
  feedbackStatus: 'pending' | 'generated' | 'approved' | 'released';
  validationWarnings: string[];
}

// Key: session:{sessionId}:meta
// Type: Hash
interface SessionMeta {
  taskId: string;
  teacherId: string;
  startedAt: number;
  isLive: boolean;
}

// TTL: 24-48 hours after session ends
```

---

## API Architecture

### Authentication Endpoints

#### **POST /api/auth/login**
- OAuth callback for teacher login
- Returns JWT with teacher ID and tier info

#### **POST /api/auth/session/join**
- **Payload:** `{ taskCode: string, studentName: string }`
- **Action:** Creates ephemeral student session
- **Validation:** Checks task is active and within student limit
- **Response:** `{ sessionToken, studentId, taskPrompt, successCriteria }`

### Task Management Endpoints

#### **POST /api/tasks**
- **Payload:** `{ title, prompt, successCriteria[], universalExpectations? }`
- **Action:** Creates task with auto-generated unique task code
- **Response:** `{ taskId, taskCode, ... }`
- **Auth:** Teacher-only

#### **PATCH /api/tasks/:taskId/status**
- **Payload:** `{ status: "active" | "inactive" }`
- **Action:** Toggles task availability for students
- **Effect:** Inactive tasks return 403 to students with task code
- **Auth:** Teacher-only

#### **PATCH /api/tasks/:taskId/folder**
- **Payload:** `{ folderId: string | null }`
- **Action:** Moves task to specified folder
- **Auth:** Teacher-only

### Folder Management Endpoints

#### **POST /api/folders**
- **Payload:** `{ name, description?, color? }`
- **Response:** `{ folderId, name, color, createdAt }`
- **Auth:** Teacher-only

#### **GET /api/folders**
- **Response:** `[{ id, name, description, color, taskCount }]`
- **Auth:** Teacher-only

#### **PUT /api/folders/:folderId**
- **Payload:** `{ name?, description?, color? }`
- **Auth:** Teacher-only, owner verification

#### **DELETE /api/folders/:folderId**
- **Action:** Deletes folder, moves all tasks to null folder
- **Auth:** Teacher-only, owner verification

### Student Submission Endpoints

#### **POST /api/sessions/:sessionId/submit**
- **Payload:** `{ studentId, content, timeElapsed? }`
- **Action:** Saves submission to Redis, runs soft validation
- **Response:** `{ submissionId, status: 'submitted', validationWarnings: [] }`
- **Note:** Does NOT trigger AI - teacher must initiate

### Teacher Feedback Endpoints (AI-Triggering)

#### **POST /api/sessions/:sessionId/generate-feedback**
- **Payload:** `{ studentIds: string[] }` // Empty = all pending
- **Action:**
  1. Checks teacher's remaining AI quota
  2. Shows cost preview (studentCount * 1 credit)
  3. Generates feedback for selected students
  4. Logs AI usage
- **Response:** `{ generated: number, remaining: number, feedback: FeedbackSession[] }`
- **Auth:** Teacher-only
- **Cost:** 1 AI call per student

#### **POST /api/sessions/:sessionId/generate-feedback/preview**
- **Payload:** `{ studentIds: string[] }`
- **Action:** Returns cost preview without generating
- **Response:** `{ willGenerate: number, currentUsage: number, limit: number, afterGeneration: number }`
- **Auth:** Teacher-only

#### **PATCH /api/sessions/:sessionId/feedback/:studentId/approve**
- **Action:** Marks feedback as approved for release
- **Response:** `{ approved: true, releasedAt: timestamp }`
- **Auth:** Teacher-only

#### **PATCH /api/sessions/:sessionId/feedback/:studentId/edit**
- **Payload:** Partial FeedbackSession
- **Action:** Updates feedback before release
- **Auth:** Teacher-only

### Student Feedback Polling

#### **GET /api/sessions/:sessionId/feedback/:studentId**
- **Action:** Student polls for their feedback status
- **Response:**
  - If not ready: `{ status: 'pending' }`
  - If ready: `{ status: 'ready', feedback: FeedbackSession }`
- **Auth:** Valid student session token

### Teacher Dashboard Endpoints

#### **GET /api/sessions/:sessionId/dashboard**
- **Action:** Aggregated view of all students in session
- **Response:**
```typescript
{
  session: { taskId, startedAt, isLive },
  students: [{
    id: string,
    name: string,
    status: string,
    submittedAt?: number,
    feedbackStatus: string,
    validationWarnings: string[]
  }],
  stats: {
    total: number,
    writing: number,
    submitted: number,
    feedbackReady: number,
    revising: number
  },
  usage: {
    current: number,
    limit: number,
    remaining: number
  }
}
```
- **Auth:** Teacher-only

#### **GET /api/teacher/usage**
- **Action:** Returns current AI usage stats
- **Response:** `{ tier, monthlyLimit, used, remaining, resetDate }`
- **Auth:** Teacher-only

---

## WebSocket Events

### Teacher Dashboard (Room: `session:{sessionId}:teacher`)
```typescript
// Events emitted to teacher
'student:joined' -> { studentId, name, totalStudents }
'student:submitted' -> { studentId, timestamp, validationWarnings }
'feedback:generated' -> { studentId, feedbackId }
'feedback:approved' -> { studentId }
'student:continuing' -> { studentId, selectedNextStepId }
```

### Student (Room: `session:{sessionId}:student:{studentId}`)
```typescript
// Events emitted to student
'feedback:ready' -> { feedback: FeedbackSession }
'session:ended' -> { message: string }
```

---

## AI Processing Pipeline

### Feedback Generation Flow
1. **Teacher Trigger:** Teacher clicks "Generate Feedback" for student(s)
2. **Quota Check:** Verify teacher has remaining AI credits
3. **Soft Validation:** Check for hard-block conditions (ability praise, peer comparison)
4. **AI Call:** Send to Claude Haiku 4.5 with structured prompt
5. **Response Parsing:** Validate JSON output matches FeedbackSession schema
6. **Storage:** Save feedback to Redis under student submission
7. **Logging:** Record AI usage in PostgreSQL audit log
8. **Notification:** Emit WebSocket event to teacher dashboard

### AI Model Configuration
```typescript
const AI_CONFIG = {
  model: 'claude-haiku-4-5-20251001', // Recommended for MVP1
  maxTokens: 1500,
  temperature: 0.7,
  // Cost-optimized: ~$0.001 per feedback generation
};
```

### Validation Rules

#### Hard Blocks (Prevent Feedback Generation)
- Contains ability praise ("You're so smart", "You're talented")
- Contains peer comparisons ("Better than other students")
- Content safety issues (profanity, harmful content)

#### Soft Warnings (Allow but Log)
- Very short submissions (< 50 characters)
- Possibly off-topic content
- Missing expected elements from success criteria
- Unusual character patterns

---

## Three-Question Guarantee

Every feedback session MUST answer these questions:

| Question | Maps To | Student Outcome |
|----------|---------|-----------------|
| Where am I going? | `goal` field | Clear understanding of task purpose |
| How am I going? | `strengths` + `growthAreas` | Anchored evidence of current progress |
| Where to next? | `nextSteps` array | Actionable, specific improvement path |

### Feedback Session Schema
```typescript
interface FeedbackSession {
  goal: string;                    // "Where am I going?"
  strengths: FeedbackItem[];       // "How am I going?" (positive)
  growthAreas: FeedbackItem[];     // "How am I going?" (growth)
  nextSteps: NextStep[];           // "Where to next?"
}

interface FeedbackItem {
  id: string;
  type: 'task' | 'process' | 'self_reg';
  text: string;
  anchors?: string[];  // Direct quotes from student work
}

interface NextStep {
  id: string;
  actionVerb: string;          // e.g., "Add", "Revise", "Expand"
  target: string;              // What to improve
  successIndicator: string;    // How they'll know they succeeded
  ctaText: string;             // Button text (max 30 chars)
  actionType: 'revise' | 'improve_section' | 'reupload' | 'rehearse';
}
```

---

## Security Considerations

### Student Data Privacy
- No persistent student accounts
- Session data auto-expires (24-48 hour TTL)
- Student names are display-only, not linked to real identity
- Task codes are single-use per session

### Rate Limiting
- Student submissions: 5 per minute per session
- Teacher API calls: 100 per minute
- AI generation: Tier-based limits

### Authentication
- Teacher: OAuth 2.0 + JWT
- Student: Short-lived session tokens (valid for task duration)

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ API Pod  │   │ API Pod  │   │ API Pod  │
        └──────────┘   └──────────┘   └──────────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌──────────┐        ┌──────────┐         ┌──────────┐
   │PostgreSQL│        │  Redis   │         │ Anthropic│
   │(Teachers,│        │(Sessions,│         │  Claude  │
   │  Tasks)  │        │Ephemeral)│         │   API    │
   └──────────┘        └──────────┘         └──────────┘
```

---

## Migration from Demo (localStorage) to Production

### Phase 1: Backend Setup
1. Deploy PostgreSQL with teacher/task schema
2. Deploy Redis for session management
3. Implement API endpoints
4. Set up WebSocket server

### Phase 2: Frontend Integration
1. Replace localStorage with API calls
2. Add authentication flow
3. Implement real-time updates via WebSocket
4. Add loading states and error handling

### Phase 3: AI Integration
1. Configure Anthropic Claude API
2. Implement feedback generation endpoint
3. Add usage tracking and tier enforcement
4. Set up monitoring and alerts
