/**
 * @module common/types/result
 * @description Result 타입 및 타입 가드
 */

/**
 * 성공 결과
 */
export interface Success<T> {
  readonly success: true;
  readonly data: T;
}

/**
 * 실패 결과
 */
export interface Failure<E> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result 타입 (Discriminated Union)
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) {
 *     return { success: false, error: 'Division by zero' };
 *   }
 *   return { success: true, data: a / b };
 * }
 *
 * const result = divide(10, 2);
 * if (isSuccess(result)) {
 *   console.log(result.data); // 5
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * 성공 결과 타입 가드
 *
 * @param result - 검사할 Result
 * @returns 성공 여부
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

/**
 * 실패 결과 타입 가드
 *
 * @param result - 검사할 Result
 * @returns 실패 여부
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}

/**
 * 성공 Result 생성 헬퍼
 *
 * @param data - 성공 데이터
 * @returns Success 객체
 */
export function ok<T>(data: T): Success<T> {
  return { success: true, data };
}

/**
 * 실패 Result 생성 헬퍼
 *
 * @param error - 에러 정보
 * @returns Failure 객체
 */
export function err<E>(error: E): Failure<E> {
  return { success: false, error };
}

/**
 * Result에서 값 추출 (실패 시 기본값 반환)
 *
 * @param result - Result 객체
 * @param defaultValue - 실패 시 반환할 기본값
 * @returns 성공 데이터 또는 기본값
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isSuccess(result) ? result.data : defaultValue;
}

/**
 * Result에서 값 추출 (실패 시 예외 발생)
 *
 * @param result - Result 객체
 * @returns 성공 데이터
 * @throws 실패 시 에러
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw result.error;
}

/**
 * Result 변환 (map)
 *
 * @param result - 원본 Result
 * @param fn - 변환 함수
 * @returns 변환된 Result
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (isSuccess(result)) {
    return ok(fn(result.data));
  }
  return result;
}

/**
 * Result 체이닝 (flatMap/andThen)
 *
 * @param result - 원본 Result
 * @param fn - Result를 반환하는 함수
 * @returns 체이닝된 Result
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return result;
}

/**
 * 에러 변환 (mapError)
 *
 * @param result - 원본 Result
 * @param fn - 에러 변환 함수
 * @returns 에러가 변환된 Result
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isFailure(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * 여러 Result를 결합 (all)
 *
 * @param results - Result 배열
 * @returns 모든 성공 데이터의 배열 또는 첫 번째 에러
 */
export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const data: T[] = [];
  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    data.push(result.data);
  }
  return ok(data);
}

/**
 * Promise를 Result로 변환
 *
 * @param promise - Promise 객체
 * @returns Result를 담은 Promise
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return ok(data);
  } catch (error) {
    return err(error as E);
  }
}

/**
 * Result를 Promise로 변환
 *
 * @param result - Result 객체
 * @returns Promise (실패 시 reject)
 */
export function toPromise<T, E>(result: Result<T, E>): Promise<T> {
  if (isSuccess(result)) {
    return Promise.resolve(result.data);
  }
  return Promise.reject(result.error);
}
