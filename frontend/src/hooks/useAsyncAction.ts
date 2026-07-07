import { useCallback, useState } from 'react';

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setIsRunning(true);
      setError('');
      try {
        return await action(...args);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        throw err;
      } finally {
        setIsRunning(false);
      }
    },
    [action],
  );

  return { run, isRunning, error, setError };
}
