import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import redis, { sessionKeys, SESSION_TTL } from '../lib/redis';
import { generateTeacherToken, generateStudentToken, authenticateTeacher } from '../middleware/auth';
import { AuthenticatedRequest, StudentSessionData } from '../types';

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

    // For MVP, we'll store a hashed password in schoolId field (hacky but works for demo)
    const hashedPassword = await bcrypt.hash(password, 10);

    const teacher = await prisma.teacher.create({
      data: {
        email,
        name,
        schoolId: hashedPassword, // Storing hashed password here for MVP
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
    if (!teacher || !teacher.schoolId) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, teacher.schoolId);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
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

// Student joins via task code
router.post('/session/join', async (req, res: Response) => {
  try {
    const { taskCode, studentName } = req.body;

    if (!taskCode || !studentName) {
      return res.status(400).json({ error: 'Task code and student name are required' });
    }

    // Find the task by code
    const task = await prisma.task.findUnique({
      where: { taskCode: taskCode.toUpperCase().replace('-', '') },
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
        },
      });
    }

    // Create student ID
    const studentId = uuidv4();

    // Store student in Redis if available
    if (redis) {
      const studentData: StudentSessionData = {
        id: studentId,
        name: studentName,
        joinedAt: Date.now(),
        status: 'active',
      };

      await redis.hset(
        sessionKeys.students(session.id),
        studentId,
        JSON.stringify(studentData)
      );
      await redis.expire(sessionKeys.students(session.id), SESSION_TTL);

      // Update session student count
      await prisma.taskSession.update({
        where: { id: session.id },
        data: { totalStudents: { increment: 1 } },
      });
    }

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

export default router;
