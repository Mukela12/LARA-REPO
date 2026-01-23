import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import redis, { sessionKeys, SESSION_TTL } from '../lib/redis';
import { authenticateTeacher, authenticateStudent } from '../middleware/auth';
import { generateFeedback, logAiUsage, checkTeacherQuota } from '../services/feedback';
import { AuthenticatedRequest, StudentSessionData, StudentSubmission } from '../types';

const router = Router();

// Get session dashboard (teacher)
router.get('/:sessionId/dashboard', authenticateTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await prisma.taskSession.findFirst({
      where: {
        id: sessionId,
        teacherId: req.teacher!.id,
      },
      include: {
        task: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Try Redis first (real-time cache), fall back to Postgres (source of truth)
    let students: (StudentSessionData & { submission?: StudentSubmission })[] = [];
    let dataSource: 'redis' | 'postgres' = 'redis';

    if (redis) {
      const studentData = await redis.hgetall(sessionKeys.students(session.id));

      if (Object.keys(studentData).length > 0) {
        // Redis has data - use it for real-time view
        for (const [studentId, data] of Object.entries(studentData)) {
          const student = JSON.parse(data) as StudentSessionData;

          // Get submission if exists
          const submissionData = await redis.get(sessionKeys.submission(session.id, studentId));
          const submission = submissionData ? JSON.parse(submissionData) as StudentSubmission : undefined;

          students.push({ ...student, submission });
        }
      }
    }

    // Fall back to Postgres if Redis is unavailable or empty
    if (students.length === 0) {
      dataSource = 'postgres';
      const pgStudents = await prisma.student.findMany({
        where: { sessionId: session.id },
        include: {
          submissions: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            include: { feedback: true },
          },
        },
      });

      students = pgStudents.map(s => {
        const latestSubmission = s.submissions[0];
        const submission: StudentSubmission | undefined = latestSubmission ? {
          studentId: s.id,
          content: latestSubmission.content,
          timestamp: latestSubmission.timestamp.getTime(),
          timeElapsed: latestSubmission.timeElapsed || undefined,
          revisionCount: latestSubmission.revisionCount,
          previousContent: latestSubmission.previousContent || undefined,
          feedbackStatus: latestSubmission.feedbackStatus as 'pending' | 'generated' | 'approved' | 'released',
          validationWarnings: latestSubmission.validationWarnings,
          isRevision: latestSubmission.isRevision,
          feedback: latestSubmission.feedback ? {
            goal: latestSubmission.feedback.goal,
            masteryAchieved: latestSubmission.feedback.masteryAchieved,
            strengths: latestSubmission.feedback.strengths as any[],
            growthAreas: latestSubmission.feedback.growthAreas as any[],
            nextSteps: latestSubmission.feedback.nextSteps as any[],
          } : undefined,
        } : undefined;

        return {
          id: s.id,
          name: s.name,
          joinedAt: s.joinedAt.getTime(),
          status: s.status as StudentSessionData['status'],
          submission,
        };
      });
    }

    // Get usage stats
    const quota = await checkTeacherQuota(req.teacher!.id);

    // Calculate stats
    const stats = {
      total: students.length,
      writing: students.filter(s => s.status === 'active').length,
      readyForFeedback: students.filter(s => s.status === 'ready_for_feedback').length,
      generating: students.filter(s => s.status === 'generating').length,
      submitted: students.filter(s => s.status === 'submitted').length,
      feedbackReady: students.filter(s => s.status === 'feedback_ready').length,
      revising: students.filter(s => s.status === 'revising').length,
      completed: students.filter(s => s.status === 'completed').length,
    };

    return res.json({
      session: {
        id: session.id,
        taskId: session.taskId,
        task: session.task,
        startedAt: session.startedAt,
        isLive: session.isLive,
      },
      students,
      stats,
      usage: quota,
      dataSource, // Indicate where data came from for debugging
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    return res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// Student submits work
router.post('/:sessionId/submit', authenticateStudent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, timeElapsed } = req.body;
    const studentId = req.student!.id;
    const sessionId = req.params.sessionId as string;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (sessionId !== req.student!.sessionId) {
      return res.status(403).json({ error: 'Session mismatch' });
    }

    // Get existing submission for revision count (check Postgres first, then Redis)
    const existingSubmission = await prisma.studentSubmission.findFirst({
      where: { studentId, sessionId },
      orderBy: { timestamp: 'desc' },
    });
    const revisionCount = existingSubmission ? existingSubmission.revisionCount + 1 : 0;

    // Dual-write: Persist to Postgres (source of truth) and Redis (cache)
    await prisma.$transaction(async (tx) => {
      // Create submission in Postgres
      await tx.studentSubmission.create({
        data: {
          studentId,
          sessionId,
          content,
          previousContent: existingSubmission?.content,
          timeElapsed,
          revisionCount,
          isRevision: revisionCount > 0,
          feedbackStatus: 'pending',
          validationWarnings: [],
        },
      });

      // Update student status in Postgres
      await tx.student.update({
        where: { id: studentId },
        data: { status: 'ready_for_feedback' },
      });

      // Update session submission count
      await tx.taskSession.update({
        where: { id: sessionId },
        data: { submissions: { increment: 1 } },
      });
    });

    // Also update Redis cache for real-time access
    if (redis) {
      const submission: StudentSubmission = {
        studentId,
        content,
        timestamp: Date.now(),
        timeElapsed,
        revisionCount,
        previousContent: existingSubmission?.content,
        feedbackStatus: 'pending',
        validationWarnings: [],
        isRevision: revisionCount > 0,
      };

      await redis.set(
        sessionKeys.submission(sessionId, studentId),
        JSON.stringify(submission),
        'EX',
        SESSION_TTL
      );

      // Update student status in Redis
      const studentData = await redis.hget(sessionKeys.students(sessionId), studentId);
      if (studentData) {
        const student = JSON.parse(studentData) as StudentSessionData;
        student.status = 'ready_for_feedback';
        await redis.hset(sessionKeys.students(sessionId), studentId, JSON.stringify(student));
      }
    }

    return res.json({
      status: 'ready_for_feedback',
      message: 'Submission received. Your teacher will prepare your feedback shortly.',
    });
  } catch (error) {
    console.error('Submit work error:', error);
    return res.status(500).json({ error: 'Failed to submit work' });
  }
});

// Teacher generates feedback (single or batch)
router.post('/:sessionId/generate-feedback', authenticateTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentIds } = req.body; // If empty, generate for all ready_for_feedback
    const sessionId = req.params.sessionId as string;

    const session = await prisma.taskSession.findFirst({
      where: {
        id: sessionId,
        teacherId: req.teacher!.id,
      },
      include: { task: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get students to generate for - check both Redis and Postgres
    let targetStudentIds: string[] = studentIds || [];

    if (targetStudentIds.length === 0) {
      // Try Redis first, fall back to Postgres
      if (redis) {
        const allStudents = await redis.hgetall(sessionKeys.students(sessionId));
        for (const [sid, data] of Object.entries(allStudents)) {
          const student = JSON.parse(data) as StudentSessionData;
          if (student.status === 'ready_for_feedback') {
            targetStudentIds.push(sid);
          }
        }
      }

      // Fall back to Postgres if no Redis data
      if (targetStudentIds.length === 0) {
        const pgStudents = await prisma.student.findMany({
          where: { sessionId, status: 'ready_for_feedback' },
        });
        targetStudentIds = pgStudents.map(s => s.id);
      }
    }

    if (targetStudentIds.length === 0) {
      return res.json({ generated: 0, message: 'No students ready for feedback' });
    }

    // Check quota
    const quota = await checkTeacherQuota(req.teacher!.id);
    if (!quota.allowed || quota.remaining < targetStudentIds.length) {
      return res.status(403).json({
        error: 'Insufficient AI credits',
        required: targetStudentIds.length,
        remaining: quota.remaining,
      });
    }

    // Generate feedback for each student
    const results: { studentId: string; success: boolean; error?: string }[] = [];

    for (const studentId of targetStudentIds) {
      try {
        // Update status to generating in both Postgres and Redis
        await prisma.student.update({
          where: { id: studentId },
          data: { status: 'generating' },
        });

        if (redis) {
          const studentData = await redis.hget(sessionKeys.students(sessionId), studentId);
          if (studentData) {
            const student = JSON.parse(studentData) as StudentSessionData;
            student.status = 'generating';
            await redis.hset(sessionKeys.students(sessionId), studentId, JSON.stringify(student));
          }
        }

        // Get submission content - try Redis first, then Postgres
        let submissionContent: string | undefined;
        let pgSubmissionId: string | undefined;

        if (redis) {
          const submissionData = await redis.get(sessionKeys.submission(sessionId, studentId));
          if (submissionData) {
            const submission = JSON.parse(submissionData) as StudentSubmission;
            submissionContent = submission.content;
          }
        }

        if (!submissionContent) {
          // Fall back to Postgres
          const pgSubmission = await prisma.studentSubmission.findFirst({
            where: { studentId, sessionId },
            orderBy: { timestamp: 'desc' },
          });
          if (pgSubmission) {
            submissionContent = pgSubmission.content;
            pgSubmissionId = pgSubmission.id;
          }
        }

        if (!submissionContent) {
          results.push({ studentId, success: false, error: 'No submission found' });
          continue;
        }

        // Generate feedback using AI
        const feedback = await generateFeedback(
          session.task.prompt,
          session.task.successCriteria as string[],
          submissionContent
        );

        // Persist feedback to Postgres
        if (!pgSubmissionId) {
          // Find the submission ID if we got content from Redis
          const pgSubmission = await prisma.studentSubmission.findFirst({
            where: { studentId, sessionId },
            orderBy: { timestamp: 'desc' },
          });
          pgSubmissionId = pgSubmission?.id;
        }

        if (pgSubmissionId) {
          await prisma.$transaction(async (tx) => {
            // Update submission status
            await tx.studentSubmission.update({
              where: { id: pgSubmissionId },
              data: { feedbackStatus: 'generated' },
            });

            // Create or update feedback record
            // Cast arrays to JSON-compatible format for Prisma
            const strengthsJson = JSON.parse(JSON.stringify(feedback.strengths));
            const growthAreasJson = JSON.parse(JSON.stringify(feedback.growthAreas));
            const nextStepsJson = JSON.parse(JSON.stringify(feedback.nextSteps));

            await tx.submissionFeedback.upsert({
              where: { submissionId: pgSubmissionId },
              create: {
                submissionId: pgSubmissionId!,
                goal: feedback.goal,
                masteryAchieved: feedback.masteryAchieved || false,
                strengths: strengthsJson,
                growthAreas: growthAreasJson,
                nextSteps: nextStepsJson,
              },
              update: {
                goal: feedback.goal,
                masteryAchieved: feedback.masteryAchieved || false,
                strengths: strengthsJson,
                growthAreas: growthAreasJson,
                nextSteps: nextStepsJson,
              },
            });

            // Update student status
            await tx.student.update({
              where: { id: studentId },
              data: { status: 'submitted' },
            });
          });
        }

        // Update Redis cache
        if (redis) {
          const submissionData = await redis.get(sessionKeys.submission(sessionId, studentId));
          if (submissionData) {
            const submission = JSON.parse(submissionData) as StudentSubmission;
            submission.feedback = feedback;
            submission.feedbackStatus = 'generated';
            await redis.set(
              sessionKeys.submission(sessionId, studentId),
              JSON.stringify(submission),
              'EX',
              SESSION_TTL
            );
          }

          const studentData = await redis.hget(sessionKeys.students(sessionId), studentId);
          if (studentData) {
            const student = JSON.parse(studentData) as StudentSessionData;
            student.status = 'submitted';
            await redis.hset(sessionKeys.students(sessionId), studentId, JSON.stringify(student));
          }
        }

        // Log AI usage
        await logAiUsage(req.teacher!.id, 'single_feedback', 1, session.taskId, sessionId);

        results.push({ studentId, success: true });
      } catch (error) {
        console.error(`Failed to generate for ${studentId}:`, error);

        // Revert status in both Postgres and Redis
        await prisma.student.update({
          where: { id: studentId },
          data: { status: 'ready_for_feedback' },
        }).catch(() => {}); // Ignore if student doesn't exist

        if (redis) {
          const revertData = await redis.hget(sessionKeys.students(sessionId), studentId);
          if (revertData) {
            const student = JSON.parse(revertData) as StudentSessionData;
            student.status = 'ready_for_feedback';
            await redis.hset(sessionKeys.students(sessionId), studentId, JSON.stringify(student));
          }
        }

        results.push({ studentId, success: false, error: 'Generation failed' });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return res.json({
      generated: successCount,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('Generate feedback error:', error);
    return res.status(500).json({ error: 'Failed to generate feedback' });
  }
});

// Teacher approves feedback
router.patch('/:sessionId/feedback/:studentId/approve', authenticateTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const studentId = req.params.studentId as string;
    const { isMastered } = req.body;

    const session = await prisma.taskSession.findFirst({
      where: {
        id: sessionId,
        teacherId: req.teacher!.id,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const newStatus = isMastered ? 'completed' : 'feedback_ready';

    // Update Postgres (source of truth)
    await prisma.$transaction(async (tx) => {
      // Get the latest submission
      const pgSubmission = await tx.studentSubmission.findFirst({
        where: { studentId, sessionId },
        orderBy: { timestamp: 'desc' },
        include: { feedback: true },
      });

      if (pgSubmission) {
        // Update submission status
        await tx.studentSubmission.update({
          where: { id: pgSubmission.id },
          data: { feedbackStatus: 'released' },
        });

        // Update feedback mastery if exists
        if (pgSubmission.feedback) {
          await tx.submissionFeedback.update({
            where: { id: pgSubmission.feedback.id },
            data: { masteryAchieved: isMastered || pgSubmission.feedback.masteryAchieved },
          });
        }
      }

      // Update student status
      await tx.student.update({
        where: { id: studentId },
        data: { status: newStatus },
      });

      // Update session feedback count
      await tx.taskSession.update({
        where: { id: sessionId },
        data: { feedbackSent: { increment: 1 } },
      });
    });

    // Update Redis cache
    if (redis) {
      const submissionData = await redis.get(sessionKeys.submission(sessionId, studentId));
      if (submissionData) {
        const submission = JSON.parse(submissionData) as StudentSubmission;
        submission.feedbackStatus = 'released';
        if (submission.feedback) {
          submission.feedback.masteryAchieved = isMastered || submission.feedback.masteryAchieved;
        }
        await redis.set(
          sessionKeys.submission(sessionId, studentId),
          JSON.stringify(submission),
          'EX',
          SESSION_TTL
        );
      }

      const studentData = await redis.hget(sessionKeys.students(sessionId), studentId);
      if (studentData) {
        const student = JSON.parse(studentData) as StudentSessionData;
        student.status = newStatus;
        await redis.hset(sessionKeys.students(sessionId), studentId, JSON.stringify(student));
      }
    }

    return res.json({ approved: true, releasedAt: Date.now() });
  } catch (error) {
    console.error('Approve feedback error:', error);
    return res.status(500).json({ error: 'Failed to approve feedback' });
  }
});

// Teacher edits feedback
router.patch('/:sessionId/feedback/:studentId/edit', authenticateTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const studentId = req.params.studentId as string;
    const { feedback } = req.body;

    const session = await prisma.taskSession.findFirst({
      where: {
        id: sessionId,
        teacherId: req.teacher!.id,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!redis) {
      return res.status(500).json({ error: 'Session storage unavailable' });
    }

    const submissionData = await redis.get(sessionKeys.submission(sessionId, studentId));
    if (!submissionData) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = JSON.parse(submissionData) as StudentSubmission;
    submission.feedback = { ...submission.feedback, ...feedback };
    await redis.set(
      sessionKeys.submission(sessionId, studentId),
      JSON.stringify(submission),
      'EX',
      SESSION_TTL
    );

    return res.json({ updated: true, feedback: submission.feedback });
  } catch (error) {
    console.error('Edit feedback error:', error);
    return res.status(500).json({ error: 'Failed to edit feedback' });
  }
});

// Student polls for feedback
router.get('/:sessionId/feedback/:studentId', authenticateStudent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const studentId = req.params.studentId as string;

    if (studentId !== req.student!.id || sessionId !== req.student!.sessionId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!redis) {
      return res.status(500).json({ error: 'Session storage unavailable' });
    }

    // Get student status
    const studentData = await redis.hget(sessionKeys.students(sessionId), studentId);
    if (!studentData) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = JSON.parse(studentData) as StudentSessionData;

    // Get submission
    const submissionData = await redis.get(sessionKeys.submission(sessionId, studentId));
    const submission = submissionData ? JSON.parse(submissionData) as StudentSubmission : null;

    // Only return feedback if it's been released
    if (submission?.feedbackStatus === 'released' && submission.feedback) {
      return res.json({
        status: student.status,
        feedbackReady: true,
        feedback: submission.feedback,
        masteryConfirmed: submission.feedback.masteryAchieved,
      });
    }

    return res.json({
      status: student.status,
      feedbackReady: false,
      message: student.status === 'ready_for_feedback' || student.status === 'generating'
        ? 'Your teacher is preparing your feedback.'
        : 'Waiting for feedback.',
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    return res.status(500).json({ error: 'Failed to get feedback' });
  }
});

// Teacher usage stats
router.get('/usage', authenticateTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const quota = await checkTeacherQuota(req.teacher!.id);

    const teacher = await prisma.teacher.findUnique({
      where: { id: req.teacher!.id },
      select: { aiCallsReset: true },
    });

    return res.json({
      ...quota,
      resetDate: teacher?.aiCallsReset,
    });
  } catch (error) {
    console.error('Get usage error:', error);
    return res.status(500).json({ error: 'Failed to get usage' });
  }
});

export default router;
