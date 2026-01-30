/**
 * @module commands/init/output
 * @description Output formatter for init command completion messages
 */

/**
 * Result of the init command
 */
export interface InitResult {
  filesCreated: string[];
  filesUpdated: string[];
  filesSkipped: { filename: string; reason: string }[];
  tokensMissing: string[];
  tokensProvided: string[];
}

/**
 * Print the completion message after successful init
 *
 * @param result - Result data from init command
 */
export function printCompletionMessage(result: InitResult): void {
  console.log('\n✅ auto-fix-workflow 초기 설정 완료!\n');

  // 파일 목록
  console.log('📁 생성/수정된 파일:');
  const allFiles = [...result.filesCreated, ...result.filesUpdated];
  if (allFiles.includes('.mcp.json')) {
    console.log('  - .mcp.json (MCP 서버 설정)');
  }
  if (allFiles.includes('.auto-fix.yaml')) {
    console.log('  - .auto-fix.yaml (워크플로우 설정 + 토큰)');
  }
  if (allFiles.includes('.gitignore')) {
    console.log('  - .gitignore (.auto-fix.yaml 추가됨)');
  }

  // 보안 정보
  console.log('\n🔒 보안:');
  console.log('  - 토큰은 .auto-fix.yaml에 저장됨');
  console.log('  - .auto-fix.yaml은 .gitignore에 추가되어 커밋되지 않음');

  // 수동 설정 필요
  console.log('\n⚠️  수동 설정이 필요한 항목:\n');

  console.log('1. GitHub 설정 (.auto-fix.yaml)');
  console.log('   - owner: GitHub 조직명 또는 사용자명');
  console.log('   - repo: 저장소명');

  console.log('\n2. Asana 설정 (.auto-fix.yaml)');
  console.log('   - workspaceId: Asana 워크스페이스 ID');
  console.log('   - projectId: Asana 프로젝트 ID');

  console.log('\n   💡 ID 확인 방법:');
  console.log(
    '   프로젝트 URL에서 확인: https://app.asana.com/0/{workspaceId}/{projectId}'
  );

  console.log('\n3. GitHub 라벨 생성');
  console.log('   저장소에 다음 라벨을 생성하세요:');
  console.log('   - auto-fix (녹색, #0E8A16)');
  console.log('   - auto-fix-skip (노란색, #E4E669)');
  console.log('   - auto-fix-failed (빨간색, #D93F0B)');
  console.log('   - auto-fix-processing (파란색, #1D76DB)');

  console.log('\n4. autofixing 브랜치 생성');
  console.log('   git checkout -b autofixing && git push -u origin autofixing');

  console.log('\n📚 상세 가이드: docs/SETUP.md\n');
}

/**
 * Print a warning about a skipped token
 *
 * @param tokenName - Name of the token that was skipped
 */
export function printSkippedTokenWarning(tokenName: string): void {
  console.warn(`⚠️  ${tokenName} 입력을 건너뛰었습니다.`);
  console.warn(`   .auto-fix.yaml에서 나중에 설정할 수 있습니다.\n`);
}

/**
 * Print a validation error for a token
 *
 * @param tokenName - Name of the token that failed validation
 * @param error - Error message
 */
export function printValidationError(tokenName: string, error: string): void {
  console.error(`❌ ${tokenName} 검증 실패: ${error}`);
  console.error(`   다시 입력하거나 .auto-fix.yaml에서 수정하세요.\n`);
}

/**
 * Print a message about a file being created
 *
 * @param filename - Name of the file that was created
 */
export function printFileCreated(filename: string): void {
  console.log(`✅ 파일 생성: ${filename}`);
}

/**
 * Print a message about a file being skipped
 *
 * @param filename - Name of the file that was skipped
 * @param reason - Reason for skipping
 */
export function printFileSkipped(filename: string, reason: string): void {
  console.log(`⏭️  파일 건너뜀: ${filename} (${reason})`);
}
