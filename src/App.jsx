import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import NewRisk from './screens/NewRisk';
import Workflow from './screens/Workflow';
import WorkflowOverview from './screens/WorkflowOverview';
import Approvals from './screens/Approvals';
import Analytics from './screens/Analytics';
import Users from './screens/Users';
import SystemsDB from './screens/SystemsDB';
import SLA from './screens/SLA';
import RiskAcceptanceDB from './screens/RiskAcceptanceDB';
import SampleRisks from './screens/SampleRisks';

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"                  element={<Dashboard />} />
            <Route path="/new"               element={<NewRisk />} />
            <Route path="/risk/:id"          element={<Workflow />} />
            <Route path="/approvals"         element={<Approvals />} />
            <Route path="/workflow"          element={<WorkflowOverview />} />
            <Route path="/analytics"         element={<Analytics />} />
            <Route path="/admin/users"       element={<Users />} />
            <Route path="/admin/systems"     element={<SystemsDB />} />
            <Route path="/admin/sla"         element={<SLA />} />
            <Route path="/admin/samples"     element={<SampleRisks />} />
            <Route path="/admin/risk-db"     element={<RiskAcceptanceDB />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
