# Init Command - Token Validators

This module provides token validation utilities for GitHub and Asana tokens.

## Features

- **Online Validation**: Validates tokens by making API calls to GitHub/Asana
- **Offline Format Validation**: Validates token format without network access
- **Automatic Fallback**: Falls back to format validation when network is unavailable
- **Timeout Handling**: All network requests timeout after 5 seconds
- **Username Retrieval**: Returns username/email on successful validation

## Usage

### Import

```typescript
import {
  validateToken,
  validateGitHubToken,
  validateAsanaToken,
  validateGitHubTokenFormat,
  validateAsanaTokenFormat,
  type ValidationResult,
} from './validators.js';
```

### Combined Validator (Recommended)

The `validateToken` function provides automatic fallback to format validation:

```typescript
// Online validation with automatic fallback
const result = await validateToken('github', token);

if (result.success && result.data.valid) {
  console.log(`Token valid for user: ${result.data.username}`);
} else if (result.success) {
  console.error(`Token invalid: ${result.data.error}`);
} else {
  console.error(`Validation error: ${result.error.message}`);
}

// Skip online validation (format only)
const formatResult = await validateToken('github', token, true);
```

### GitHub Token Validation

```typescript
// Online validation
const result = await validateGitHubToken('ghp_xxxxxxxxxxxx');

if (result.success) {
  if (result.data.valid) {
    console.log(`GitHub user: ${result.data.username}`);
  } else {
    console.error(result.data.error);
  }
} else {
  // Network error occurred
  console.error(result.error.message);
}

// Format validation only
if (validateGitHubTokenFormat('ghp_xxxxxxxxxxxx')) {
  console.log('Token format is valid');
}
```

### Asana Token Validation

```typescript
// Online validation
const result = await validateAsanaToken('1/xxxxxxxxxxxx');

if (result.success) {
  if (result.data.valid) {
    console.log(`Asana user: ${result.data.username}`);
  } else {
    console.error(result.data.error);
  }
} else {
  // Network error occurred
  console.error(result.error.message);
}

// Format validation only
if (validateAsanaTokenFormat('1/xxxxxxxxxxxx')) {
  console.log('Token format is valid');
}
```

## Token Formats

### GitHub

Valid formats:
- Personal Access Token (classic): `ghp_*`
- Personal Access Token (fine-grained): `github_pat_*`
- OAuth token: `gho_*`

### Asana

Valid formats:
- Starts with `1/`
- At least 32 characters long

## API Endpoints

### GitHub
- **Endpoint**: `GET https://api.github.com/user`
- **Response**: `{ login: string }`
- **Error Codes**:
  - `401`: Invalid token
  - `403`: Token lacks required permissions

### Asana
- **Endpoint**: `GET https://app.asana.com/api/1.0/users/me`
- **Response**: `{ data: { name?: string, email?: string } }`
- **Error Codes**:
  - `401`: Invalid token
  - `403`: Token lacks required permissions

## Error Handling

The validators use the `Result<T, E>` pattern:

```typescript
const result = await validateGitHubToken(token);

if (result.success) {
  // Result<ValidationResult, never>
  const { valid, username, error } = result.data;
} else {
  // Result<never, Error>
  const error = result.error;
}
```

### Network Errors

Network errors return `Result.success = false` with an Error:
- Timeout errors: "API request timed out"
- Network errors: "Network error while validating token: ..."

This allows callers to distinguish between validation failures (token is invalid) and network failures (cannot reach API).

### Validation Failures

Validation failures return `Result.success = true` with `ValidationResult.valid = false`:
- Invalid token: "Invalid [GitHub|Asana] token"
- Insufficient permissions: "Token lacks required permissions"

## Testing

Run tests with:

```bash
npm test -- src/commands/init/__tests__/validators.test.ts
```

Tests cover:
- Format validation (valid/invalid formats)
- Online validation (success/401/403/network errors/timeouts)
- Combined validator (online, offline, fallback scenarios)
- Edge cases (null, undefined, whitespace)
