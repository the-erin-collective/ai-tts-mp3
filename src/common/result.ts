// Common result pattern for consistent error handling
export class Result<T, E = Error> {
  private constructor(
    private readonly isSuccessful: boolean,
    private readonly value?: T,
    private readonly error?: E
  ) {}

  static success<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(true, value);
  }

  static failure<T, E = Error>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  isSuccess(): boolean {
    return this.isSuccessful;
  }

  isFailure(): boolean {
    return !this.isSuccessful;
  }

  getValue(): T {
    if (!this.isSuccessful) {
      throw new Error('Cannot get value from failed result');
    }
    return this.value!;
  }

  getError(): E {
    if (this.isSuccessful) {
      throw new Error('Cannot get error from successful result');
    }
    return this.error!;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isSuccessful) {
      try {
        return Result.success(fn(this.value!));
      } catch (error) {
        return Result.failure(error as E);
      }
    }
    return Result.failure(this.error!);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isSuccessful) {
      return fn(this.value!);
    }
    return Result.failure(this.error!);
  }
}
