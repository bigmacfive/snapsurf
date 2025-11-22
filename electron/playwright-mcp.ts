import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let mcpClient: Client | null = null;
let isInitialized = false;

export async function initializePlaywrightMCP(): Promise<Client> {
  if (mcpClient && isInitialized) {
    return mcpClient;
  }

  try {
    // stdio transport 생성 (Playwright MCP 서버를 npx로 실행)
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@executeautomation/playwright-mcp-server']
    });

    // MCP 클라이언트 생성
    mcpClient = new Client({
      name: 'snapsurf-browser',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Transport 연결 (자동으로 초기화됨)
    await mcpClient.connect(transport);

    isInitialized = true;
    console.log('Playwright MCP 서버 연결 완료');

    return mcpClient;
  } catch (error: any) {
    console.error('Playwright MCP 초기화 오류:', error);
    throw error;
  }
}

export async function callPlaywrightTool(
  toolName: string,
  args: any
): Promise<any> {
  try {
    if (!mcpClient || !isInitialized) {
      await initializePlaywrightMCP();
    }

    if (!mcpClient) {
      throw new Error('MCP 클라이언트가 초기화되지 않았습니다');
    }

    // 도구 호출
    const result = await mcpClient.callTool({
      name: toolName,
      arguments: args
    });

    return result;
  } catch (error: any) {
    console.error(`Playwright MCP 도구 호출 오류 (${toolName}):`, error);
    throw error;
  }
}

export async function listPlaywrightTools(): Promise<string[]> {
  try {
    if (!mcpClient || !isInitialized) {
      await initializePlaywrightMCP();
    }

    if (!mcpClient) {
      throw new Error('MCP 클라이언트가 초기화되지 않았습니다');
    }

    // 사용 가능한 도구 목록 가져오기
    const tools = await mcpClient.listTools();
    return tools.tools.map(tool => tool.name);
  } catch (error: any) {
    console.error('Playwright MCP 도구 목록 가져오기 오류:', error);
    return [];
  }
}

export async function closePlaywrightMCP(): Promise<void> {
  if (mcpClient && isInitialized) {
    try {
      await mcpClient.close();
      mcpClient = null;
      isInitialized = false;
      console.log('Playwright MCP 연결 종료');
    } catch (error: any) {
      console.error('Playwright MCP 종료 오류:', error);
    }
  }
}

