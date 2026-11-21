// Read timeouts do not cancel writes or retry operations with side effects.
export async function readWithTimeout<T>(request: PromiseLike<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('This is taking too long. Check your connection and try again.')), milliseconds); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
