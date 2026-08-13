import { DashboardProvider } from '@/context/DashboardContext';
import { Dashboard } from '@/components/Dashboard/Dashboard';

export default function Home() {
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  );
}
