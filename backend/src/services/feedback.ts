import anthropic, { CLAUDE_MODEL } from '../lib/anthropic';
import prisma from '../lib/prisma';
import { FeedbackSession } from '../types';

export async function generateFeedback(
  taskPrompt: string,
  criteria: string[],
  studentWork: string
): Promise<FeedbackSession> {
  const systemPrompt = `You are LARA, a helpful teacher's assistant.
Analyze the student's writing based ONLY on the provided prompt and success criteria.
Be encouraging but specific.

Task Prompt: "${taskPrompt}"
Success Criteria:
${criteria.map((c) => `- ${c}`).join('\n')}

MASTERY DETECTION:
- Set "masteryAchieved" to true ONLY if the student has met ALL the success criteria
- If there are any significant growth areas or missing criteria, set it to false
- Be honest but encouraging - mastery means the work meets the teacher's requirements

You must respond with ONLY valid JSON matching this exact structure:
{
  "goal": "string - A summary of the learning goal",
  "masteryAchieved": boolean - true if ALL success criteria are met with no significant gaps,
  "strengths": [
    {
      "id": "string",
      "type": "task" | "process" | "self_reg",
      "text": "string - What they did well",
      "anchors": ["string - specific examples from their work"]
    }
  ],
  "growthAreas": [
    {
      "id": "string",
      "type": "task" | "process" | "self_reg",
      "text": "string - What needs improvement",
      "anchors": ["string - specific examples"]
    }
  ],
  "nextSteps": [
    {
      "id": "string",
      "actionVerb": "string",
      "target": "string",
      "successIndicator": "string",
      "ctaText": "string",
      "actionType": "revise" | "improve_section" | "reupload" | "rehearse"
    }
  ]
}

NOTE: If masteryAchieved is true, nextSteps should be optional "challenge yourself" improvements, not required fixes.`;

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: studentWork,
      },
    ],
  });

  // Extract text from Claude response
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in response');
  }

  let jsonText = textContent.text.trim();

  // Strip markdown code fences if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  }
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();

  // Extract JSON object - find the outermost { } pair
  const firstBrace = jsonText.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let lastBrace = -1;
    for (let i = firstBrace; i < jsonText.length; i++) {
      if (jsonText[i] === '{') depth++;
      else if (jsonText[i] === '}') {
        depth--;
        if (depth === 0) {
          lastBrace = i;
          break;
        }
      }
    }
    if (lastBrace !== -1) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }
  }

  // Parse JSON from response
  const data = JSON.parse(jsonText);

  // Ensure IDs are strings
  data.strengths.forEach((s: any, i: number) => (s.id = `str-${i}`));
  data.growthAreas.forEach((g: any, i: number) => (g.id = `grow-${i}`));
  data.nextSteps.forEach((n: any, i: number) => (n.id = `next-${i}`));

  // Fallback: if AI didn't return masteryAchieved, infer from growthAreas
  if (typeof data.masteryAchieved !== 'boolean') {
    data.masteryAchieved = data.growthAreas.length === 0;
  }

  return data as FeedbackSession;
}

export async function logAiUsage(
  teacherId: string,
  operation: string,
  studentCount: number = 1,
  taskId?: string,
  sessionId?: string,
  validationWarnings: string[] = []
): Promise<void> {
  // Use transaction to ensure both operations succeed or fail together
  await prisma.$transaction(async (tx) => {
    await tx.aiUsageLog.create({
      data: {
        teacherId,
        taskId,
        sessionId,
        operation,
        studentCount,
        model: CLAUDE_MODEL,
        validationWarnings,
      },
    });

    // Increment teacher's AI call usage
    await tx.teacher.update({
      where: { id: teacherId },
      data: {
        aiCallsUsed: { increment: studentCount },
      },
    });
  });
}

export async function checkTeacherQuota(teacherId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
  });

  if (!teacher) {
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }

  const { TIER_CONFIGS } = await import('../types');
  const tierConfig = TIER_CONFIGS[teacher.tier] || TIER_CONFIGS.starter;

  // Check if we need to reset monthly usage
  const now = new Date();
  const resetDate = new Date(teacher.aiCallsReset);
  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    // Reset monthly usage
    await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        aiCallsUsed: 0,
        aiCallsReset: now,
      },
    });
    return {
      allowed: true,
      used: 0,
      limit: tierConfig.monthlyAiCalls,
      remaining: tierConfig.monthlyAiCalls,
    };
  }

  const remaining = tierConfig.monthlyAiCalls - teacher.aiCallsUsed;

  return {
    allowed: remaining > 0,
    used: teacher.aiCallsUsed,
    limit: tierConfig.monthlyAiCalls,
    remaining: Math.max(0, remaining),
  };
}
