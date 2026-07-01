import { useNavigate } from 'react-router-dom';
import { loginPathWithNext } from './publicPaths';

export function useRequireAuthAction() {
  const navigate = useNavigate();
  return (nextPath?: string) => {
    const next = nextPath ?? window.location.pathname + window.location.search;
    navigate(loginPathWithNext(next));
  };
}
