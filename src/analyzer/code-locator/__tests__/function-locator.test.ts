/**
 * @module analyzer/code-locator/__tests__/function-locator
 * @description Tests for function and class locator utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import {
  locateFunction,
  locateClass,
  locateMethod,
} from '../function-locator.js';

// Mock fs
vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

describe('analyzer/code-locator/function-locator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('locateFunction', () => {
    it('should locate TypeScript function declaration', async () => {
      const fileContent = `
export function processUser(id: string) {
  return users.find(u => u.id === id);
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('processUser', ['/src/user.ts']);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filePath: '/src/user.ts',
        functionName: 'processUser',
        lineNumber: 2,
        confidence: 0.9,
      });
    });

    it('should locate arrow function with const', async () => {
      const fileContent = `
const validateInput = async (input: string) => {
  return input.length > 0;
};
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('validateInput', ['/src/validator.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].functionName).toBe('validateInput');
    });

    it('should locate function expression', async () => {
      const fileContent = `
const handler = function processRequest() {
  return 'ok';
};
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('processRequest', ['/src/handler.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].functionName).toBe('processRequest');
    });

    it('should locate async arrow function', async () => {
      const fileContent = `
const fetchData = async () => {
  return await api.get('/data');
};
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('fetchData', ['/src/api.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].functionName).toBe('fetchData');
    });

    it('should locate method in object literal', async () => {
      const fileContent = `
const service = {
  getUserData(id: string) {
    return users[id];
  }
};
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('getUserData', ['/src/service.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].functionName).toBe('getUserData');
    });

    it('should locate TypeScript class', async () => {
      const fileContent = `
export class UserService {
  constructor() {}
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('UserService', ['/src/service.ts']);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        className: 'UserService',
        lineNumber: 2,
      });
    });

    it('should locate class with extends', async () => {
      const fileContent = `
class UserController extends BaseController {
  handle() {}
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('UserController', ['/src/controller.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('UserController');
    });

    it('should locate interface', async () => {
      const fileContent = `
export interface IUserRepository {
  findById(id: string): Promise<User>;
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('IUserRepository', ['/src/types.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('IUserRepository');
    });

    it('should locate type alias', async () => {
      const fileContent = `
type UserData = {
  id: string;
  name: string;
};
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('UserData', ['/src/types.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('UserData');
    });

    it('should locate Python function', async () => {
      const fileContent = `
def process_user(user_id):
    return users.get(user_id)
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('process_user', ['/app/user.py']);

      expect(result).toHaveLength(1);
      expect(result[0].functionName).toBe('process_user');
    });

    it('should locate Python async function', async () => {
      const fileContent = `
async def fetch_data():
    return await api.get('/data')
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('fetch_data', ['/app/api.py']);

      expect(result).toHaveLength(1);
      expect(result[0].functionName).toBe('fetch_data');
    });

    it('should locate Python class', async () => {
      const fileContent = `
class UserService:
    def __init__(self):
        pass
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('UserService', ['/app/service.py']);

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('UserService');
    });

    it('should locate Java method', async () => {
      const fileContent = `
public class UserService {
    public User getUserById(String id) {
        return repository.findById(id);
    }
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('getUserById', ['/src/UserService.java']);

      expect(result).toHaveLength(1);
      expect(result[0].functionName).toBe('getUserById');
      expect(result[0].confidence).toBe(0.9);
    });

    it('should locate Java class', async () => {
      const fileContent = `
public class UserRepository {
    private Connection conn;
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('UserRepository', ['/src/UserRepository.java']);

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('UserRepository');
    });

    it('should locate Java interface', async () => {
      const fileContent = `
public interface IUserService {
    User getUser(String id);
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('IUserService', ['/src/IUserService.java']);

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('IUserService');
    });

    it('should search in multiple files', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (filePath === '/src/user.ts') {
          return 'function processUser() {}';
        }
        if (filePath === '/src/admin.ts') {
          return 'function processUser() {}';
        }
        return '';
      });

      const result = await locateFunction('processUser', ['/src/user.ts', '/src/admin.ts']);

      expect(result).toHaveLength(2);
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await locateFunction('myFunction', ['/nonexistent.ts']);

      expect(result).toEqual([]);
    });

    it('should handle empty files', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await locateFunction('myFunction', ['/empty.ts']);

      expect(result).toEqual([]);
    });

    it('should skip empty lines', async () => {
      const fileContent = `

function myFunction() {}

`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('myFunction', ['/src/test.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].lineNumber).toBe(3);
    });

    it('should handle special regex characters in function name', async () => {
      const fileContent = `
function $special_name() {
  return true;
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateFunction('$special_name', ['/src/special.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].functionName).toBe('$special_name');
    });
  });

  describe('locateClass', () => {
    it('should return only class definitions', async () => {
      const fileContent = `
export class UserService {
  processUser() {}
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateClass('UserService', ['/src/service.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('UserService');
    });

    it('should filter out function matches', async () => {
      const fileContent = `
function UserService() {}
export class UserService {
  constructor() {}
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateClass('UserService', ['/src/service.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('UserService');
      expect(result[0].lineNumber).toBe(3);
    });

    it('should return empty array when no classes found', async () => {
      const fileContent = `
function myFunction() {}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateClass('MyClass', ['/src/test.ts']);

      expect(result).toEqual([]);
    });
  });

  describe('locateMethod', () => {
    it('should locate method within class', async () => {
      const fileContent = `
export class UserService {
  getUserById(id: string) {
    return this.repository.find(id);
  }
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'getUserById', ['/src/service.ts']);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        functionName: 'getUserById',
        className: 'UserService',
        confidence: 0.95,
      });
    });

    it('should track class scope with braces', async () => {
      const fileContent = `
export class UserService {
  constructor() {
    this.data = {};
  }

  getUserById(id: string) {
    return this.data[id];
  }
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'getUserById', ['/src/service.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].lineNumber).toBe(7);
    });

    it('should not match methods outside class', async () => {
      const fileContent = `
export class UserService {
  getUserById(id: string) {
    return id;
  }
}

function getUserById(id: string) {
  return id;
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'getUserById', ['/src/service.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].lineNumber).toBe(3);
    });

    it('should search in multiple files', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (filePath === '/src/service1.ts') {
          return 'class UserService {\n  getUser() {}\n}';
        }
        if (filePath === '/src/service2.ts') {
          return 'class UserService {\n  getUser() {}\n}';
        }
        return '';
      });

      const result = await locateMethod('UserService', 'getUser', [
        '/src/service1.ts',
        '/src/service2.ts',
      ]);

      expect(result).toHaveLength(2);
    });

    it('should handle class with extends', async () => {
      const fileContent = `
export class UserService extends BaseService {
  getUserById(id: string) {
    return super.find(id);
  }
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'getUserById', ['/src/service.ts']);

      expect(result).toHaveLength(1);
    });

    it('should handle class with implements', async () => {
      const fileContent = `
export class UserService implements IUserService {
  getUserById(id: string) {
    return this.data[id];
  }
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'getUserById', ['/src/service.ts']);

      expect(result).toHaveLength(1);
    });

    it('should handle nested braces', async () => {
      const fileContent = `
export class UserService {
  getUserById(id: string) {
    if (id) {
      return { id };
    }
  }
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'getUserById', ['/src/service.ts']);

      expect(result).toHaveLength(1);
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await locateMethod('MyClass', 'myMethod', ['/nonexistent.ts']);

      expect(result).toEqual([]);
    });

    it('should return empty array when class not found', async () => {
      const fileContent = `
export class OtherService {
  someMethod() {}
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'someMethod', ['/src/service.ts']);

      expect(result).toEqual([]);
    });

    it('should return empty array when method not found in class', async () => {
      const fileContent = `
export class UserService {
  otherMethod() {}
}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'getUserById', ['/src/service.ts']);

      expect(result).toEqual([]);
    });

    it('should skip empty lines', async () => {
      const fileContent = `
export class UserService {

  getUserById(id: string) {
    return id;
  }

}
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const result = await locateMethod('UserService', 'getUserById', ['/src/service.ts']);

      expect(result).toHaveLength(1);
      expect(result[0].lineNumber).toBe(4);
    });
  });
});
