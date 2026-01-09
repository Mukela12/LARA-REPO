# LARA Backend Architecture & Database Schema

This document outlines the planned backend architecture for the Learning Assessment & Response Assistant (LARA). The system is designed to be scalable, secure, and supportive of real-time formative feedback loops.

## System Overview

- **Runtime:** Node.js (v20+)
- **Framework:** NestJS or Express with TypeScript
- **Database:** PostgreSQL (v15+)
- **ORM:** Prisma ORM
- **Real-time:** Socket.io (for live teacher dashboard updates)
- **AI Integration:** Google Gemini API (via Google GenAI SDK)
- **Authentication:** OAuth 2.0 (Google/Microsoft integration for schools)

---

## Database Schema (ERD Draft)

The schema focuses on the relationship between **Tasks**, **Students**, and the **Feedback Loop**.

### 1. User Management
```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  role          UserRole  @default(STUDENT) // TEACHER, STUDENT, ADMIN
  firstName     String
  lastName      String
  schoolId      String
  createdAt     DateTime  @default(now())
  
  // Relations
  classes       Class[]
  submissions   Submission[]
}

enum UserRole {
  STUDENT
  TEACHER
  ADMIN
}
```

### 2. Classroom & Tasks
```prisma
model Class {
  id            String    @id @default(uuid())
  name          String
  teacherId     String
  joinCode      String    @unique

  // Relations
  teacher       User      @relation(fields: [teacherId], references: [id])
  students      User[]    // Many-to-many managed via join table
  tasks         Task[]
}

model Folder {
  id            String    @id @default(uuid())
  userId        String    // Teacher who owns the folder
  name          String
  description   String?   @db.Text
  color         String    @default("#3b82f6")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks         Task[]

  @@index([userId])
}

model Task {
  id            String    @id @default(uuid())
  classId       String
  title         String
  prompt        String    @db.Text
  taskCode      String?   @unique // 6-digit alphanumeric code for student access

  // Configuration
  universalExpectations Boolean @default(true)
  successCriteria       String[] // JSON array of criteria strings

  // Task Management (NEW)
  status        String    @default("active") // "active" | "inactive"
  folderId      String?   // Link to folder for organization

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  class         Class     @relation(fields: [classId], references: [id])
  folder        Folder?   @relation(fields: [folderId], references: [id], onDelete: SetNull)
  submissions   Submission[]

  @@index([classId])
  @@index([folderId])
  @@index([status])
  @@index([taskCode])
}
```

### 3. Submission & Feedback Loop (The Core)
```prisma
model Submission {
  id            String    @id @default(uuid())
  taskId        String
  studentId     String
  content       String    @db.Text
  version       Int       @default(1)
  status        Status    @default(SUBMITTED)

  // Student Engagement Metrics (NEW)
  timeElapsed   Int?      // Time spent in seconds
  revisionCount Int       @default(0) // Number of revisions made

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  task          Task      @relation(fields: [taskId], references: [id])
  student       User      @relation(fields: [studentId], references: [id])
  feedback      FeedbackSession?

  @@index([taskId])
  @@index([studentId])
}

enum Status {
  DRAFT
  SUBMITTED
  PROCESSING
  FEEDBACK_READY
  REVISING
  COMPLETED
}
```

### 4. Feedback Structure
```prisma
model FeedbackSession {
  id            String    @id @default(uuid())
  submissionId  String    @unique

  // The 'Goal' context for this specific feedback
  goalText      String

  // Student Selection Tracking (NEW)
  selectedNextStepId  String?   // Track which next step student selected

  published     Boolean   @default(false)  // Teacher approval status
  publishedAt   DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  submission    Submission @relation(fields: [submissionId], references: [id])
  strengths     FeedbackItem[]
  growthAreas   FeedbackItem[]
  nextSteps     NextStep[]

  @@index([submissionId])
}

model FeedbackItem {
  id                String        @id @default(uuid())
  sessionId         String
  category          Category      // STRENGTH or GROWTH
  type              FeedbackType  // TASK, PROCESS, SELF_REG
  text              String
  anchors           String[]      // Text quotes from submission
  
  // Relations
  session           FeedbackSession @relation(fields: [sessionId], references: [id])
}

model NextStep {
  id                String    @id @default(uuid())
  sessionId         String
  
  actionVerb        String
  target            String
  successIndicator  String
  ctaText           String
  actionType        ActionType
  
  selectedAt        DateTime? // If null, not selected by student
  completedAt       DateTime?
  
  // Relations
  session           FeedbackSession @relation(fields: [sessionId], references: [id])
}

enum Category {
  STRENGTH
  GROWTH
}

enum FeedbackType {
  TASK
  PROCESS
  SELF_REG
}

enum ActionType {
  REVISE
  IMPROVE_SECTION
  REUPLOAD
  REHEARSE
}
```

---

## API Architecture

### Key Endpoints

#### **POST /api/submissions**
- **Payload:** `{ taskId, content, timeElapsed? }`
- **Action:** Saves student text with engagement metrics, triggers async AI processing job via Redis/BullMQ.
- **Response:** `{ submissionId, status: 'PROCESSING' }`

#### **GET /api/submissions/:id/feedback**
- **Action:** Polling endpoint or WebSocket subscription.
- **Response:** Full `FeedbackSession` object once AI processing is complete.

#### **PATCH /api/feedback/select-step**
- **Payload:** `{ sessionId, nextStepId }`
- **Action:** Locks in the student's choice, updates teacher dashboard in real-time.
- **Response:** `{ success: true }`

#### **GET /api/teacher/dashboard/:taskId**
- **Action:** Aggregates all student statuses and next step selections for visualization.
- **Optimization:** Uses materialized views or cached counters for high-performance class insights.

### NEW: Folder Management Endpoints

#### **POST /api/folders**
- **Payload:** `{ name, description?, color? }`
- **Action:** Creates a new folder for task organization.
- **Response:** `{ folderId, name, color, createdAt }`
- **Auth:** Teacher-only

#### **GET /api/folders**
- **Action:** Lists all folders for the authenticated teacher.
- **Response:** `[{ id, name, description, color, taskCount }]`
- **Auth:** Teacher-only

#### **PUT /api/folders/:folderId**
- **Payload:** `{ name?, description?, color? }`
- **Action:** Updates folder properties.
- **Response:** Updated folder object
- **Auth:** Teacher-only, owner verification

#### **DELETE /api/folders/:folderId**
- **Action:** Deletes folder, moves all tasks to null folder.
- **Response:** `{ success: true, tasksAffected: number }`
- **Auth:** Teacher-only, owner verification

### NEW: Task Management Endpoints

#### **PATCH /api/tasks/:taskId/status**
- **Payload:** `{ status: "active" | "inactive" }`
- **Action:** Toggles task availability for students.
- **Response:** Updated task object
- **Auth:** Teacher-only
- **Effect:** Inactive tasks return 403 to students with task code

#### **PATCH /api/tasks/:taskId/move**
- **Payload:** `{ folderId: string | null }`
- **Action:** Moves task to specified folder.
- **Response:** Updated task object
- **Auth:** Teacher-only

---

## AI Processing Pipeline

1.  **Ingestion:** Student submits text.
2.  **Queue:** Job added to 'feedback-generation' queue.
3.  **Worker:**
    *   Fetches Task Context (Success Criteria).
    *   Calls Google Gemini Pro 1.5.
    *   **System Prompt:** Structured to output JSON adhering to `FeedbackSession` schema.
    *   **Validation:** Zod schema validation on AI output.
4.  **Storage:** Parsed JSON stored in PostgreSQL.
5.  **Notification:** Webhook/Socket event sent to client.
