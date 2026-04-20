import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';
import mammoth from 'mammoth';
import FormData from 'form-data';
import { Readable } from 'stream';

interface SoMarkResponse {
  code: number;
  message?: string;
  data?: {
    result?: {
      outputs?: {
        markdown?: string;
        json?: {
          pages?: Array<{
            blocks?: Array<{
              content: string;
            }>;
          }>;
        };
      };
    };
  };
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 从 SoMark 响应中提取文本内容
 * 响应格式: { code: 0, data: { result: { outputs: { markdown: "...", json: { pages: [...] } } } } }
 */
function extractTextFromSoMarkResponse(data: SoMarkResponse): string {
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

function validateFileType(filename: string): boolean {
  const allowedTypes = ['.pdf', '.doc', '.docx'];
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? allowedTypes.includes(ext) : false;
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

async function parsePdfWithSoMark(fileBuffer: Buffer, filename: string): Promise<string> {
  const somarkKey = process.env.SOMARK_API_KEY;

  if (!somarkKey) {
    throw new Error('服务器配置错误：缺少 SoMark API Key');
  }

  const formData = new FormData();
  formData.append('api_key', somarkKey);
  formData.append('file', fileBuffer, { filename });

  const somarkBaseUrl = process.env.SOMARK_API_URL || 'https://somark.tech/api/v1';
  // Note: formData 可以直接作为 body 使用，因为它实现了 Readable 流接口
  const somarkResponse = await fetch(`${somarkBaseUrl}/parse/sync`, {
    method: 'POST',
    headers: formData.getHeaders(),
    body: formData as any
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
    throw new Error('PDF 解析失败');
  }

  const somarkData = await somarkResponse.json();
  return extractTextFromSoMarkResponse(somarkData);
}

function parseFormData(request: VercelRequest): Promise<{
  fileBuffer: Buffer;
  filename: string;
  fileType: string;
}> {
  return new Promise((resolve, reject) => {
    console.log('开始解析 multipart/form-data 请求');
    console.log('Content-Type:', request.headers['content-type']);
    console.log('Content-Length:', request.headers['content-length']);

    const busboy = Busboy({ headers: request.headers });
    let fileBuffer: Buffer | null = null;
    let filename = '';
    let fileSize = 0;
    let fileFieldFound = false;

    busboy.on('file', (fieldname, file, info) => {
      console.log('接收到文件字段:', fieldname, '文件名:', info.filename);
      fileFieldFound = true;
      const { filename: originalName } = info;

      // 验证文件类型
      if (!validateFileType(originalName)) {
        console.log('文件类型验证失败:', originalName);
        file.resume(); // 丢弃文件流
        reject(new Error('不支持的文件格式。仅支持 PDF、DOC、DOCX 文件。'));
        return;
      }

      filename = originalName;
      const chunks: Buffer[] = [];

      file.on('data', (chunk: Buffer) => {
        fileSize += chunk.length;
        console.log(`接收到文件块: ${chunk.length} bytes, 总计: ${fileSize} bytes`);
        if (fileSize > MAX_FILE_SIZE) {
          console.log(`文件大小超过限制: ${fileSize} > ${MAX_FILE_SIZE}`);
          file.resume();
          reject(new Error(`文件大小超过限制。最大支持 ${MAX_FILE_SIZE / (1024 * 1024)}MB。`));
          return;
        }
        chunks.push(chunk);
      });

      file.on('end', () => {
        console.log('文件接收完成，总大小:', fileSize, 'bytes');
        fileBuffer = Buffer.concat(chunks);
      });

      file.on('error', (err) => {
        console.error('文件流错误:', err);
        reject(err);
      });
    });

    busboy.on('field', (fieldname, val) => {
      console.log(`字段 ${fieldname}: ${val}`);
    });

    busboy.on('finish', () => {
      console.log('busboy 解析完成，文件字段找到:', fileFieldFound, '文件缓冲区:', fileBuffer?.length || 0, 'bytes');

      if (!fileFieldFound) {
        reject(new Error('请求中没有找到文件字段。请确保表单字段名为 "file"。'));
        return;
      }

      if (!fileBuffer) {
        reject(new Error('没有上传文件或文件为空'));
        return;
      }

      const fileType = getFileExtension(filename);
      console.log('文件信息:', { filename, fileType, size: fileBuffer.length });
      resolve({ fileBuffer, filename, fileType });
    });

    busboy.on('error', (err) => {
      console.error('busboy 解析错误:', err);
      reject(err);
    });

    // 将请求体管道到 busboy
    try {
      if (request.body) {
        console.log('请求体类型:', typeof request.body, 'is buffer?', Buffer.isBuffer(request.body));

        if (Buffer.isBuffer(request.body)) {
          // 如果是 Buffer，直接创建流
          const stream = Readable.from(request.body);
          stream.pipe(busboy);
        } else if (typeof request.body === 'string') {
          // 如果是字符串，转换为 Buffer
          const stream = Readable.from(Buffer.from(request.body));
          stream.pipe(busboy);
        } else if (typeof (request.body as any).pipe === 'function') {
          // 如果已经是流，直接管道
          (request.body as any).pipe(busboy);
        } else {
          console.error('无法处理的请求体类型:', typeof request.body);
          reject(new Error('无法处理的请求体格式'));
        }
      } else {
        console.error('请求体为空');
        reject(new Error('请求体为空'));
      }
    } catch (error) {
      console.error('请求体处理错误:', error);
      reject(new Error(`请求体处理失败: ${error instanceof Error ? error.message : '未知错误'}`));
    }
  });
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // 只允许 POST 请求
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // 检查 Content-Type
  const contentType = request.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return response.status(400).json({ error: 'Content-Type 必须是 multipart/form-data' });
  }

  try {
    const { fileBuffer, filename, fileType } = await parseFormData(request);

    let extractedText = '';

    if (fileType === 'docx' || fileType === 'doc') {
      // 使用 mammoth 解析 Word 文档
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result.value;
    } else if (fileType === 'pdf') {
      // 调用 SoMark API 解析 PDF
      extractedText = await parsePdfWithSoMark(fileBuffer, filename);
    } else {
      return response.status(400).json({ error: '不支持的文件格式' });
    }

    return response.status(200).json({
      text: extractedText,
      fileName: filename,
      fileType: fileType.toUpperCase()
    });

  } catch (error) {
    console.error('Resume parsing error:', error);
    return response.status(500).json({
      error: '文件解析失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
}