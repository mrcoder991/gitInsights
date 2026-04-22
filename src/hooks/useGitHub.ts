import { useMemo } from 'react';

import { createGitHubClients, type GitHubClients } from '../api/github';
import { useAuth } from './useAuth';

// `useGitHub` is the single entry point spec §12 Phase 3 names. Returns null
// when there is no token (no in-flight queries should be running anyway —
// route-guarded). The query hooks below pass clients into their queryFns so
// nothing else in the app calls Octokit directly.

export function useGitHub(): GitHubClients | null {
  const token = useAuth().token;
  return useMemo(() => (token ? createGitHubClients(token) : null), [token]);
}
