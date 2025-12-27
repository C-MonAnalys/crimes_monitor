export function withTimeout<T>(promise: Promise<T>, ms = 5000) {
  let timer: any;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  // Quem resolver primeiro vence
  return Promise.race([promise, timeout])
    .finally(() => clearTimeout(timer));
}
