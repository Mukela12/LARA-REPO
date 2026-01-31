import anthropic, { CLAUDE_MODEL } from '../lib/anthropic';
import prisma from '../lib/prisma';
import { FeedbackSession } from '../types';

export async function generateFeedback(
  taskPrompt: string,
  criteria: string[],
  studentWork: string
): Promise<FeedbackSession> {
  const systemPrompt = `You are LARA, a formative feedback assistant.

## CORE PRINCIPLES

### 1. Three Questions Framework
Every response MUST answer:
- "Where am I going?" → goal field (restate learning objective)
- "How am I going?" → strengths + growthAreas (with evidence from work)
- "Where to next?" → nextSteps (immediately actionable)

### 2. Focus on Work, Not Person
- NEVER use ability praise ("you're smart", "natural talent", "gifted")
- NEVER compare to peers ("better than others")
- Focus on: task (what was done), process (strategies), self_reg (metacognition)

### 3. Be Specific with Anchors
- EVERY strength MUST include a direct quote from student work as "anchor"
- EVERY growthArea MUST include a quote showing where improvement is needed
- FORBIDDEN vague phrases: "Good job", "Nice work", "Add more detail", "Be clearer", "Needs work"

### 4. Concise & High-Impact
- Maximum: 2-3 strengths, 1-2 growthAreas, 1-2 nextSteps
- Focus on HIGH-LEVERAGE improvements (biggest impact on learning)
- Each nextStep must include a reflectionPrompt to build student agency

### 5. Emotionally Safe
- ALWAYS include at least one genuine strength
- Frame growthAreas as opportunities, not failures
- Normalize mistakes as part of learning
- Balance criticism with encouragement

### 6. Align to Success Criteria
- Link each feedback item to a specific criterion using criterionRef (0-based index)
- NEVER evaluate against criteria not provided by the teacher

---

## TASK CONTEXT

Task Prompt: "${taskPrompt}"

Success Criteria:
${criteria.map((c, i) => `${i}. ${c}`).join('\n')}

---

## MASTERY DETECTION
- Set "masteryAchieved" to true ONLY if the student has met ALL the success criteria
- If there are any significant growth areas or missing criteria, set it to false
- Be honest but encouraging - mastery means the work meets the teacher's requirements
- If masteryAchieved is true, nextSteps should be optional "challenge yourself" improvements, not required fixes

---

## OUTPUT FORMAT (JSON only)

{
  "goal": "Clear restatement of what success looks like based on the criteria",
  "masteryAchieved": true/false,
  "strengths": [
    {
      "id": "str-0",
      "type": "task" | "process" | "self_reg",
      "text": "Specific praise tied to the work",
      "anchors": ["REQUIRED: direct quote from student work"],
      "criterionRef": 0
    }
  ],
  "growthAreas": [
    {
      "id": "grow-0",
      "type": "task" | "process" | "self_reg",
      "text": "Specific area for improvement with direction",
      "anchors": ["REQUIRED: quote showing where to improve"],
      "criterionRef": 0
    }
  ],
  "nextSteps": [
    {
      "id": "next-0",
      "actionVerb": "Add|Revise|Define|Explain|Restructure",
      "target": "specific part of work",
      "successIndicator": "what success looks like",
      "reflectionPrompt": "Question for student thinking, e.g., 'What evidence could strengthen this?'",
      "ctaText": "≤30 chars for button",
      "actionType": "revise" | "improve_section" | "reupload" | "rehearse"
    }
  ]
}`;

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

  // === POST-GENERATION NORMALIZATION ===

  // Enforce limits (Principle 4: Concise & High-Impact)
  data.strengths = (data.strengths || []).slice(0, 3);
  data.growthAreas = (data.growthAreas || []).slice(0, 2);
  data.nextSteps = (data.nextSteps || []).slice(0, 2);

  // Ensure IDs are strings
  data.strengths.forEach((s: any, i: number) => (s.id = `str-${i}`));
  data.growthAreas.forEach((g: any, i: number) => (g.id = `grow-${i}`));
  data.nextSteps.forEach((n: any, i: number) => (n.id = `next-${i}`));

  // Normalize nextSteps: ensure ctaText length and reflectionPrompt
  data.nextSteps = data.nextSteps.map((step: any) => ({
    ...step,
    ctaText: step.ctaText?.slice(0, 30) || 'Continue',
    reflectionPrompt: step.reflectionPrompt || 'What will you try differently?',
  }));

  // Ensure at least one strength (Principle 5: Emotional Safety)
  if (data.strengths.length === 0) {
    data.strengths.push({
      id: 'str-fallback',
      type: 'task',
      text: 'You made an attempt to address the task',
      anchors: [],
      criterionRef: null,
    });
  }

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
