import { InterviewQuestion, ApiSettings } from '../types';
import { STORAGE_KEYS } from '../lib/storageKeys';

export const aiService = {
  USE_REAL_API: import.meta.env.PROD || import.meta.env.VITE_USE_REAL_API === 'true',

  getApiSettings(): ApiSettings | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.API_SETTINGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read API settings:', e);
    }
    return null;
  },

  async callAI(messages: { role: string; content: string }[], jsonMode: boolean = false): Promise<any> {
    if (!this.USE_REAL_API) return null;

    try {
      const apiSettings = this.getApiSettings();
      const requestBody: any = { messages, response_format: jsonMode ? { type: "json_object" } : undefined };
      if (apiSettings?.apiKey) requestBody.apiKey = apiSettings.apiKey;
      if (apiSettings?.apiUrl) requestBody.apiUrl = apiSettings.apiUrl;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `AI API responded with status ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      if (jsonMode) {
        try {
          const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error('Failed to parse AI JSON response:', content);
          throw new Error('AI 返回的数据格式不正确');
        }
      }
      return content;
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  },

  async analyzeJDMatch(resumeContent: string, jdText: string): Promise<any> {
    if (this.USE_REAL_API) {
      const prompt = `你是一名资深招聘经理。请分析以下 JD 与候选人简历的匹配程度。按 JSON 格式输出：{ "score": 0-100, "pros": [...], "gaps": [...], "suggestions": [...] }\n\nJD：\n${jdText}\n\n简历：\n${resumeContent}`;
      return await this.callAI([
        { role: "system", content: "你是一个专业的简历分析助手，只输出 JSON。" },
        { role: "user", content: prompt }
      ], true);
    }
    await new Promise(r => setTimeout(r, 1500));
    return { score: 85, pros: ['经验丰富', '技能匹配'], gaps: ['缺少部分项目说明'], suggestions: ['建议补充量化指标'] };
  },

  async optimizeResumeText(text: string, action: string, jdContext?: string): Promise<any> {
    if (this.USE_REAL_API) {
      const prompt = `你是一名资深猎头与简历专家。目标：${action}。${jdContext ? `岗位背景：${jdContext}` : ''}\n严禁编造数据、严禁虚构经历。请优化以下文本（只输出结果，不要解释）：\n\n${text}`;
      return await this.callAI([
        { role: "system", content: "你是一个简历优化专家，只输出优化结果。" },
        { role: "user", content: prompt }
      ]);
    }
    await new Promise(r => setTimeout(r, 1000));
    return text + `\n\n[AI 优化：${action}]`;
  },

  async generateResumeSuggestions(resumeContent: string, jdText: string): Promise<any> {
    if (this.USE_REAL_API) {
      const systemPrompt = `你是简历优化专家。严禁虚构任何简历中不存在的数据。如果简历内容过少（<50字）无法分析，left_panel 返回 []。`;
      const userPrompt = `JD：\n${jdText}\n\n简历：\n${resumeContent}\n\nJSON 格式输出：{ "left_panel": [...], "right_panel": [...], "overall_note": "..." }`;
      return await this.callAI([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], true);
    }
    await new Promise(r => setTimeout(r, 2000));
    return { left_panel: [], right_panel: [], overall_note: "AI 未启用。" };
  },

  async generateInterviewQuestions(resumeContent: string, jdText: string, type?: 'jd' | 'company' | 'resume', count: number = 3): Promise<InterviewQuestion[]> {
    if (this.USE_REAL_API) {
      const prompt = `根据 JD 和简历生成 ${count} 个${type ? `${type === 'jd' ? '岗位相关' : type === 'company' ? '公司相关' : '简历相关'}` : ''}面试问题。JSON：{ "questions": [{ "question": "...", "type": "jd|company|resume" }] }\n\nJD：${jdText}\n\n简历：${resumeContent}`;
      const result = await this.callAI([
        { role: "system", content: "你是一个面试官，只输出 JSON。" },
        { role: "user", content: prompt }
      ], true);
      if (result?.questions) {
        return result.questions.map((q: any) => ({ id: Math.random().toString(36).substr(2, 9), ...q }));
      }
      return [];
    }
    await new Promise(r => setTimeout(r, 1200));
    return [
      { id: '1', question: '请详细介绍你的项目架构设计。', type: 'resume' },
      { id: '2', question: '如何处理性能优化？', type: 'jd' },
      { id: '3', question: '对我们公司的业务模式有什么看法？', type: 'company' }
    ];
  },

  async reviewInterviewAnswer(question: string, answer: string): Promise<{ feedback: string; tags: string[] }> {
    if (this.USE_REAL_API) {
      const prompt = `点评以下面试回答。JSON：{ "feedback": "...", "tags": [...] }\n\n问题：${question}\n\n回答：${answer}`;
      return await this.callAI([
        { role: "system", content: "你是面试辅导专家，只输出 JSON。" },
        { role: "user", content: prompt }
      ], true);
    }
    await new Promise(r => setTimeout(r, 1000));
    return { feedback: '回答逻辑清晰，建议增加量化指标。', tags: ['逻辑清晰', '建议量化'] };
  }
};
