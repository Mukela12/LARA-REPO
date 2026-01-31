import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { requireRedis, sessionKeys, SESSION_TTL } from '../lib/redis';
import { generateTeacherToken, generateStudentToken, authenticateTeacher } from '../middleware/auth';
import { AuthenticatedRequest, StudentSessionData } from '../types';
import { emitToSessionTeacher, emitToTeacher } from '../lib/socket';

const router = Router();

// Teacher Registration (simplified for MVP - no OAuth yet)
router.post('/register', async (req, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if teacher already exists
    const existing = await prisma.teacher.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const teacher = await prisma.teacher.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword, // Proper password storage
        tier: 'classroom', // Default to classroom tier for pilot
      },
    });

    const token = generateTeacherToken(teacher.id);

    return res.json({
      token,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        tier: teacher.tier,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register' });
  }
});

// Teacher Login
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const teacher = await prisma.teacher.findUnique({ where: { email } });
    if (!teacher) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check passwordHash first (new), then schoolId (legacy) for backward compatibility
    const passwordToCheck = teacher.passwordHash || teacher.schoolId;
    if (!passwordToCheck) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, passwordToCheck);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If still using legacy schoolId, migrate to passwordHash
    if (!teacher.passwordHash && teacher.schoolId) {
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: {
          passwordHash: teacher.schoolId,
          schoolId: null, // Clear legacy field
        },
      });
    }

    const token = generateTeacherToken(teacher.id);

    return res.json({
      token,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        tier: teacher.tier,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current teacher profile
router.get('/me', authenticateTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.teacher!.id },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        aiCallsUsed: true,
        aiCallsReset: true,
        createdAt: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const { TIER_CONFIGS } = await import('../types');
    const tierConfig = TIER_CONFIGS[teacher.tier] || TIER_CONFIGS.starter;

    return res.json({
      ...teacher,
      aiCallsLimit: tierConfig.monthlyAiCalls,
      aiCallsRemaining: Math.max(0, tierConfig.monthlyAiCalls - teacher.aiCallsUsed),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Validate task code without revealing task details (Kahoot-style)
router.post('/validate-code', async (req, res: Response) => {
  try {
    const { taskCode } = req.body;

    if (!taskCode) {
      return res.status(400).json({ error: 'Task code is required' });
    }

    // Normalize the task code: uppercase and remove all hyphens/spaces
    const normalizedCode = taskCode.toUpperCase().replace(/[-\s]/g, '');

    // Find the task by code
    const task = await prisma.task.findUnique({
      where: { taskCode: normalizedCode },
      select: { id: true, title: true, status: true },
    });

    if (!task) {
      return res.status(404).json({ error: 'Invalid code. Please check and try again.' });
    }

    if (task.status !== 'active') {
      return res.status(403).json({ error: 'This task is not currently active.' });
    }

    // Return minimal info - just that the code is valid and the task title
    return res.json({
      valid: true,
      taskTitle: task.title,
    });
  } catch (error: any) {
    console.error('Validate code error:', error);
    // Check for database connection errors
    if (error?.code === 'P1001' || error?.code === 'P1002' || error?.message?.includes('ECONNRESET')) {
      return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    }
    return res.status(500).json({ error: 'Failed to validate code' });
  }
});

// Student joins via task code
router.post('/session/join', async (req, res: Response) => {
  try {
    const { taskCode, studentName } = req.body;

    if (!taskCode || !studentName) {
      return res.status(400).json({ error: 'Task code and student name are required' });
    }

    // Normalize and find the task by code
    const normalizedCode = taskCode.toUpperCase().replace(/[-\s]/g, '');
    const task = await prisma.task.findUnique({
      where: { taskCode: normalizedCode },
      include: { teacher: true },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status !== 'active') {
      return res.status(403).json({ error: 'Task is not active' });
    }

    // Find or create a live session for this task
    let session = await prisma.taskSession.findFirst({
      where: {
        taskId: task.id,
        isLive: true,
      },
    });

    if (!session) {
      // Create a new session
      session = await prisma.taskSession.create({
        data: {
          taskId: task.id,
          teacherId: task.teacherId,
          isLive: true,
          startedAt: new Date(),
          dataExpiresAt: new Date(Date.now() + SESSION_TTL * 1000), // 16 hours from now
        },
      });
    }

    // Create student ID
    const studentId = uuidv4();

    // Require Redis for live session operations (Redis is the source of truth for student data)
    const redisClient = requireRedis();

    // Write student to Redis (source of truth for student data)
    const studentData: StudentSessionData = {
      id: studentId,
      name: studentName,
      joinedAt: Date.now(),
      status: 'active',
    };

    await redisClient.hset(
      sessionKeys.students(session.id),
      studentId,
      JSON.stringify(studentData)
    );
    await redisClient.expire(sessionKeys.students(session.id), SESSION_TTL);

    // Update session counter in Postgres (analytics only)
    await prisma.taskSession.update({
      where: { id: session.id },
      data: { totalStudents: { increment: 1 } },
    });

    // If session has persistence enabled, also write to Postgres
    if (session.dataPersisted) {
      await prisma.student.create({
        data: {
          id: studentId,
          sessionId: session.id,
          name: studentName,
          status: 'active',
        },
      });
    }

    // Emit WebSocket event to notify teacher that a student joined (AFTER successful Redis write)
    // Emit to session-specific room (for teachers already viewing this session)
    emitToSessionTeacher(session.id, 'student-joined', {
      studentId,
      studentName,
      timestamp: Date.now(),
    });

    // Also emit to teacher's global notification room (for when teacher doesn't have liveSessionId yet)
    emitToTeacher(task.teacherId, 'student-joined', {
      sessionId: session.id,
      taskId: task.id,
      studentId,
      studentName,
      timestamp: Date.now(),
    });

    // Generate student token
    const token = generateStudentToken(studentId, session.id);

    return res.json({
      token,
      studentId,
      sessionId: session.id,
      task: {
        id: task.id,
        title: task.title,
        prompt: task.prompt,
        successCriteria: task.successCriteria,
      },
    });
  } catch (error) {
    console.error('Session join error:', error);
    return res.status(500).json({ error: 'Failed to join session' });
  }
});

// Student restores session by studentId (for returning students)
router.get('/session/restore/:studentId', async (req, res: Response) => {
  try {
    const studentId = req.params.studentId;

    // Find the student with their session and task info
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        session: {
          include: {
            task: true,
          },
        },
        submissions: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          include: { feedback: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const session = student.session;
    const task = session.task;
    const latestSubmission = student.submissions[0];

    // Generate a new token for this student
    const token = generateStudentToken(student.id, session.id);

    // Prepare feedback if available and released
    let feedback = null;
    let feedbackReady = false;
    if (latestSubmission?.feedbackStatus === 'released' && latestSubmission.feedback) {
      feedbackReady = true;
      feedback = {
        goal: latestSubmission.feedback.goal,
        masteryAchieved: latestSubmission.feedback.masteryAchieved,
        strengths: latestSubmission.feedback.strengths,
        growthAreas: latestSubmission.feedback.growthAreas,
        nextSteps: latestSubmission.feedback.nextSteps,
      };
    }

    return res.json({
      token,
      studentId: student.id,
      studentName: student.name,
      sessionId: session.id,
      status: student.status,
      task: {
        id: task.id,
        title: task.title,
        prompt: task.prompt,
        successCriteria: task.successCriteria,
        status: task.status,
      },
      feedbackReady,
      feedback,
      masteryConfirmed: latestSubmission?.feedback?.masteryAchieved || false,
      submission: latestSubmission ? {
        content: latestSubmission.content,
        timestamp: latestSubmission.timestamp.getTime(),
      } : null,
    });
  } catch (error) {
    console.error('Session restore error:', error);
    return res.status(500).json({ error: 'Failed to restore session' });
  }
});

export default router;
