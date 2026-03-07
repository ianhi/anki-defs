import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/api';
import type { PlatformInfo } from 'shared';

const DEFAULT_PLATFORM: PlatformInfo = { platform: 'web' };

export function usePlatform(): PlatformInfo {
  const { data } = useQuery({
    queryKey: ['platform'],
    queryFn: platformApi.get,
    staleTime: Infinity,
  });

  return data ?? DEFAULT_PLATFORM;
}
