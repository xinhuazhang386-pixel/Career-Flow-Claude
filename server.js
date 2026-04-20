/**
 * Local Development Server
 * 用于本地开发时代理 AI API 请求
 *
 * 启动命令: node server.js
 * 或: npm run dev:full (需要先更新 package.json)
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import multer from 'multer';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { Blob } from 'buffer';
import FormData from 'form-data';

dotenv.config();

const app = express();
app.use(express.json());

// 配置文件上传
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式。仅支持 PDF、DOC、DOCX 文件。'));
    }
  }
});

// 确保 uploads 目录存在
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

/**
 * Resume Parser API Endpoint
 * Path: /api/parse-resume
 * 支持 PDF、DOC、DOCX 文件解析
 */
app.post('/api/parse-resume', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const fileType = originalName.split('.').pop()?.toLowerCase();

  try {
    let extractedText = '';

    if (fileType === 'docx' || fileType === 'doc') {
      // 使用 mammoth 解析 Word 文档
      const fileBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result.value;
    } else if (fileType === 'pdf') {
      // 调用 SoMark API 解析 PDF
      const somarkKey = process.env.SOMARK_API_KEY;

      if (!somarkKey) {
        return res.status(500).json({
          error: '服务器配置错误：缺少 SoMark API Key'
        });
      }

      const fileBuffer = fs.readFileSync(filePath);

      const somarkBaseUrl = process.env.SOMARK_API_URL || 'https://somark.tech/api/v1';
      const formData = new FormData();
      formData.append('api_key', somarkKey);

      // 根据文件类型设置 Content-Type
      let contentType = 'application/octet-stream';
      if (fileType === 'pdf') {
        contentType = 'application/pdf';
      } else if (fileType === 'docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (fileType === 'doc') {
        contentType = 'application/msword';
      }

      formData.append('file', fileBuffer, {
        filename: originalName,
        contentType: contentType,
        knownLength: fileBuffer.length
      });

      // 调试日志
      console.log('=== SoMark API 调试信息 ===');
      console.log('文件大小:', fileBuffer.length, 'bytes');
      console.log('文件名:', originalName);
      console.log('文件类型:', fileType);
      console.log('API URL:', `${somarkBaseUrl}/parse/sync`);
      console.log('Headers:', formData.getHeaders());
      console.log('FormData 长度:', formData.getLengthSync());
      console.log('==========================');

      // 获取 FormData 的完整缓冲区
      const formDataBuffer = formData.getBuffer();
      console.log('FormData 缓冲区大小:', formDataBuffer.length, 'bytes');

      const somarkResponse = await fetch(`${somarkBaseUrl}/parse/sync`, {
        method: 'POST',
        headers: {
          ...formData.getHeaders(),
          'Content-Length': formDataBuffer.length
        },
        body: formDataBuffer
      });

      if (!somarkResponse.ok) {
        console.error('SoMark API Response status:', somarkResponse.status, somarkResponse.statusText);
        const responseText = await somarkResponse.text().catch(() => 'Failed to read response text');
        console.error('SoMark API Response body:', responseText);
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { detail: responseText };
        }
        console.error('SoMark API Error:', errorData);
        return res.status(somarkResponse.status).json({
          error: 'PDF 解析失败',
          details: errorData
        });
      }

      const somarkData = await somarkResponse.json();

      // 从 SoMark 响应中提取文本内容
      // 根据 SoMark 返回结构调整
      extractedText = extractTextFromSoMarkResponse(somarkData);
    } else {
      return res.status(400).json({ error: '不支持的文件格式' });
    }

    // 清理临时文件
    fs.unlinkSync(filePath);

    return res.status(200).json({
      text: extractedText,
      fileName: originalName,
      fileType: fileType?.toUpperCase()
    });

  } catch (error) {
    // 清理临时文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.error('Resume parsing error:', error);
    return res.status(500).json({
      error: '文件解析失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 从 SoMark 响应中提取文本内容
 * 响应格式: { code: 0, data: { result: { outputs: { markdown: "...", json: { pages: [...] } } } } }
 */
function extractTextFromSoMarkResponse(data) {
  if (data.code !== 0) {
    throw new Error(data.message || 'SoMark 解析失败');
  }

  const outputs = data.data?.result?.outputs;
  if (!outputs) {
    throw new Error('SoMark 返回结果中缺少 outputs 字段');
  }

  // 优先使用 markdown 输出（已清洗、排版更好）
  if (outputs.markdown && typeof outputs.markdown === 'string') {
    return outputs.markdown.trim();
  }

  // 回退：从 json.pages 中逐页提取 block content
  if (outputs.json?.pages && Array.isArray(outputs.json.pages)) {
    return outputs.json.pages
      .flatMap(page => (page.blocks || [])
        .filter(block => block.content && block.content.trim().length > 0)
        .map(block => block.content.trim())
      )
      .join('\n\n');
  }

  console.warn('无法识别的 SoMark 响应格式:', data);
  return JSON.stringify(data);
}

// AI Chat API Endpoint
app.post('/api/ai/chat', async (req, res) => {
  // 1. 获取 API Key
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY is missing in environment variables');
    return res.status(500).json({
      error: 'Server configuration error: API Key is missing. Please check your .env file.'
    });
  }

  try {
    const { messages, temperature = 0.7, response_format } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages are required.' });
    }

    // 2. 转发请求到 OpenAI API
    const openaiBaseUrl = process.env.OPENAI_API_URL || 'https://api.gptsapi.net';
    const apiResponse = await fetch(`${openaiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature,
        response_format
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('Upstream API Error:', errorData);
      return res.status(apiResponse.status).json({
        error: 'AI Service currently unavailable.',
        details: errorData
      });
    }

    const data = await apiResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 创建 Vite 开发服务器
async function createServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // 使用 Vite 的中间件
  app.use(vite.middlewares);

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log('\n🚀 CareerFlow 本地开发服务器已启动');
    console.log(`📍 本地访问: http://localhost:${PORT}`);
    console.log(`📍 网络访问: http://0.0.0.0:${PORT}`);
    console.log('\n✅ AI API 代理已启用，可以正常使用 AI 功能');
    console.log('   (请确保 .env 文件中已配置 OPENAI_API_KEY)\n');
  });
}

createServer().catch(console.error);
