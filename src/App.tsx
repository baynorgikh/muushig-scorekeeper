import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useSyncEngine } from './hooks/useSyncEngine';
import HomePage from './pages/HomePage';
import NewGamePage from './pages/NewGamePage';
import GamePage from './pages/GamePage';
import PlayersPage from './pages/PlayersPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import JoinPage from './pages/JoinPage';
import NotFoundPage from './pages/NotFoundPage';

// Charts are heavy — load the statistics page on demand.
const StatsPage = lazy(() => import('./pages/StatsPage'));

const Loading = () => <div className="py-20 text-center text-ink-400">Ачаалж байна…</div>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/new', element: <NewGamePage /> },
      { path: '/game/:id', element: <GamePage /> },
      { path: '/players', element: <PlayersPage /> },
      { path: '/history', element: <HistoryPage /> },
      {
        path: '/stats',
        element: (
          <Suspense fallback={<Loading />}>
            <StatsPage />
          </Suspense>
        ),
      },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/join', element: <JoinPage /> },
      { path: '/join/:code', element: <JoinPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  useSyncEngine();
  return <RouterProvider router={router} />;
}
